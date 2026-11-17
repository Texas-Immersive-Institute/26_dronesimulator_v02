import { useEffect } from 'react'
import { departureTime } from './model/path'
import { addWaypointAtPlayhead, deleteDrone, deleteSelectedWaypoint, duplicateSelectedDrone } from './panels/Inspector'
import { saveProjectAction } from './platform/projectActions'
import { findDrone, selectedDroneId, timelineEnd, useEditor } from './store/editorStore'

/** Advance the playhead in real time while playing; stop at the end of the Timeline. */
export function usePlayback(): void {
  const playing = useEditor((s) => s.playing)
  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const { time, project, setTime } = useEditor.getState()
    if (time >= timelineEnd(project)) setTime(0)
    const tick = (now: number): void => {
      const s = useEditor.getState()
      const end = timelineEnd(s.project)
      const next = s.time + (now - last) / 1000
      last = now
      if (next >= end) {
        s.setTime(end)
        s.setPlaying(false)
        return
      }
      s.setTime(next)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])
}

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)

export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const s = useEditor.getState()
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (mod && key === 's') {
        e.preventDefault()
        void saveProjectAction(e.shiftKey)
        return
      }
      if (isTyping(e.target)) return

      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
        return
      }
      if (mod && key === 'y') {
        e.preventDefault()
        s.redo()
        return
      }
      if (mod && key === 'd') {
        e.preventDefault()
        duplicateSelectedDrone()
        return
      }
      if (mod) return

      // Blender-style numpad views.
      switch (e.code) {
        case 'Numpad7':
          s.setView('top')
          return
        case 'Numpad1':
          s.setView('front')
          return
        case 'Numpad3':
          s.setView('side')
          return
        case 'Numpad5':
          s.setView('perspective')
          return
        case 'NumpadDecimal':
          s.requestFocus()
          return
      }

      switch (key) {
        case ' ':
          e.preventDefault()
          s.setPlaying(!s.playing)
          break
        case 'home':
          s.setTime(0)
          break
        case 'delete':
        case 'backspace':
          if (s.selection.kind === 'drone' && !s.selection.point) deleteDrone(s.selection.droneId)
          else deleteSelectedWaypoint()
          break
        case '.':
          s.requestFocus()
          break
        case 'i': {
          // Like inserting a keyframe: add a Waypoint for the selected Drone at the playhead.
          const id = selectedDroneId(s.selection)
          if (id) addWaypointAtPlayhead(id)
          break
        }
        case 'arrowleft':
        case 'arrowright': {
          e.preventDefault()
          s.setPlaying(false)
          const stepBy = (e.shiftKey ? 1 : 0.1) * (key === 'arrowleft' ? -1 : 1)
          s.setTime(Math.min(Math.round((s.time + stepBy) * 100) / 100, timelineEnd(s.project)))
          break
        }
        case 'arrowup':
        case 'arrowdown': {
          // Jump the playhead to the selected Drone's previous / next Waypoint (or any Drone's).
          e.preventDefault()
          s.setPlaying(false)
          const id = selectedDroneId(s.selection)
          const drones = id ? [findDrone(s.project, id)].filter((d) => d !== undefined) : s.project.show.drones
          const times = drones.flatMap((d) => d.waypoints.flatMap((w) => (w.hold > 0 ? [w.time, departureTime(w)] : [w.time])))
          const next =
            key === 'arrowdown'
              ? Math.min(...times.filter((t) => t > s.time + 1e-6))
              : Math.max(...times.filter((t) => t < s.time - 1e-6))
          if (Number.isFinite(next)) s.setTime(next)
          break
        }
        case 'escape':
          s.select({ kind: 'project' })
          break
        case 'p':
          s.setView('perspective')
          break
        case 't':
          s.setView('top')
          break
        case 'f':
          s.setView('front')
          break
        case 's':
          s.setView('side')
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** Block closing the window while there are unsaved changes (Electron then asks the user). */
export function useUnsavedGuard(): void {
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (useEditor.getState().dirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])
}
