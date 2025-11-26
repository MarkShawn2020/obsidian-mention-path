# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Obsidian community plugin for quick text snippet insertion via customizable trigger character (default `/`). Single-file architecture (~250 lines TypeScript).

## Commands

```bash
npm run dev      # Watch mode with esbuild
npm run build    # TypeScript check + production bundle
npm run version  # Bump versions in manifest.json + versions.json
```

## Architecture

All code lives in `main.ts` with three classes:

1. **SlashSnippetPlugin** - Plugin lifecycle, loads/saves settings, registers EditorSuggest
2. **SlashSuggestions** - EditorSuggest implementation for autocomplete. Searches vault for `.md` files in configured folder, handles insertion + optional Templater integration
3. **SlashSnippetSettingTab** - Settings UI (trigger char, snippet path, ignore properties, templater support)

### Settings Interface
```typescript
interface SlashSnippetSettings {
  slashTrigger: string;        // Single character trigger
  snippetPath: string;         // Folder containing snippets
  ignoreProperties: boolean;   // Strip YAML frontmatter
  templaterSupport: boolean;   // Run Templater after insertion
}
```

## Key Implementation Details

- **Snippet matching**: Case-insensitive filename search filtered by folder path
- **Frontmatter removal**: Regex `/^---\n[\s\S]*?\n---\n?/`
- **Templater execution**: 300ms debounce via `executeCommandById('templater-obsidian:replace-in-file-templater')`
- **External deps**: esbuild marks `obsidian`, `@codemirror/*`, `@lezer/*` as external

## Development

1. Run `npm run dev` for watch mode
2. Edit `main.ts`
3. Reload Obsidian (Cmd+R) to test changes
