# Project: Drone Show Simulator

Terms in **bold** are defined in [CONTEXT.md](CONTEXT.md). Architecture decisions live in [docs/adr/](docs/adr/).

## Purpose

A desktop app for a small team to design and rehearse a real indoor live drone **Show** before flying it. The team draws each **Drone**'s **Path** in a 3D **Stage** at real scale, programs its **Light**, places the **Projection** beside it, and plays it back realistically. That way they can see whether the movements make sense and are safe in real time.

It is not an FPV simulator and does not export flight plans to real drones.

## Goals

- Model the real venue in metres: room size, **Safety Net**, **Projection** wall, **Audience Area**, **Takeoff Spots**.
- Choreograph 5–10 **Drones** (soft limit 10) with timed **Waypoints**, **Holds** and linear or Bezier **Segments**.
- Program each Drone's single Light with **Light Cues**: cut, fade, strobe, pulse, off.
- Play back a realistic **Flight** for each Drone and flag every **Violation** in red.
- Sync the Projection's images and video, plus an audio track with hand-placed **Markers**, to one **Timeline**.
- Save everything for a Show as one **Project** and reopen it later on Windows or Mac.

## Constraints

- **Platforms:** Windows and Mac desktop, one codebase. Electron + Three.js ([ADR 0001](docs/adr/0001-electron-threejs-desktop-app.md)).
- **Units:** metres and seconds everywhere.
- **Hardware:** DEXI-3 or DEXI-5 only, with no custom Drone Models. Every Drone in a Show is the same Drone Model.
- **Collaboration:** a small team takes turns editing; no simultaneous editing.
- **Look:** a clear, readable workspace. It doesn't need to look like the real venue.

## Design

### Stage (defined in the app)

- Room width, depth and ceiling height. The walls, floor and ceiling are hard limits.
- Safety Net: either overhead or along one side, with a position you set. It is a hard line with no clearance margin.
- Projection: which wall it's on, plus its position and size.
- Audience Area on the far side of the net.
- One Takeoff Spot per Drone on the floor.

### Drones

- Added and removed at any time. Each is numbered D1–D10 with an optional name, and gets its own editor colour for its Path line and Timeline track.
- Drawn as a generic quadcopter shape at the Drone Model's real size.
- Battery (can be toggled off): a bar above each Drone while it flies. It counts down from the Drone Model's flight time, and running out is a Violation.

**Drone Model data.** Size and flight time come only from published DroneBlocks figures:

| | DEXI-3 | DEXI-5 |
|---|---|---|
| Size (L × W × H) | **Not published.** Needs a measurement from a real drone. | 368 × 328 × 70 mm. This is from the DEXI-5 PX4 kit product page, though that page's heading says only "DEXI". |
| Props | 3″ tri-blade (Gemfan 3018) | 5.5″ tri-blade |
| Flight time | "10+ min typical" | "~15 min hovering" |
| Max speed / acceleration | Not published | Not published |

Speed and acceleration limits aren't published for either drone. The plan is to use PX4's default multicopter position-control limits, since the DEXIs fly PX4. The actual values still need to be looked up in the PX4 parameter reference and confirmed against what the team sets on the drones.

### Choreography

- Each Path runs Takeoff → Waypoints → Landing, from and back to the Drone's Takeoff Spot.
- A Waypoint is a keyframe in the air: a 3D position and an arrival time, plus an optional Hold.
- Each Segment is either linear or Bezier, with handles and weights you can drag to make the move smoother or more direct.
- The Path line is coloured by speed so fast stretches stand out.
- Light Cues are set per Drone and can snap to Markers and Waypoint times.
- Path Presets (hover, back and forth, circle, figure eight) fill in the Waypoints from a few settings, and regenerate them as the settings change.
- Multi-select tools: move several Drones' Paths together, copy one Path to another Drone with an offset, mirror left to right.

### Simulation ([ADR 0002](docs/adr/0002-path-is-intent-flight-is-simulated.md))

- The Path is what you ask for. The Flight is a simulated Drone following it within the Drone Model's limits, with tilt, lag, overshoot and drift.
- Drift comes out the same on every playback.
- Violations are flagged in red, never silently corrected:
  - the Path asks for more than the Drone can do;
  - a Flight crosses the Safety Net or leaves the Stage;
  - two Drones touch, based on their real size;
  - the battery runs out, when the battery toggle is on.

### Timeline

- Laid out like Premiere or After Effects: one track per Drone with a Waypoint lane and a Light Cue lane, an audio track with its waveform, a Markers lane, and a Projection track for image and video clips.
- Holds show as bars.
- Play, pause and drag through time.
- Markers are placed by hand. There is no automatic beat detection.

### Camera

- Free orbit, pan and zoom in 3D.
- Snaps to flat 90° top, front and side views.
- Click to select Drones, Waypoints, preset points, the Safety Net, Projection and Audience Area, then drag them with a move gizmo, like a 3D animation tool's viewport.

### Project files

- One Project = one Show. Each act is its own Project.
- A Project is a folder holding the project file plus an `assets/` folder with copies of the Projection media and audio, so it opens on any teammate's machine.
- Undo and redo, autosave, and recovery after a crash.

## Milestones

1. **Editor core:** define the Stage, add Drones, draw Paths (Waypoints, Holds, Bezier and linear Segments), use the Timeline (play, pause, drag), free camera with 90° snap views, save and open Projects.
2. **Realism and media:** the simulated Flight and Violations, Light Cues, Projection images and video, audio with Markers.
3. **Polish:** the battery toggle and bars, multi-drone editing tools.

## Key locations

- `CONTEXT.md`: the glossary. Use these terms in code and docs.
- `docs/adr/`: architecture decision records.
- `STATUS.md`, `DECISIONS.md`: current state and key decisions.
- `src/main/`: the Electron main process (windows, file dialogs, saving Project folders, crash recovery).
- `src/preload/`, `src/shared/api.ts`: the bridge between the app window and the main process.
- `src/renderer/src/model/`: the Project data model, Drone Model figures and Path math (with tests).
- `src/renderer/src/store/`: editor state with undo and redo.
- `src/renderer/src/viewport/`: the 3D Stage, Drones, Paths and cameras.
- `src/renderer/src/panels/`: toolbar, Drone list, inspector and Timeline.

## How to verify

To just run the app, double-click `start.bat` (Windows) or `start.command` (Mac). The first run installs dependencies, so it needs Node.js 22+ and an internet connection.

```text
npm install
npm test            # Path math and project file tests
npm run typecheck
npm run dev         # launches the desktop app with live reload
npm run dev:web     # the same UI in a browser at http://localhost:5199 (saves to browser storage only)
npm run dist:win    # Windows installer in release/ (the Mac build must run on a Mac: npm run dist:mac)
```
