import { newProject } from '../model/defaults'
import { parseProject, serializeProject } from '../model/serialize'
import { useEditor } from '../store/editorStore'
import { projectApi } from './projectIO'

const AUTOSAVE_DELAY_MS = 2000

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

function confirmDiscard(): boolean {
  return !useEditor.getState().dirty || window.confirm('This Project has unsaved changes. Discard them?')
}

export async function newProjectAction(): Promise<void> {
  if (!confirmDiscard()) return
  await projectApi.newProject()
  await projectApi.clearRecovery()
  useEditor.getState().loadProject(newProject(), null)
  useEditor.getState().notify('New Project')
}

export async function openProjectAction(): Promise<void> {
  if (!confirmDiscard()) return
  const { notify, loadProject } = useEditor.getState()
  try {
    const opened = await projectApi.open()
    if (!opened) return
    loadProject(parseProject(opened.json), opened.folderName)
    await projectApi.clearRecovery()
    notify(`Opened ${opened.folderName}`)
  } catch (e) {
    notify(`Could not open: ${errorText(e)}`)
  }
}

export async function saveProjectAction(saveAs = false): Promise<void> {
  const { project, endGesture, markSaved, notify } = useEditor.getState()
  endGesture()
  try {
    const json = serializeProject(project)
    const saved = saveAs ? await projectApi.saveAs(json, project.name) : await projectApi.save(json, project.name)
    if (!saved) return
    // Only mark clean if nothing changed while the dialog was open.
    if (useEditor.getState().project === project) markSaved(saved.folderName)
    else useEditor.setState({ folderName: saved.folderName })
    await projectApi.clearRecovery()
    notify(`Saved to ${saved.folderName}`)
  } catch (e) {
    notify(`Could not save: ${errorText(e)}`)
  }
}

/** Offer to restore unsaved work left behind by a crash or a close without saving. */
let recoveryChecked = false

export async function checkRecovery(): Promise<void> {
  if (recoveryChecked) return
  recoveryChecked = true
  const data = await projectApi.readRecovery()
  if (!data) return
  const when = new Date(data.savedAt).toLocaleString()
  const name = data.folderName ?? 'an unsaved Project'
  if (window.confirm(`Recover unsaved changes to ${name} from ${when}?`)) {
    try {
      useEditor.getState().loadProject(parseProject(data.json), data.folderName, true)
      useEditor.getState().notify('Recovered unsaved changes. Save to keep them.')
      return
    } catch (e) {
      useEditor.getState().notify(`Could not recover: ${errorText(e)}`)
    }
  }
  await projectApi.clearRecovery()
}

/** Write a recovery copy shortly after each change while there are unsaved changes. */
export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const unsubscribe = useEditor.subscribe((state, prev) => {
    if (state.project === prev.project || !state.dirty) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      const { project, folderName, dirty } = useEditor.getState()
      if (dirty) void projectApi.writeRecovery(serializeProject(project), folderName)
    }, AUTOSAVE_DELAY_MS)
  })
  return () => {
    if (timer) clearTimeout(timer)
    unsubscribe()
  }
}
