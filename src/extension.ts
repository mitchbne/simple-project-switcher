"use strict"

import * as vscode from "vscode"
import { Dirent, readdirSync } from "fs"
import { join, relative } from "path"
import untildify = require("untildify")

const SETTING_PROJECT_DIRECTORIES = "simple-project-switcher.projectDirectories"
const STATE_RECENT_PROJECTS = "simple-project-switcher.recent"
const STATE_FOCUSED_PROJECT = "simple-project-switcher.focused"
const MAX_SCAN_DEPTH = 5

// --- Activation ---

export function activate(context: vscode.ExtensionContext): void {
  trackCurrentProject(context)

  const switchCommand = vscode.commands.registerCommand("simple-project-switcher.switch", () => {
    showProjectPicker(context)
  })

  const clearCacheCommand = vscode.commands.registerCommand("simple-project-switcher.clear_cache", () => {
    context.globalState.update(STATE_RECENT_PROJECTS, [])
  })

  context.subscriptions.push(switchCommand, clearCacheCommand)
}

export function deactivate(): void {}

// --- Commands ---

function showProjectPicker(context: vscode.ExtensionContext): void {
  const directories = getConfiguredDirectories()
  if (!directories.length) {
    vscode.window.showErrorMessage(
      `The simple-project-switcher extension requires '${SETTING_PROJECT_DIRECTORIES}' to be set`
    )
    return
  }

  const projects = discoverProjects(directories)
  const projectNames = new Set(Object.keys(projects))

  if (!vscode.workspace.workspaceFolders && projectNames.size === 0) {
    vscode.window.showErrorMessage("Project Switcher requires at least one folder to be open.")
    return
  }

  const recentProjects = pruneRecentProjects(context, projectNames)
  const sortedNames = Array.from(new Set([...recentProjects, ...projectNames]))

  const quickPick = vscode.window.createQuickPick()
  quickPick.items = sortedNames.map(name => ({ label: name }))

  quickPick.onDidChangeSelection(selections => {
    const selected = selections[0]?.label
    if (!selected) return

    pushRecentProject(context, selected)
    vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(projects[selected]), true)
  })

  quickPick.onDidHide(() => quickPick.dispose())
  quickPick.show()
}

// --- Recent Project Tracking ---

function trackCurrentProject(context: vscode.ExtensionContext): void {
  const folders = vscode.workspace.workspaceFolders
  if (!folders) return

  const directories = getConfiguredDirectories()
  if (!directories.length) return

  for (const folder of folders) {
    const folderPath = normalizePath(folder.uri.path)
    const matchedRoot = findLongestMatchingRoot(directories, folderPath)
    if (matchedRoot) {
      const projectLabel = toProjectLabel(matchedRoot, folderPath)
      pushRecentProject(context, projectLabel)
      vscode.window.onDidChangeWindowState(event => {
        if (event.focused) pushRecentProject(context, projectLabel)
      })
      break
    }
  }
}

function pushRecentProject(context: vscode.ExtensionContext, project: string): void {
  const normalized = normalizePath(project)
  const recent: string[] = context.globalState.get(STATE_RECENT_PROJECTS, [])
  const updated = [normalized, ...recent.filter(p => p !== normalized)]

  context.globalState.update(STATE_FOCUSED_PROJECT, normalized)
  context.globalState.update(STATE_RECENT_PROJECTS, updated)
}

function pruneRecentProjects(context: vscode.ExtensionContext, validNames: Set<string>): string[] {
  const recent: string[] = context.globalState.get(STATE_RECENT_PROJECTS, [])
  const pruned = recent.filter(p => validNames.has(p))
  context.globalState.update(STATE_RECENT_PROJECTS, pruned)
  return pruned
}

// --- Project Discovery ---

function discoverProjects(directories: string[]): Record<string, string> {
  const labelToPath: Record<string, string> = {}
  const labelCount: Record<string, number> = {}
  const excluded = getExcludedDirectories()

  for (const dir of directories) {
    const root = normalizePath(dir)
    scanForProjects(root, root, 0, excluded, labelToPath, labelCount)
  }

  const projects: Record<string, string> = {}
  for (const [path, label] of Object.entries(labelToPath)) {
    const key = labelCount[label] > 1 ? `${label} (${path})` : label
    projects[key] = path
  }
  return projects
}

function scanForProjects(
  root: string,
  directory: string,
  depth: number,
  excluded: Set<string>,
  labelToPath: Record<string, string>,
  labelCount: Record<string, number>,
): void {
  if (depth >= MAX_SCAN_DEPTH) return

  let entries: Dirent[]
  try {
    entries = readdirSync(directory, { withFileTypes: true })
  } catch {
    return
  }

  let hasGit = false
  const subdirectories: Dirent[] = []

  for (const entry of entries) {
    if (entry.name === ".git") {
      hasGit = true
      break
    }
    if (entry.isDirectory() && !entry.name.startsWith(".") && !excluded.has(entry.name)) {
      subdirectories.push(entry)
    }
  }

  if (hasGit) {
    const path = normalizePath(directory)
    const label = toProjectLabel(root, path)
    labelCount[label] = (labelCount[label] || 0) + 1
    labelToPath[path] = label
  } else {
    for (const entry of subdirectories) {
      scanForProjects(root, join(directory, entry.name), depth + 1, excluded, labelToPath, labelCount)
    }
  }
}

// --- Configuration ---

function getConfiguredDirectories(): string[] {
  return vscode.workspace.getConfiguration().get(SETTING_PROJECT_DIRECTORIES) || []
}

function getExcludedDirectories(): Set<string> {
  const patterns: Record<string, boolean> = vscode.workspace.getConfiguration("search").get("exclude", {})
  const excluded = new Set<string>()
  for (const [pattern, enabled] of Object.entries(patterns)) {
    if (!enabled) continue
    const match = pattern.match(/^(?:\*\*\/)?([^/*]+)$/)
    if (match) excluded.add(match[1])
  }
  return excluded
}

// --- Path Utilities ---

function findLongestMatchingRoot(directories: string[], windowPath: string): string | undefined {
  let bestMatch: string | undefined
  for (const directory of directories) {
    const normalized = normalizePath(directory)
    const withSlash = normalized.endsWith("/") ? normalized : normalized + "/"
    if (windowPath.startsWith(withSlash) && (!bestMatch || normalized.length > bestMatch.length)) {
      bestMatch = normalized
    }
  }
  return bestMatch
}

function toProjectLabel(root: string, projectPath: string): string {
  return relative(join(root, ".."), projectPath)
}

function normalizePath(path: string): string {
  path = untildify(path)
  path = path.replace(/^\/([a-zA-Z]):\//, "$1:/")
  return path.replace(/\\/g, "/")
}
