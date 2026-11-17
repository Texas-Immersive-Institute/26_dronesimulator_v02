// Saving and opening Projects. In the desktop app this goes through Electron
// (a Project folder on disk). When the UI runs in a plain browser for testing, it
// falls back to localStorage so the same flows can be exercised.

import type { ProjectApi, RecoveryData } from '../../../shared/api'

declare global {
  interface Window {
    projectApi?: ProjectApi
  }
}

const BROWSER_PROJECT_KEY = 'dss:browser-project'
const BROWSER_RECOVERY_KEY = 'dss:recovery'

const browserApi: ProjectApi = {
  async newProject() {},
  async save(json, suggestedName) {
    localStorage.setItem(BROWSER_PROJECT_KEY, JSON.stringify({ folderName: suggestedName, json }))
    return { folderName: suggestedName }
  },
  async saveAs(json, suggestedName) {
    return browserApi.save(json, suggestedName)
  },
  async open() {
    const raw = localStorage.getItem(BROWSER_PROJECT_KEY)
    if (!raw) throw new Error('No Project saved in this browser yet.')
    return JSON.parse(raw)
  },
  async writeRecovery(json, folderName) {
    const data: RecoveryData = { savedAt: new Date().toISOString(), folderName, json }
    localStorage.setItem(BROWSER_RECOVERY_KEY, JSON.stringify(data))
  },
  async readRecovery() {
    const raw = localStorage.getItem(BROWSER_RECOVERY_KEY)
    return raw ? (JSON.parse(raw) as RecoveryData) : null
  },
  async clearRecovery() {
    localStorage.removeItem(BROWSER_RECOVERY_KEY)
  }
}

export const projectApi: ProjectApi = window.projectApi ?? browserApi
export const isDesktop = window.projectApi !== undefined
