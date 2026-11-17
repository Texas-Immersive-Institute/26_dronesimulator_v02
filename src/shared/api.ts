// The bridge between the app window (renderer) and the Electron main process.
// The renderer never sees raw file paths it can write to: main remembers which
// Project folder is open, so the renderer can only ask to save "the current
// Project" or pick a new folder through a native dialog.

export interface OpenedProject {
  /** Display name of the Project folder. */
  folderName: string
  json: string
}

export interface SavedProject {
  folderName: string
}

export interface RecoveryData {
  savedAt: string
  folderName: string | null
  json: string
}

export interface ProjectApi {
  /** Forget the open Project folder (File > New). */
  newProject(): Promise<void>
  /** Save to the open Project folder, or ask for one if none is open. Null if cancelled. */
  save(json: string, suggestedName: string): Promise<SavedProject | null>
  /** Always ask for a new Project folder. Null if cancelled. */
  saveAs(json: string, suggestedName: string): Promise<SavedProject | null>
  /** Ask for a Project folder and read it. Null if cancelled. */
  open(): Promise<OpenedProject | null>
  writeRecovery(json: string, folderName: string | null): Promise<void>
  readRecovery(): Promise<RecoveryData | null>
  clearRecovery(): Promise<void>
}

export const PROJECT_FILE_NAME = 'project.json'
export const ASSETS_DIR_NAME = 'assets'
