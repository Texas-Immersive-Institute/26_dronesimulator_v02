import { contextBridge, ipcRenderer } from 'electron'
import type { ProjectApi } from '../shared/api'

const api: ProjectApi = {
  newProject: () => ipcRenderer.invoke('project:new'),
  save: (json, suggestedName) => ipcRenderer.invoke('project:save', json, suggestedName),
  saveAs: (json, suggestedName) => ipcRenderer.invoke('project:saveAs', json, suggestedName),
  open: () => ipcRenderer.invoke('project:open'),
  writeRecovery: (json, folderName) => ipcRenderer.invoke('recovery:write', json, folderName),
  readRecovery: () => ipcRenderer.invoke('recovery:read'),
  clearRecovery: () => ipcRenderer.invoke('recovery:clear')
}

contextBridge.exposeInMainWorld('projectApi', api)
