# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Obsidian plugin for inserting relative file/folder paths via customizable trigger character (default `@`). Single-file architecture in `main.ts`.

## Commands

```bash
npm run dev      # Watch mode, outputs to dist/
npm run build    # TypeScript check + production bundle to dist/
npm run version  # Bump versions in manifest.json + versions.json
```

## Architecture

All code lives in `main.ts` with three classes:

1. **MentionPlugin** - Plugin lifecycle, loads/saves settings, registers EditorSuggest
2. **MentionSuggestions** - EditorSuggest implementation for autocomplete
3. **MentionSettingTab** - Settings UI (trigger character only)

## Key Implementation Details

- **Path parsing**: Supports `../` (parent), `./` (current), and `~/` (vault root) navigation
- **Folder selection**: Selecting a folder continues browsing (doesn't close popup)
- **File selection**: Selecting a file inserts relative path and closes popup
- **Recursive search**: When no `/` in query, searches subdirectories recursively
- **Sorting**: `~/` and `../` first, then folders, then files; shallower paths before deeper
- **Build output**: Goes to `dist/` folder (manifest.json, styles.css copied automatically)

## Development

1. Run `npm run dev` for watch mode
2. Edit `main.ts`
3. Reload Obsidian (Cmd+R) to test changes

## Release

Push a git tag to trigger `.github/workflows/release.yml` which creates a draft GitHub release with `main.js`, `manifest.json`, `styles.css`.
