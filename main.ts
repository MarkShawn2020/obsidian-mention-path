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

	constructor(plugin: MentionPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	close(): void {
		if (this.preventClose) {
			this.preventClose = false;
			return;
		}
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

		const queryStart = currentLine.lastIndexOf(trigger);
		const query = currentLine.slice(queryStart + 1);

		return {
			start: { ...cursor, ch: queryStart },
			end: cursor,
			query: query,
		};
	}

	getSuggestions(context: EditorSuggestContext): SuggestionItem[] {
		const query = context.query;

		if (query.startsWith(" ")) return [];
		if (!this.currentFile) return [];

		const currentFolder = this.currentFile.parent;
		if (!currentFolder) return [];

		// 解析查询路径
		const { targetFolder, searchName, hasPathNavigation } = this.parseQueryPath(query, currentFolder);

		if (!targetFolder) return [];

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

		// 添加根目录选项（如果不在根目录且搜索词匹配）
		if (!isAtRoot && (!lowerSearch || "~".contains(lowerSearch))) {
			items.push({
				file: vaultRoot,
				displayPath: "~/",
				insertPath: "~/",
				isFolder: true,
			});
		}

		// 添加父目录选项（如果有父目录且搜索词匹配）
		if (folder.parent && (!lowerSearch || "..".contains(lowerSearch))) {
			items.push({
				file: folder.parent,
				displayPath: "../",
				insertPath: pathPrefix + "../",
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
		if (!this.context) return;

		const editor = this.context.editor;
		const start = this.context.start;
		const end = this.context.end;

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

			// 更新 context
			const newQuery = item.insertPath;
			this.context = {
				...this.context,
				start: start,
				end: newCursorPos,
				query: newQuery
			};

			// 刷新建议列表
			const self = this as any;
			if (self.suggestions) {
				const newItems = this.getSuggestions(this.context);
				if (typeof self.suggestions.setSuggestions === 'function') {
					self.suggestions.setSuggestions(newItems);
				}
			}
		} else {
			// 文件：插入相对路径，完成
			editor.replaceRange(item.insertPath, start, end);
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
