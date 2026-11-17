# Status

_Last updated: 2026-11-14 by Claude Code_

## Current focus

Milestone 1 (editor core) plus an ease-of-use pass is built and needs hands-on testing by the team before Milestone 2 starts.

## Done

- [x] Copied the toolkit templates and added a `CLAUDE.md` that points to `AGENTS.md`.
- [x] Ran the design interview. The result is `CONTEXT.md`, `PROJECT.md` and ADRs 0001–0002.
- [x] Milestone 1, the editor core (Electron + Three.js + React):
  - Stage editor: room size, Safety Net (side or overhead), Projection wall placement and size, Audience Area, Takeoff Spots.
  - Add and remove Drones (D1–D10, optional name, editor colour), drawn as a generic quadcopter at the DEXI-5's published size.
  - Paths: takeoff, air Waypoints, landing, Holds, and linear or Bezier Segments with draggable handles, weights, linked handles, auto handles and "smooth whole Path".
  - 3D editing: click a Waypoint or handle, then drag it with the move gizmo. The takeoff and landing move the Takeoff Spot.
  - Timeline: one track per Drone, play, pause and scrubbing, drag Waypoints to retime, drag Hold bars, double-click to add a Waypoint. Snaps to 0.1 s and the playhead; Shift turns snapping off.
  - Camera: free orbit, pan and zoom, plus flat Top, Front and Side views (P / T / F / S).
  - Project folders (`project.json` + `assets/`): New, Open, Save, Save As, undo and redo, autosave with recovery, and a warning when closing with unsaved changes.
  - 17 unit tests for the Path math and the file format.
- [x] Ease-of-use pass (2026-11-14):
  - Click-to-select in the 3D view, like Blender: Drones, Waypoints, Bezier handles, Takeoff Spots, Path Preset points, the Safety Net, Projection and Audience Area. Hover highlights and a pointer cursor. Overlapping objects are picked by priority, so a Drone behind the see-through net is still clickable. Clicking empty space deselects.
  - Move gizmos for everything selected. The net only slides along its axis, and the Projection along and up its wall. Ctrl/Cmd snaps to 10 cm. A selection chip in the view says what is selected and how to move it.
  - Dragging a Drone moves it at the playhead: on the floor it moves the Takeoff Spot, at a Waypoint (or in its Hold) it moves that Waypoint, and anywhere else it adds a Waypoint there (auto-key). A Drone flying an unedited Path Preset moves the whole pattern.
  - Every number field can be dragged left and right to change it live (Shift fine, Ctrl/Cmd coarse); click to type. One drag is one undo step. Preset points use compact X / Y / Z fields.
  - Path Presets in the Drone inspector: Hover, Back and forth (A ↔ B with leg time, Holds and leg count), Circle (centre, radius, lap time, laps, direction, join angle) and Figure eight (centre, width, lap time, laps, turn). Changing any setting regenerates the Waypoints and Timeline live. The inspector shows the landing time and fastest Segment, warns when the Path leaves the Stage or crosses the Safety Net, and notices when the Path was edited by hand.
  - Duplicate a Drone (Ctrl/Cmd+D, 1 m to the side), Delete removes a selected Drone, Frame (.) centres the camera on the selection, numpad 7/1/3/5 views, I adds a Waypoint at the playhead, ←/→ steps the playhead, ↑/↓ jumps between Waypoints. A Shortcuts list sits in the status bar.
  - 10 more unit tests (27 in all) for presets, Drone dragging and duplicating.

## Next

- [ ] The team tries Milestone 1 and the ease-of-use pass (`npm run dev`) and reports what feels wrong, especially gizmo dragging and value scrubbing with a real mouse.
- [ ] Measure a DEXI-3 (length × width × height). Until then a DEXI-3 Show shows a marker instead of a drone model.
- [ ] Look up PX4's default speed and acceleration limits for the realism checks.
- [ ] Milestone 2: the simulated Flight with Violations, Light Cues, Projection images and video, audio with Markers, and the speed-coloured Path line.

## Risks / blockers

- The DEXI-3 size isn't published, so DEXI-3 Shows can't draw the drone at real size or check for Drones touching.
- Neither DEXI has a published max speed or acceleration, so the realism limits depend on PX4 defaults until confirmed.
- Real mouse dragging of the 3D gizmo, value scrubbing and Timeline markers was only exercised through automated browser input, not by hand.
- Resizing the room does not resize the Audience Area; use "Fill the space behind the Safety Net".
- The console shows a React warning about unmounting a root during render. It comes from the 3D text labels (drei `Html`) and appears on a fresh load before any of this pass's changes are used. It has no visible effect.
- Installers haven't been built yet. Mac builds need a Mac (or a CI Mac runner) for building, signing and testing.
