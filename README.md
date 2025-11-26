# Mention Path

Quickly insert relative file and folder paths while writing in Obsidian using a customizable trigger character (default `@`).

![demo](./assets/demo-video.gif)

## Features

- Type `@` to trigger autocomplete suggestions for files and folders
- Navigate directories with `../` (parent) and `./` (current)
- Folder-first sorting for easy navigation
- Configurable trigger character

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
