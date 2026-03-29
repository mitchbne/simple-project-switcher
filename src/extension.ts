"use strict"

import * as vscode from "vscode"

const { existsSync, statSync, readdirSync } = require("fs")
const { join, relative } = require("path")
const untildify = require("untildify")

const PROJECT_DIRECTORTIES_SETTING_KEY = "simple-project-switcher.projectDirectories"

export function activate(context: vscode.ExtensionContext) {
  trackCurrentProject(context)

  let switchCommand = vscode.commands.registerCommand("simple-project-switcher.switch", () => {
    const directories = config(PROJECT_DIRECTORTIES_SETTING_KEY, [])
    if (!directories.length) {
      vscode.window.showErrorMessage(
        `The simple-project-switcher extension requires '${PROJECT_DIRECTORTIES_SETTING_KEY}' to be set`
      )
      return
    }

    let projects = getProjectsFromDirectories(directories)
    let validProjectKeys = new Set(Object.keys(projects))

    if (!vscode.workspace.workspaceFolders && validProjectKeys.size === 0) {
      vscode.window.showErrorMessage("Project Switcher requires at least one folder to be open.")
      return
    }

    let recentlyAccessedProjects = context.globalState
      .get("simple-project-switcher.recent", [])
      .filter(p => validProjectKeys.has(p))
    context.globalState.update("simple-project-switcher.recent", recentlyAccessedProjects)

    let projectsSortedByRecentlyAccessed = Array.from(new Set(recentlyAccessedProjects.concat(Object.keys(projects))))

    const quickPick = vscode.window.createQuickPick()

    quickPick.items = projectsSortedByRecentlyAccessed.map(project => ({
      label: project,
    }))

    quickPick.onDidChangeSelection(selections => {
      let project = selections[0].label
      if (!project) return
      updateMostRecentProject(context, project)

      vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(projects[project]), true)
    })
    quickPick.onDidHide(() => quickPick.dispose())
    quickPick.show()
  })

  let clearCacheCommand = vscode.commands.registerCommand("simple-project-switcher.clear_cache", () => {
    context.globalState.update("simple-project-switcher.recent", [])
  })

  context.subscriptions.push(switchCommand)
  context.subscriptions.push(clearCacheCommand)
}

function trackCurrentProject(context: vscode.ExtensionContext) {
  const folders = vscode.workspace.workspaceFolders
  if (!folders) return

  const directories = config(PROJECT_DIRECTORTIES_SETTING_KEY, [])
  if (!directories.length) return

  for (const folder of folders) {
    const folderPath = normalizePath(folder.uri.path)
    const matchedRoot = findMatchingRoot(directories, folderPath)
    if (matchedRoot) {
      const currentProjectDirectory = pathRelativeToProjectDirectory(matchedRoot, folderPath)
      updateMostRecentProject(context, currentProjectDirectory)
      vscode.window.onDidChangeWindowState(function (event) {
        if (event.focused) updateMostRecentProject(context, currentProjectDirectory)
      })
      break
    }
  }
}

const MAX_SCAN_DEPTH = 5

function getExcludedDirectories() {
  const excludePatterns = vscode.workspace.getConfiguration("search").get("exclude", {})
  const excluded = new Set<string>()
  for (const [pattern, enabled] of Object.entries(excludePatterns)) {
    if (!enabled) continue
    // Extract directory name from patterns like "**/node_modules" or "node_modules"
    const match = pattern.match(/^(?:\*\*\/)?([^/*]+)$/)
    if (match) excluded.add(match[1])
  }
  return excluded
}

function getProjectsFromDirectories(directories) {
  const labelToPath = {}
  const labelCount = {}
  const excluded = getExcludedDirectories()

  directories.forEach(projectDirectory => {
    let root = normalizePath(projectDirectory)
    scanForProjects(root, root, 0, labelToPath, labelCount, excluded)
  })

  const projects = {}
  for (const [path, label] of Object.entries(labelToPath)) {
    const key = labelCount[label as string] > 1 ? `${label} (${path})` : label
    projects[key as string] = path
  }
  return projects
}

function scanForProjects(root, directory, depth, labelToPath, labelCount, excluded) {
  if (depth >= MAX_SCAN_DEPTH) return

  let entries
  try {
    entries = readdirSync(directory)
  } catch {
    return
  }

  entries.forEach(name => {
    if (name.startsWith(".") || excluded.has(name)) return
    let path = normalizePath(join(directory, name))
    try {
      if (!statSync(path).isDirectory()) return
    } catch {
      return
    }

    if (existsSync(join(path, ".git"))) {
      const label = pathRelativeToProjectDirectory(root, path)
      labelCount[label] = (labelCount[label] || 0) + 1
      labelToPath[path] = label
    } else {
      scanForProjects(root, path, depth + 1, labelToPath, labelCount)
    }
  })
}

function pathRelativeToProjectDirectory(projectDirectory, path) {
  return relative(join(projectDirectory, ".."), path)
}

function updateMostRecentProject(context, currentProject) {
  currentProject = normalizePath(currentProject)

  context.globalState.update("simple-project-switcher.focused", currentProject)

  let recentlyAccessedProjects = context.globalState.get("simple-project-switcher.recent", [])

  recentlyAccessedProjects.unshift(normalizePath(currentProject))

  context.globalState.update("simple-project-switcher.recent", Array.from(new Set(recentlyAccessedProjects)))
}

function config(setting, fallback) {
  return vscode.workspace.getConfiguration().get(setting) || fallback
}

function findMatchingRoot(directories, windowPath) {
  let bestMatch = undefined
  for (const directory of directories) {
    const normalizedDirectory = normalizePath(directory)
    const dirWithTrailingSlash = normalizedDirectory.endsWith("/") ? normalizedDirectory : normalizedDirectory + "/"
    if (windowPath.startsWith(dirWithTrailingSlash)) {
      if (!bestMatch || normalizedDirectory.length > bestMatch.length) {
        bestMatch = normalizedDirectory
      }
    }
  }
  return bestMatch
}

function normalizePath(path) {
  path = untildify(path)
  // Strip leading slash before Windows drive letters (e.g. /C:/ -> C:/)
  path = path.replace(/^\/([a-zA-Z]):\//, "$1:/")
  // Convert backslashes from windows paths to forward slashes, otherwise the shell will ignore them.
  return path.replace(/\\/g, "/")
}

export function deactivate() {
  //
}
