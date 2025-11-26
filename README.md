# Mention Path

Quickly insert relative file and folder paths while writing in Obsidian using a customizable trigger character (default `@`).

![demo](./assets/demo-video.gif)

## Features

### 1. Trigger-based Autocomplete
Type `@` (or your custom trigger) to instantly activate file/folder suggestions. The trigger only activates after whitespace or at line start, preventing false triggers mid-word.

### 2. Parent Directory Navigation (`../`)
Use `../` to navigate up to parent directories. Supports chaining like `../../` for multi-level navigation.

### 3. Vault Root Quick Access (`~/`)
Type `~/` to jump directly to your vault root, then browse from there.

### 4. Folder Drill-down
Selecting a folder doesn't close the popup—it navigates into that folder, allowing continuous browsing until you find the target file.

### 5. Recursive Search
When typing a search term without path separators, the plugin searches recursively through all subdirectories, showing matches with their relative paths.

### 6. Smart Sorting
Results are sorted intelligently: special directories (`~/`, `../`) first, then folders, then files—all alphabetically within each group. Shallower paths appear before deeper ones.

### 7. Relative Path Insertion
Selected files are inserted as relative paths from your current file's location, making links portable and refactor-friendly.

### 8. Customizable Trigger Character
Change the default `@` trigger to any single character you prefer in settings.

## Usage

1. Type `@` (or your configured trigger) anywhere in a note
2. Start typing to filter files/folders in the current directory
3. Use `../` to navigate to parent directories
4. Select a folder to continue browsing, or select a file to insert its relative path

## Installation

### Manual Installation

1. Download `main.js`, `manifest.json`, `styles.css` from the [releases page](https://github.com/MarkShawn2020/obsidian-mention-path/releases)
2. Create folder `.obsidian/plugins/mention-path/` in your vault
3. Copy downloaded files into the folder
4. Reload Obsidian
5. Enable the plugin in Settings -> Community Plugins

### BRAT

Install via [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) using: `MarkShawn2020/obsidian-mention-path`

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Trigger character | Character that activates path suggestions | `@` |
