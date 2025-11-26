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

	constructor(plugin: MentionPlugin) {
		super(plugin.app);
		this.plugin = plugin;
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
		const { targetFolder, searchName } = this.parseQueryPath(query, currentFolder);
		if (!targetFolder) return [];

		return this.getItemsInFolder(targetFolder, searchName, query, currentFolder);
	}

	private parseQueryPath(query: string, baseFolder: TFolder): { targetFolder: TFolder | null; searchName: string } {
		let targetFolder: TFolder | null = baseFolder;

		const parts = query.split("/");
		const searchName = parts.pop() || "";

		for (const part of parts) {
			if (!targetFolder) break;

			if (part === "..") {
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

		return { targetFolder, searchName };
	}

	private getItemsInFolder(
		folder: TFolder,
		searchName: string,
		fullQuery: string,
		baseFolder: TFolder
	): SuggestionItem[] {
		const items: SuggestionItem[] = [];
		const lowerSearch = searchName.toLowerCase();

		// 计算从 baseFolder 到 folder 的相对路径前缀
		const pathPrefix = fullQuery.substring(0, fullQuery.lastIndexOf("/") + 1);

		for (const child of folder.children) {
			const name = child.name;
			if (!name.toLowerCase().contains(lowerSearch)) continue;

			const isFolder = child instanceof TFolder;
			const displayName = isFolder ? name + "/" : name;

			items.push({
				file: child,
				displayPath: displayName,
				insertPath: pathPrefix + (isFolder ? name + "/" : name),
				isFolder: isFolder,
			});
		}

		// 文件夹优先，然后按名称排序
		items.sort((a, b) => {
			if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
			return a.displayPath.localeCompare(b.displayPath);
		});

		return items;
	}

	selectSuggestion(item: SuggestionItem, evt: MouseEvent | KeyboardEvent): void {
		if (!this.context) return;

		if (item.isFolder) {
			// 文件夹：替换为路径，继续输入
			const newQuery = this.plugin.settings.trigger + item.insertPath;
			this.context.editor.replaceRange(
				newQuery,
				this.context.start,
				this.context.end
			);
		} else {
			// 文件：插入相对路径，完成
			this.context.editor.replaceRange(
				item.insertPath,
				this.context.start,
				this.context.end
			);
			this.close();
		}
	}

	renderSuggestion(item: SuggestionItem, el: HTMLElement): void {
		const icon = item.isFolder ? "📁 " : "📄 ";
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
