# Decisions

Record decisions that would otherwise be costly to rediscover. Larger architecture decisions are written up in full in `docs/adr/`.

## 2026-11-10 — Electron + Three.js desktop app

**Context:** The team needs Windows and Mac builds and a lot of custom editing interface.

**Decision:** One Electron + Three.js codebase. See [ADR 0001](docs/adr/0001-electron-threejs-desktop-app.md).

**Consequences:** The 3D view looks the same on both operating systems and the interface is quick to build. The app is larger to install than a Tauri one, and Mac signing still needs a Mac.

## 2026-11-10 — Path is intent, Flight is simulated

**Context:** The tool exists to show where real drones won't do what was drawn.

**Decision:** Simulate a Flight that follows each Path within the drone's limits, and flag Violations in red. Never auto-correct. See [ADR 0002](docs/adr/0002-path-is-intent-flight-is-simulated.md).

**Consequences:** Every Drone has two lines, the Path and the Flight, and the safety checks run on the Flight.

## 2026-11-10 — Scope boundaries

**Context:** The team wanted to keep the first versions focused.

**Decision:**
- No exporting flight plans to real drones.
- One Show per Project, with separate acts as separate Projects.
- One Drone Model per Show, either DEXI-3 or DEXI-5, using published sizes only and no custom models.
- No obstacles on the Stage.
- No minimum clearance from the Safety Net, only a hard line.
- No automatic beat detection.
- No simultaneous editing.
- No realistic venue look.

**Consequences:** The data model stays simple. Any of these can be revisited, but each one changes the Project file format.

## 2026-11-10 — React Three Fiber for the editor interface

**Context:** The app is mostly custom editing interface (inspector, Timeline, 3D gizmos) built on top of Three.js.

**Decision:** React with React Three Fiber and drei for the 3D scene, zustand + immer for editor state, and undo as snapshots of the whole Project.

**Consequences:** The 3D scene and the panels share one state store, and undo/redo is simple and reliable. Snapshot undo is fine at 5–10 Drones but would need rethinking for much larger Shows.

## 2026-11-14 — Path Presets are stored and regenerate the Path

**Context:** The team wants quick ready-made moves (A to B and back, circles…) whose times and points stay easy to change after they are added.

**Decision:** A Drone can carry an optional `preset` (hover, back and forth, circle, figure eight) in the Project file. Changing a preset setting regenerates all of that Drone's Waypoints. Hand edits are allowed. The inspector detects them by comparing the Waypoints with what the preset would generate, warns that the next preset change will replace them, and offers "Keep my edits" (drop the preset, keep the Waypoints). Presets produce a Path like any other, so ADR 0002 still holds: the Flight and Violations will be simulated from it.

**Consequences:** Older Project files open unchanged, since `preset` is optional, and a malformed preset is dropped on load while its Waypoints are kept. A preset fills one Drone's whole Path. Chaining several presets on one Drone would need a different model.

## 2026-11-14 — Viewport picking by priority; dragging a Drone auto-keys

**Context:** The Safety Net and Projection are large see-through surfaces that sit in front of the Drones from most camera angles. The team asked for Blender-like selecting and moving.

**Decision:** Every selectable 3D object carries a pick priority (handle > preset point > Drone > Waypoint > Takeoff Spot > Projection / Audience Area > net). A click selects the highest-priority object under the mouse, then the nearest. Dragging a selected Drone acts at the playhead: it moves the Takeoff Spot on the floor, moves the Waypoint it is at, or inserts a Waypoint there.

**Consequences:** Small objects stay clickable through the net. To select the net itself, click a part of it with nothing behind it. Dragging a Drone mid-Segment adds a Waypoint, which the status bar reports, and Ctrl+Z removes it.
