import { newProjectAction, openProjectAction, saveProjectAction } from '../platform/projectActions'
import { isDesktop } from '../platform/projectIO'
import { useEditor } from '../store/editorStore'

export function Toolbar(): React.JSX.Element {
  const name = useEditor((s) => s.project.name)
  const folderName = useEditor((s) => s.folderName)
  const dirty = useEditor((s) => s.dirty)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const { undo, redo } = useEditor.getState()

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <button onClick={newProjectAction}>New</button>
        <button onClick={openProjectAction}>Open…</button>
        <button onClick={() => saveProjectAction(false)} title="Ctrl+S">
          Save
        </button>
        <button onClick={() => saveProjectAction(true)} title="Ctrl+Shift+S">
          Save As…
        </button>
      </div>
      <div className="toolbar-group">
        <button onClick={undo} disabled={!canUndo} title="Ctrl+Z">
          Undo
        </button>
        <button onClick={redo} disabled={!canRedo} title="Ctrl+Shift+Z">
          Redo
        </button>
      </div>
      <div className="toolbar-title">
        <strong>{name}</strong>
        <span className="muted">{folderName ? ` · ${folderName}` : ' · not saved yet'}</span>
        {dirty && <span className="dirty-dot" title="Unsaved changes" />}
        {!isDesktop && <span className="badge">Browser preview: saves to this browser only</span>}
      </div>
    </header>
  )
}
