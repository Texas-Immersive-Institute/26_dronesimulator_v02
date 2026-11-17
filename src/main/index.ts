import { app, BrowserWindow, dialog, ipcMain, Menu, type MenuItemConstructorOptions } from 'electron'
import { basename, join } from 'path'
import { promises as fs } from 'fs'
import { ASSETS_DIR_NAME, PROJECT_FILE_NAME, type OpenedProject, type RecoveryData, type SavedProject } from '../shared/api'

/** The Project folder currently open in the window, or null for an unsaved Project. */
let currentProjectDir: string | null = null
let mainWindow: BrowserWindow | null = null

const recoveryFile = (): string => join(app.getPath('userData'), 'recovery.json')

async function writeFileAtomic(path: string, contents: string): Promise<void> {
  const tmp = `${path}.tmp`
  await fs.writeFile(tmp, contents, 'utf8')
  await fs.rename(tmp, path)
}

async function writeProject(dir: string, json: string): Promise<void> {
  await fs.mkdir(join(dir, ASSETS_DIR_NAME), { recursive: true })
  await writeFileAtomic(join(dir, PROJECT_FILE_NAME), json)
}

async function chooseNewProjectDir(suggestedName: string): Promise<string | null> {
  if (!mainWindow) return null
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Project',
    buttonLabel: 'Save Project',
    defaultPath: suggestedName || 'Untitled Show',
    properties: ['createDirectory', 'showOverwriteConfirmation']
  })
  if (result.canceled || !result.filePath) return null
  return result.filePath
}

async function saveAs(json: string, suggestedName: string): Promise<SavedProject | null> {
  const dir = await chooseNewProjectDir(suggestedName)
  if (!dir) return null
  await writeProject(dir, json)
  currentProjectDir = dir
  return { folderName: basename(dir) }
}

function registerIpc(): void {
  ipcMain.handle('project:new', () => {
    currentProjectDir = null
  })

  ipcMain.handle('project:save', async (_e, json: string, suggestedName: string) => {
    if (!currentProjectDir) return saveAs(json, suggestedName)
    await writeProject(currentProjectDir, json)
    return { folderName: basename(currentProjectDir) } satisfies SavedProject
  })

  ipcMain.handle('project:saveAs', (_e, json: string, suggestedName: string) => saveAs(json, suggestedName))

  ipcMain.handle('project:open', async (): Promise<OpenedProject | null> => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open Project folder',
      buttonLabel: 'Open Project',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const dir = result.filePaths[0]
    let json: string
    try {
      json = await fs.readFile(join(dir, PROJECT_FILE_NAME), 'utf8')
    } catch {
      throw new Error(`"${basename(dir)}" is not a Project folder (no ${PROJECT_FILE_NAME} inside).`)
    }
    currentProjectDir = dir
    return { folderName: basename(dir), json }
  })

  ipcMain.handle('recovery:write', async (_e, json: string, folderName: string | null) => {
    const data: RecoveryData = { savedAt: new Date().toISOString(), folderName, json }
    await writeFileAtomic(recoveryFile(), JSON.stringify(data))
  })

  ipcMain.handle('recovery:read', async (): Promise<RecoveryData | null> => {
    try {
      return JSON.parse(await fs.readFile(recoveryFile(), 'utf8')) as RecoveryData
    } catch {
      return null
    }
  })

  ipcMain.handle('recovery:clear', async () => {
    await fs.rm(recoveryFile(), { force: true })
  })
}

function buildMenu(): void {
  // Undo/redo and other shortcuts are handled by the app itself, so the menu only
  // keeps text-editing basics (and the standard app menu on Mac).
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'Edit',
      submenu: [{ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }]
    },
    {
      label: 'View',
      submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'togglefullscreen' }]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#1b1d22',
    title: 'Drone Show Simulator',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })

  // The renderer blocks closing while there are unsaved changes; ask here instead.
  mainWindow.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(mainWindow!, {
      type: 'warning',
      buttons: ['Close without saving', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message: 'This Project has unsaved changes.',
      detail: 'If you close now, they can still be recovered the next time you open the app.'
    })
    if (choice === 0) event.preventDefault()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpc()
  buildMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
