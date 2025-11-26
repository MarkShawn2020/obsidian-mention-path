# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Obsidian plugin for inserting relative file/folder paths via customizable trigger character (default `@`). Single-file architecture (~220 lines TypeScript).

## Commands

```bash
npm run dev      # Watch mode with esbuild
npm run build    # TypeScript check + production bundle
npm run version  # Bump versions in manifest.json + versions.json
```

## Architecture

All code lives in `main.ts` with three classes:

1. **MentionPlugin** - Plugin lifecycle, loads/saves settings, registers EditorSuggest
2. **MentionSuggestions** - EditorSuggest implementation for autocomplete. Shows files/folders relative to current file, supports `../` navigation
3. **MentionSettingTab** - Settings UI (trigger character only)

### Settings Interface
```typescript
interface MentionSettings {
  trigger: string;  // Single character trigger (default "@")
}
```

### SuggestionItem Interface
```typescript
interface SuggestionItem {
  file: TAbstractFile;
  displayPath: string;  // Shown in suggestion popup
  insertPath: string;   // Inserted into document
  isFolder: boolean;
}
```

## Key Implementation Details

- **Path parsing**: Supports `../` (parent) and `./` (current) navigation
- **Folder selection**: Selecting a folder continues browsing (doesn't close popup)
- **File selection**: Selecting a file inserts relative path and closes popup
- **Sorting**: Folders first, then alphabetical
- **External deps**: esbuild marks `obsidian`, `@codemirror/*`, `@lezer/*` as external

## Development

1. Run `npm run dev` for watch mode
2. Edit `main.ts`
3. Reload Obsidian (Cmd+R) to test changes
