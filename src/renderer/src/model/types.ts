// The Project data model. Names follow CONTEXT.md.
// Coordinates are metres. The origin is the centre of the Stage floor; +Y is up,
// +X is to the right and +Z points toward the front wall as seen from the back.

export type Vec3 = [number, number, number]

/** A wall of the Stage. */
export type Wall = 'front' | 'back' | 'left' | 'right'

export type DroneModelId = 'DEXI-5' | 'DEXI-3'

export type WaypointKind = 'takeoff' | 'air' | 'landing'

/** The shape of the Segment leaving a Waypoint toward the next one. */
export type SegmentType = 'linear' | 'bezier'

export interface Waypoint {
  id: string
  kind: WaypointKind
  /** Arrival time on the Timeline, in seconds. */
  time: number
  /** How long the Drone stays here before moving on, in seconds. */
  hold: number
  position: Vec3
  /** Bezier handle toward the previous Waypoint, relative to `position`. Its length is the weight. */
  inHandle: Vec3
  /** Bezier handle toward the next Waypoint, relative to `position`. Its length is the weight. */
  outHandle: Vec3
  /** Shape of the Segment from this Waypoint to the next. */
  segment: SegmentType
  /** When true, moving one handle keeps the other pointing the opposite way (a smooth corner). */
  handlesLinked: boolean
}

export interface Drone {
  id: string
  /** D1–D10. */
  number: number
  name: string
  /** Colour of this Drone's Path line and Timeline track in the editor (not its Light). */
  editorColor: string
  /** [x, z] on the Stage floor. */
  takeoffSpot: [number, number]
  /** Ordered by time: one takeoff, any number of air Waypoints, one landing. */
  waypoints: Waypoint[]
  /**
   * The Path Preset this Drone's Path was generated from, if any. Changing it
   * regenerates the Waypoints. Absent for a hand-drawn Path.
   */
  preset?: PathPreset
}

export type PathPresetKind = 'hover' | 'backAndForth' | 'circle' | 'figureEight'

/** Timing shared by every Path Preset. */
interface PresetTiming {
  /** Time the Drone leaves its Takeoff Spot, in seconds. */
  start: number
  /** Time to fly from the Takeoff Spot up to the pattern, and from the pattern back down, in seconds. */
  transit: number
}

/** Take off, fly to one point, hold there, land. */
export interface HoverPreset extends PresetTiming {
  kind: 'hover'
  point: Vec3
  hold: number
}

/** Fly between point A and point B, holding at each end. */
export interface BackAndForthPreset extends PresetTiming {
  kind: 'backAndForth'
  a: Vec3
  b: Vec3
  /** Time for one leg (A to B or B to A), not counting Holds. */
  legTime: number
  /** Hold at each end. */
  hold: number
  /** Number of legs. 1 = A to B, 2 = A to B and back, and so on. */
  legs: number
}

/** Fly level circles around a centre point. */
export interface CirclePreset extends PresetTiming {
  kind: 'circle'
  center: Vec3
  radius: number
  lapTime: number
  laps: number
  clockwise: boolean
  /** Where on the circle the Drone joins it, in degrees (0 = +X, 90 = +Z). */
  angle: number
}

/** Fly a level figure eight around a centre point. */
export interface FigureEightPreset extends PresetTiming {
  kind: 'figureEight'
  center: Vec3
  /** End-to-end width of the eight; its depth is half of this. */
  width: number
  lapTime: number
  laps: number
  /** Rotation of the eight about the vertical, in degrees. */
  angle: number
}

export type PathPreset = HoverPreset | BackAndForthPreset | CirclePreset | FigureEightPreset

export interface SafetyNet {
  placement: 'side' | 'overhead'
  /** For a side net: the wall the Audience Area is against. */
  side: Wall
  /** For a side net: distance from that wall, in metres. */
  distance: number
  /** For an overhead net: height above the floor, in metres. */
  height: number
}

export interface ProjectionSurface {
  wall: Wall
  /** Horizontal offset of the image centre from the middle of the wall, in metres. */
  offset: number
  /** Height of the bottom edge above the floor, in metres. */
  bottom: number
  width: number
  height: number
}

/** A rectangle on the floor: centre [x, z] and size. */
export interface AudienceArea {
  x: number
  z: number
  width: number
  depth: number
}

export interface Stage {
  width: number
  depth: number
  height: number
  net: SafetyNet
  projection: ProjectionSurface
  audience: AudienceArea
}

export interface Show {
  /** Length of the Show in seconds. */
  duration: number
  droneModel: DroneModelId
  drones: Drone[]
}

export interface Project {
  formatVersion: 1
  name: string
  stage: Stage
  show: Show
}
