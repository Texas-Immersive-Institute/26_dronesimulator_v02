import { useEffect, useState } from 'react'
import { usePlayback, useShortcuts, useUnsavedGuard } from './hooks'
import { Inspector } from './panels/Inspector'
import { Sidebar } from './panels/Sidebar'
import { Timeline } from './panels/Timeline'
import { Toolbar } from './panels/Toolbar'
import { checkRecovery, startAutosave } from './platform/projectActions'
import { useEditor } from './store/editorStore'
import { Viewport } from './viewport/Viewport'

const SHORTCUTS: [string, string][] = [
  ['Click', 'Select a Drone, Waypoint, net, Projection or Audience Area'],
  ['Click empty space / Esc', 'Deselect'],
  ['Drag gizmo arrows', 'Move the selection (hold Ctrl / Cmd to snap to 10 cm)'],
  ['Drag a value', 'Change it live (Shift: fine, Ctrl / Cmd: coarse). Click to type.'],
  ['Left-drag · Right-drag · Wheel', 'Orbit · Pan · Zoom'],
  ['P T F S  or  numpad 5 7 1 3', '3D, Top, Front, Side views'],
  ['.  or  numpad .', 'Frame the selection'],
  ['I', 'Add a Waypoint for the selected Drone at the playhead'],
  ['Ctrl / Cmd + D', 'Duplicate the selected Drone'],
  ['Delete', 'Delete the selected Waypoint or Drone'],
  ['Space · Home', 'Play / pause · Go to start'],
  ['← →', 'Step the playhead 0.1 s (Shift: 1 s)'],
  ['↑ ↓', 'Jump to the previous / next Waypoint'],
  ['Ctrl / Cmd + Z · Shift + Z', 'Undo · Redo']
]

function ShortcutsButton(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <span className="shortcuts">
      <button className="link" onClick={() => setOpen(!open)}>
        Shortcuts {open ? '▾' : '▴'}
      </button>
      {open && (
        <div className="shortcuts-panel" onClick={() => setOpen(false)}>
          <dl>
            {SHORTCUTS.map(([keys, what]) => (
              <div key={keys}>
                <dt>{keys}</dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </span>
  )
}

function StatusBar(): React.JSX.Element {
  const notice = useEditor((s) => s.notice)
  const notify = useEditor((s) => s.notify)
  return (
    <footer className="statusbar">
      <span className="statusbar-notice">{notice}</span>
      {notice && (
        <button className="link" onClick={() => notify(null)}>
          dismiss
        </button>
      )}
      <span className="spacer" />
      <span className="muted">Click to select · Drag arrows to move · Drag values to adjust · I: add Waypoint · Space: play</span>
      <ShortcutsButton />
    </footer>
  )
}

export function App(): React.JSX.Element {
  const name = useEditor((s) => s.project.name)
  const dirty = useEditor((s) => s.dirty)
  usePlayback()
  useShortcuts()
  useUnsavedGuard()

  useEffect(() => {
    void checkRecovery()
    return startAutosave()
  }, [])

  useEffect(() => {
    document.title = `${dirty ? '• ' : ''}${name} · Drone Show Simulator`
  }, [name, dirty])

  return (
    <div className="app">
      <Toolbar />
      <Sidebar />
      <Viewport />
      <Inspector />
      <Timeline />
      <StatusBar />
    </div>
  )
}
