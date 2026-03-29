# Simple Project Switcher

<img width="700px" alt="image" src="https://user-images.githubusercontent.com/37649155/173582750-8cba07db-2412-4af4-ab6d-331939cd2514.png">

A VS Code extension for quickly switching between projects. It provides the same fast "switching" experience that **Cmd+P** gives you for files, but for entire projects.

## Features

- **Recursive project discovery** — automatically finds Git repositories at any depth under your configured directories
- **Recent project tracking** — recently accessed projects appear at the top of the list
- **Multi-root workspace support** — works with VS Code multi-root workspaces
- **Respects `search.exclude`** — skips directories like `node_modules` based on your existing VS Code settings

## Installation

Download the latest `.vsix` from [GitHub Releases](https://github.com/mitchbne/simple-project-switcher/releases), then install it via VS Code's command palette (**Cmd+Shift+P**) → `Extensions: Install from VSIX...`.

## Configuration

Add your top-level project directories to your VS Code `settings.json`:

```json
{
    "simple-project-switcher.projectDirectories": [
        "~/github.com"
    ]
}
```

The extension recursively scans these directories and discovers any folder containing a `.git` directory as a project. For example, with the directory structure:

```
~/github.com
├── TandaHQ
│   ├── work-samples/        ← discovered as TandaHQ/work-samples
│   └── api-v2-code-samples/ ← discovered as TandaHQ/api-v2-code-samples
└── mitchbne
    ├── simple-project-switcher/ ← discovered as mitchbne/simple-project-switcher
    └── wabbit/                  ← discovered as mitchbne/wabbit
```

You can also configure multiple directories:

```json
{
    "simple-project-switcher.projectDirectories": [
        "~/github.com",
        "~/work/projects"
    ]
}
```

## Usage

| Action | Shortcut |
|--------|----------|
| Open project switcher | **Cmd+;** (macOS) / **Ctrl+;** (Windows/Linux) |
| Navigate to next item | **Cmd+;** while picker is open |
| Navigate to previous item | **Cmd+Shift+;** while picker is open |

### Commands

- **Simple Project Switcher: Switch Project** — open the project picker
- **Simple Project Switcher: Clear Cache** — clear the recently accessed projects list
