 # Simple Project Switcher (Fork)

<img width="700px" alt="image" src="https://user-images.githubusercontent.com/37649155/173582750-8cba07db-2412-4af4-ab6d-331939cd2514.png">

## The backstory
When using Caleb's extension, I found myself organising repositories on my local computer in one big `repositories` folder like this:
```sh
repositories
├── tandahq-work-samples
├── tandahq-api-v2-code-samples
├── mitchbne-simple-project-switcher
└── mitchbne-wabbit
```

While this is reasonably neat, my `repositories` directory grew to around 60 folders - so I decided to cleanup my folder structure so that it looked like this:

```sh
github.com
├── TandaHQ
│   ├── work-samples
│   └── api-v2-code-samples
└── mitchbne
    ├── simple-project-switcher
    └── wabbit
```

Pre-fork, the VS Code extension would look at the current directory's parent, and grab a list of all child directories. This means that when I'm in `github.com/mitchbne/wabbit`, I would have no access to any of the repositories under `github.com/TandaHQ`.

## Fork changes

**Before**
```json
{
    "simple-project-switcher.directory": "~/repositories"
}
```

**After**
```json
{
    "simple-project-switcher.projectDirectories": [
        "~/github.com/mitchbne",
        "~/github.com/TandaHQ"
    ]
}
```

-----

# Simple Project Switcher (Original)

Simple Project Switcher aims to provide for projects the same "switching" experience that **Cmd+P** provides for files.

## Installation

This extension is private and not publicly available on VS Code's extension marketplace.

To install the extension, search for and select `Extensions: Install from VSIX...` from VS Code's command palette (**Cmd+Shift+P**).

## Basic Usage

- From within a project in VS Code, press **Cmd+;** (or **Ctrl+**; on Windows)
- A "Quick Switcher" dialogue will pop up with a list of all the folders in your
current project's parent directory
- Search for a project, and press **Enter**

## Switching back and forth between two projects

- While holding **Cmd**, press the `;` key twice to switch the most recently accessed project
- Repeat the above sequence to switch back

## Configuring a custom directory

By default, this extension uses the parent directory of the current project for the project list.

You can customize this behavior by setting an explicit projects directory in your `settings.json` file:

```json
{
    "simple-project-switcher.directory": "/Users/calebporzio/Sites",
}
```
