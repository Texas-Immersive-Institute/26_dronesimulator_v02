import { create } from 'zustand'
import { produce, type Draft } from 'immer'
import { newProject } from '../model/defaults'
import { lastLandingTime } from '../model/path'
import type { PresetPointId } from '../model/presets'
import type { Drone, Project, Waypoint } from '../model/types'

const UNDO_LIMIT = 200

/** A part of the Stage that can be clicked and moved in the 3D view. */
export type StagePart = 'room' | 'net' | 'projection' | 'audience'

export type Selection =
  | { kind: 'project' }
  | { kind: 'stage'; part?: StagePart }
  /** `point` is a Path Preset point (A, B, centre…) picked in the 3D view. */
  | { kind: 'drone'; droneId: string; point?: PresetPointId }
  | { kind: 'waypoint'; droneId: string; waypointId: string; handle: 'in' | 'out' | null }

export type ViewMode = 'perspective' | 'top' | 'front' | 'side'

type Recipe = (draft: Draft<Project>) => void

interface EditorState {
  project: Project
  past: Project[]
  future: Project[]
  /** The snapshot pushed when the current drag or typing gesture began. */
  gestureStart: Project | null
  dirty: boolean
  /** Name of the Project folder on disk, or null if never saved. */
  folderName: string | null

  selection: Selection
  time: number
  playing: boolean
  view: ViewMode
  /** Short message shown in the status bar. */
  notice: string | null
  /** Key of the object under the mouse in the 3D view (see selectionKey). */
  hovered: string | null
  /** Bumped to ask the 3D camera to frame the selection. */
  focusRequest: number

  /** Make one undoable change. */
  edit(recipe: Recipe): void
  /** Start a drag or typing gesture: every change until endGesture() is one undo step. */
  beginGesture(): void
  editLive(recipe: Recipe): void
  endGesture(): void
  undo(): void
  redo(): void

  loadProject(project: Project, folderName: string | null, dirty?: boolean): void
  markSaved(folderName: string): void

  select(selection: Selection): void
  setTime(time: number): void
  setPlaying(playing: boolean): void
  setView(view: ViewMode): void
  notify(message: string | null): void
  setHovered(key: string | null): void
  requestFocus(): void
}

export const useEditor = create<EditorState>()((set, get) => ({
  project: newProject(),
  past: [],
  future: [],
  gestureStart: null,
  dirty: false,
  folderName: null,

  selection: { kind: 'project' },
  time: 0,
  playing: false,
  view: 'perspective',
  notice: null,
  hovered: null,
  focusRequest: 0,

  edit(recipe) {
    const { project, past, gestureStart } = get()
    if (gestureStart) {
      get().editLive(recipe)
      return
    }
    const next = produce(project, recipe)
    if (next === project) return
    set({ project: next, past: [...past, project].slice(-UNDO_LIMIT), future: [], dirty: true })
  },

  beginGesture() {
    if (get().gestureStart) return
    set({ gestureStart: get().project })
  },

  editLive(recipe) {
    const { project } = get()
    const next = produce(project, recipe)
    if (next === project) return
    set({ project: next, dirty: true })
  },

  endGesture() {
    const { gestureStart, project, past } = get()
    if (!gestureStart) return
    if (gestureStart === project) {
      set({ gestureStart: null })
      return
    }
    set({ gestureStart: null, past: [...past, gestureStart].slice(-UNDO_LIMIT), future: [] })
  },

  undo() {
    get().endGesture()
    const { past, project, future } = get()
    const prev = past[past.length - 1]
    if (!prev) return
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future], dirty: true })
  },

  redo() {
    get().endGesture()
    const { past, project, future } = get()
    const next = future[0]
    if (!next) return
    set({ project: next, past: [...past, project], future: future.slice(1), dirty: true })
  },

  loadProject(project, folderName, dirty = false) {
    set({
      project,
      folderName,
      dirty,
      past: [],
      future: [],
      gestureStart: null,
      selection: { kind: 'project' },
      time: 0,
      playing: false
    })
  },

  markSaved(folderName) {
    set({ folderName, dirty: false })
  },

  select(selection) {
    set({ selection })
  },
  setTime(time) {
    set({ time: Math.max(0, time) })
  },
  setPlaying(playing) {
    set({ playing })
  },
  setView(view) {
    set({ view })
  },
  notify(notice) {
    set({ notice })
  },
  setHovered(hovered) {
    if (get().hovered !== hovered) set({ hovered })
  },
  requestFocus() {
    set({ focusRequest: get().focusRequest + 1 })
  }
}))

/** A string that identifies what a Selection points at, for hover and highlight checks. */
export function selectionKey(s: Selection): string {
  switch (s.kind) {
    case 'project':
      return 'project'
    case 'stage':
      return `stage:${s.part ?? ''}`
    case 'drone':
      return `drone:${s.droneId}:${s.point ?? ''}`
    case 'waypoint':
      return `waypoint:${s.waypointId}:${s.handle ?? ''}`
  }
}

// ---- Selectors ----

/** The end of the Timeline: the Show's duration, or the last landing if that is later. */
export const timelineEnd = (p: Project): number => Math.max(p.show.duration, lastLandingTime(p.show.drones))

export function findDrone(p: Project, droneId: string): Drone | undefined {
  return p.show.drones.find((d) => d.id === droneId)
}

export function findWaypoint(p: Project, droneId: string, waypointId: string): { drone: Drone; index: number; waypoint: Waypoint } | undefined {
  const drone = findDrone(p, droneId)
  if (!drone) return undefined
  const index = drone.waypoints.findIndex((w) => w.id === waypointId)
  if (index < 0) return undefined
  return { drone, index, waypoint: drone.waypoints[index] }
}

/** Find a Drone inside an immer draft. */
export function draftDrone(draft: Draft<Project>, droneId: string): Draft<Drone> | undefined {
  return draft.show.drones.find((d) => d.id === droneId)
}

/** The id of the selected Drone, whether the Drone or one of its Waypoints is selected. */
export function selectedDroneId(s: Selection): string | null {
  return s.kind === 'drone' || s.kind === 'waypoint' ? s.droneId : null
}
