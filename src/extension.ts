"use strict"

import * as vscode from "vscode"

const { lstatSync, readdirSync } = require("fs")
const { join, relative } = require("path")
const untildify = require("untildify")

const PROJECT_DIRECTORTIES_SETTING_KEY = "simple-project-switcher.projectDirectories"

export function activate(context: vscode.ExtensionContext) {
  try {
    validateConfig(context)
    // Check if current window path is a project directory. If so, add it to the recent projects list.
    const currentWindowPath = normalizePath(vscode.workspace.workspaceFolders[0].uri.path)
    const relativeProjectDirectory = normalizePath(
      config(PROJECT_DIRECTORTIES_SETTING_KEY, []).find(directory => {
        const normalizedDirectory = normalizePath(directory)
        return currentWindowPath.startsWith(normalizedDirectory)
      }) || ""
    )
    if (relativeProjectDirectory) {
      const currentProjectDirectory = pathRelativeToProjectDirectory(relativeProjectDirectory, currentWindowPath)
      updateMostRecentProject(context, currentProjectDirectory)
      vscode.window.onDidChangeWindowState(function (event) {
        if (event.focused) updateMostRecentProject(context, currentProjectDirectory)
      })
    }
    let disposable = vscode.commands.registerCommand("simple-project-switcher.switch", () => {
      let recentlyAccessedProjects = context.globalState.get("simple-project-switcher.recent", [])

      if (!vscode.workspace.workspaceFolders && !recentlyAccessedProjects) {
        vscode.window.showErrorMessage("Project Switcher requires at least one folder to be open.")
        return
      }

      let projects = getProjectsFromDirectories(config(PROJECT_DIRECTORTIES_SETTING_KEY, []))
      let projectsSortedByRecentlyAccessed = Array.from(new Set(recentlyAccessedProjects.concat(Object.keys(projects))))

      const quickPick = vscode.window.createQuickPick()

      quickPick.items = projectsSortedByRecentlyAccessed.map(project => ({
        label: project,
        project: project,
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

    context.subscriptions.push(disposable)
  } catch (error) {
    let disposable = vscode.commands.registerCommand("simple-project-switcher.switch", () => {
      vscode.window.showErrorMessage(error.message)
    })
    context.subscriptions.push(disposable)
  }
}

function getProjectsFromDirectories(directories) {
  return directories.reduce((projects, projectDirectory) => {
    let directory = normalizePath(projectDirectory)
    return {
      ...projects,
      ...readdirSync(directory).reduce((projects, name) => {
        let path = join(directory, name)

        if (lstatSync(path).isDirectory() && !path.startsWith(".")) {
          const niceDirectoryName = pathRelativeToProjectDirectory(directory, path)
          projects[niceDirectoryName] = path
        }
        return projects
      }, {}),
    }
  }, {})
}

function validateConfig(context: vscode.ExtensionContext) {
  const vscodeConfig = vscode.workspace.getConfiguration()
  const requiredSettings = [PROJECT_DIRECTORTIES_SETTING_KEY]
  requiredSettings.forEach(setting => {
    if (!vscodeConfig.get(setting)) {
      throw new Error(`The simple-project-switcher extension requires '${setting}' to be set`)
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

function normalizePath(path) {
  path = untildify(path)
  path = path.replace("/c:/", "c:/").replace("/C:/", "C:/")
  // Convert backslashes from windows paths to forward slashes, otherwise the shell will ignore them.
  return path.replace(/\\/g, "/")
}

export function deactivate() {
  //
}
