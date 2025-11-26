import {
	App,
	Editor,
	EditorPosition,
	EditorSuggestTriggerInfo,
	Plugin,
	PluginSettingTab,
	Setting,
	EditorSuggest,
	TFile,
	TFolder,
	TAbstractFile,
	EditorSuggestContext,
	Notice,
} from "obsidian";

interface MentionSettings {
	trigger: string;
}

const DEFAULT_SETTINGS: MentionSettings = {
	trigger: "@",
};

interface SuggestionItem {
	file: TAbstractFile;
	displayPath: string;  // 显示给用户的相对路径
	insertPath: string;   // 插入到文档的相对路径
	isFolder: boolean;
}


class MentionSuggestions extends EditorSuggest<SuggestionItem> {
	private plugin: MentionPlugin;
	private currentFile: TFile | null = null;
	private preventClose: boolean = false;
	private savedContext: EditorSuggestContext | null = null;

	constructor(plugin: MentionPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	close(): void {
		if (this.preventClose) {
			this.preventClose = false;
			return;
		}
		this.savedContext = null;
		super.close();
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		file: TFile | null
	): EditorSuggestTriggerInfo | null {
		this.currentFile = file;
		const currentLine = editor.getLine(cursor.line).slice(0, cursor.ch);
		const trigger = this.plugin.settings.trigger;

		if (!currentLine.contains(trigger)) {
			return null;
		}

		// 找到有效的触发位置（前面是空白或行首）
		let queryStart = -1;
		for (let i = currentLine.length - 1; i >= 0; i--) {
			if (currentLine[i] === trigger) {
				// 检查前面是否是空白或行首
				if (i === 0 || /\s/.test(currentLine[i - 1])) {
					queryStart = i;
					break;
				}
			}
		}

		if (queryStart === -1) {
			return null;
		}

		const query = currentLine.slice(queryStart + 1);
		console.log("[MentionPath] onTrigger returning query:", query);

		return {
			start: { ...cursor, ch: queryStart },
			end: cursor,
			query: query,
		};
	}

	getSuggestions(context: EditorSuggestContext): SuggestionItem[] {
		const query = context.query;
		console.log("[MentionPath] getSuggestions called, query:", query);

		if (!this.currentFile) return [];

		const currentFolder = this.currentFile.parent;
		if (!currentFolder) return [];

		// 解析查询路径
		const { targetFolder, searchName, hasPathNavigation } = this.parseQueryPath(query, currentFolder);

		// 路径无效，退出候选模式
		if (!targetFolder) {
			this.savedContext = null;
			this.preventClose = false;
			this.close();
			return [];
		}

		// 检查是否精确匹配一个文件（不是文件夹）
		if (searchName) {
			for (const child of targetFolder.children) {
				if (child.name === searchName && child instanceof TFile) {
					// 精确匹配到文件，关闭候选
					console.log("[MentionPath] exact file match, closing:", searchName);
					this.savedContext = null;
					this.preventClose = false;
					this.close();
					return [];
				}
			}
		}

		// 获取当前文件夹的直接子项
		const directItems = this.getItemsInFolder(targetFolder, searchName, query);

		// 如果没有路径导航（即没有 /），则递归搜索子目录
		let recursiveItems: SuggestionItem[] = [];
		if (!hasPathNavigation && searchName.length > 0) {
			recursiveItems = this.getItemsRecursively(targetFolder, searchName, "");
		}

		// 合并结果，去重（直接子项优先）
		const seen = new Set(directItems.map(i => i.insertPath));
		const allItems = [
			...directItems,
			...recursiveItems.filter(i => !seen.has(i.insertPath))
		];

		// 检查是否有实际匹配（排除 ../ 和 ~/）
		const hasRealMatches = allItems.some(item =>
			item.displayPath !== "../" && item.displayPath !== "~/"
		);

		// 没有实际匹配结果时退出候选模式：
		// 1. 有搜索词但没匹配
		// 2. 路径已确定（以 / 结尾）但文件夹为空
		const pathConfirmed = query.endsWith("/");
		if (!hasRealMatches && (searchName.length > 0 || pathConfirmed)) {
			console.log("[MentionPath] no real matches, closing. searchName:", searchName, "pathConfirmed:", pathConfirmed);
			this.savedContext = null;
			this.preventClose = false;
			this.close();
			return [];
		}

		// 排序：特殊目录优先，文件夹优先，然后按路径深度，然后按名称
		allItems.sort((a, b) => {
			// ~/ 和 ../ 排在最前面
			const aIsRoot = a.displayPath === "~/";
			const bIsRoot = b.displayPath === "~/";
			if (aIsRoot !== bIsRoot) return aIsRoot ? -1 : 1;

			const aIsParent = a.displayPath === "../";
			const bIsParent = b.displayPath === "../";
			if (aIsParent !== bIsParent) return aIsParent ? -1 : 1;

			if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
			const depthA = (a.insertPath.match(/\//g) || []).length;
			const depthB = (b.insertPath.match(/\//g) || []).length;
			if (depthA !== depthB) return depthA - depthB;
			return a.displayPath.localeCompare(b.displayPath);
		});

		return allItems.slice(0, 50); // 限制结果数量
	}

	private parseQueryPath(query: string, baseFolder: TFolder): {
		targetFolder: TFolder | null;
		searchName: string;
		hasPathNavigation: boolean;
	} {
		let targetFolder: TFolder | null = baseFolder;
		const hasPathNavigation = query.contains("/");

		const parts = query.split("/");
		const searchName = parts.pop() || "";

		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			if (!targetFolder) break;

			if (part === "~") {
				// vault 根目录
				targetFolder = this.plugin.app.vault.getRoot();
			} else if (part === "..") {
				targetFolder = targetFolder.parent;
			} else if (part === ".") {
				// 当前目录，不变
			} else if (part !== "") {
				// 进入子文件夹
				let found: TFolder | null = null;
				for (const c of targetFolder.children) {
					if (c instanceof TFolder && c.name === part) {
						found = c;
						break;
					}
				}
				targetFolder = found;
			}
		}

		return { targetFolder, searchName, hasPathNavigation };
	}

	private getItemsInFolder(
		folder: TFolder,
		searchName: string,
		fullQuery: string
	): SuggestionItem[] {
		const items: SuggestionItem[] = [];
		const lowerSearch = searchName.toLowerCase();

		// 计算路径前缀
		const pathPrefix = fullQuery.substring(0, fullQuery.lastIndexOf("/") + 1);
		const vaultRoot = this.plugin.app.vault.getRoot();
		const isAtRoot = folder.path === "" || folder.path === "/";

		// 添加根目录选项（仅在输入为空时显示）
		if (!isAtRoot && !lowerSearch && !pathPrefix) {
			items.push({
				file: vaultRoot,
				displayPath: "~/",
				insertPath: "~/",
				isFolder: true,
			});
		}

		// 添加父目录选项（始终显示，计算回退路径）
		if (folder.parent) {
			let parentPath: string;
			if (pathPrefix) {
				// 有路径前缀：移除最后一个目录段
				const startsWithRoot = pathPrefix.startsWith("~/");
				const workingPrefix = startsWithRoot ? pathPrefix.slice(2) : pathPrefix;
				const segments = workingPrefix.split("/").filter(s => s && s !== "..");
				segments.pop();

				if (startsWithRoot) {
					// 保留 ~/ 前缀
					parentPath = segments.length > 0 ? "~/" + segments.join("/") + "/" : "~/";
				} else {
					parentPath = segments.length > 0 ? segments.join("/") + "/" : "";
				}
			} else {
				// 无路径前缀：使用 ../ 导航到父目录
				parentPath = "../";
			}

			items.push({
				file: folder.parent,
				displayPath: "../",
				insertPath: parentPath,
				isFolder: true,
			});
		}

		for (const child of folder.children) {
			const name = child.name;
			if (lowerSearch && !name.toLowerCase().contains(lowerSearch)) continue;

			const isFolder = child instanceof TFolder;
			const displayName = isFolder ? name + "/" : name;

			items.push({
				file: child,
				displayPath: displayName,
				insertPath: pathPrefix + (isFolder ? name + "/" : name),
				isFolder: isFolder,
			});
		}

		return items;
	}

	private getItemsRecursively(
		folder: TFolder,
		searchName: string,
		pathPrefix: string
	): SuggestionItem[] {
		const items: SuggestionItem[] = [];
		const lowerSearch = searchName.toLowerCase();

		for (const child of folder.children) {
			const name = child.name;
			const isFolder = child instanceof TFolder;
			const relativePath = pathPrefix ? pathPrefix + "/" + name : name;

			// 如果名称匹配搜索词，添加到结果
			if (name.toLowerCase().contains(lowerSearch)) {
				items.push({
					file: child,
					displayPath: relativePath + (isFolder ? "/" : ""),
					insertPath: relativePath + (isFolder ? "/" : ""),
					isFolder: isFolder,
				});
			}

			// 如果是文件夹，递归搜索
			if (isFolder) {
				const subItems = this.getItemsRecursively(
					child as TFolder,
					searchName,
					relativePath
				);
				items.push(...subItems);
			}
		}

		return items;
	}

	selectSuggestion(item: SuggestionItem, evt: MouseEvent | KeyboardEvent): void {
		// 使用 savedContext 作为备份（当 context 被 Obsidian 置空时）
		const ctx = this.context || this.savedContext;
		if (!ctx) return;

		const editor = ctx.editor;
		const start = ctx.start;
		const end = ctx.end;

		if (item.isFolder) {
			// 文件夹：阻止关闭，替换为路径，然后刷新建议
			this.preventClose = true;

			const newText = this.plugin.settings.trigger + item.insertPath;
			editor.replaceRange(newText, start, end);

			// 设置光标位置到新文本末尾
			const newCursorPos = {
				line: start.line,
				ch: start.ch + newText.length
			};
			editor.setCursor(newCursorPos);

			// 更新并保存 context
			const newQuery = item.insertPath;
			const newContext = {
				...ctx,
				start: start,
				end: newCursorPos,
				query: newQuery
			};
			this.savedContext = newContext;

			// 刷新建议列表
			const self = this as any;
			if (self.suggestions) {
				const newItems = this.getSuggestions(newContext);
				if (typeof self.suggestions.setSuggestions === 'function') {
					self.suggestions.setSuggestions(newItems);
				}
			}
		} else {
			// 文件：插入带触发符的相对路径，完成
			const newText = this.plugin.settings.trigger + item.insertPath;
			editor.replaceRange(newText, start, end);
			this.savedContext = null;
			this.close();
		}
	}

	renderSuggestion(item: SuggestionItem, el: HTMLElement): void {
		let icon: string;
		if (item.displayPath === "~/") {
			icon = "🏠 ";
		} else if (item.displayPath === "../") {
			icon = "⬆️ ";
		} else if (item.isFolder) {
			icon = "📁 ";
		} else {
			icon = "📄 ";
		}
		el.createEl("div", { text: icon + item.displayPath });
	}
}

export default class MentionPlugin extends Plugin {
	settings: MentionSettings;

	async onload() {
		await this.loadSettings();
		this.registerEditorSuggest(new MentionSuggestions(this));
		this.addSettingTab(new MentionSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class MentionSettingTab extends PluginSettingTab {
	plugin: MentionPlugin;

	constructor(app: App, plugin: MentionPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Trigger character")
			.setDesc("Character that triggers file/folder suggestions")
			.addText((text) =>
				text
					.setPlaceholder("@")
					.setValue(this.plugin.settings.trigger)
					.onChange(async (value) => {
						if (value && value.length > 1) {
							new Notice("Please use one character");
							text.setValue(value[0]);
						} else {
							this.plugin.settings.trigger = value;
							await this.plugin.saveSettings();
						}
					})
			);
	}
}
