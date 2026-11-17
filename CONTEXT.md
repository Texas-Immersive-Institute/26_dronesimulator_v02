# Drone Show Simulator

A desktop tool for a small team to design, rehearse and review an indoor live drone show before flying it. A real-scale, realistic simulation of 5–10 drones flying choreography authored ahead of time, next to a projected image.

## Language

### The show

**Show**:
One choreographed performance: the drones, their movements and lights over time, the projection content and any audio. It is authored ahead of time and plays back the same way every time.
_Avoid_: Simulation, mission, flight plan

**Timeline**:
The single clock a Show plays against, measured in seconds from the start of the Show.
_Avoid_: Sequence, track

### The space

**Stage**:
The indoor performance space the drones fly in, modelled at real-world dimensions in metres. Its walls, floor and ceiling are hard limits.
_Avoid_: Arena, field, map, world

**Safety Net**:
The physical net separating the drones from the audience, hung either overhead or along one side of the Stage. Drones must never cross it.
_Avoid_: Barrier, fence, cage

**Audience Area**:
The part of the venue on the far side of the Safety Net where spectators watch from.
_Avoid_: Crowd, seating

**Projection**:
A flat 2D image or video projected onto a wall next to the drones, which is part of what the audience sees during the Show.
_Avoid_: Backdrop, screen, background

**Takeoff Spot**:
The place on the Stage floor where a Drone starts and finishes the Show.
_Avoid_: Pad, home, launch point

### The drones

**Drone**:
One physical aircraft taking part in a Show, simulated at its real size.
_Avoid_: Unit, agent, vehicle, UAV

**Drone Model**:
The type of hardware a Drone is (currently DEXI-3 or DEXI-5), which sets its physical size and flight limits. Every Drone in a Show is the same Drone Model.
_Avoid_: Drone type, airframe, class

**Light**:
The single light on a Drone, which shows one colour at a time.
_Avoid_: LED ring, pixel

### Choreography

**Path**:
The route one Drone flies through the Stage over the Timeline, defined by its Waypoints.
_Avoid_: Route, trajectory, flight plan, track

**Waypoint**:
A keyframe in the air: a point on a Path that the Drone must reach at a set time on the Timeline, and that can be moved in 3D.
_Avoid_: Anchor, node, control point

**Hold**:
How long a Drone stays at a Waypoint before moving on.
_Avoid_: Dwell, pause, wait

**Segment**:
The part of a Path between two neighbouring Waypoints. It is either linear or a Bezier curve whose handles and weights shape how smooth or direct the move is.
_Avoid_: Leg, edge, span

**Path Preset**:
A ready-made Path (hover, back and forth between two points, circle, figure eight) generated from a few settings such as points, times and laps. Changing a setting regenerates the Drone's Waypoints. Once the Waypoints are edited by hand they no longer match the preset.
_Avoid_: Flight preset, pattern, template, macro

**Takeoff** / **Landing**:
The first and last moves of every Drone's Path, from and back to its Takeoff Spot.
_Avoid_: Launch, touchdown

**Light Cue**:
A change to one Drone's Light at a set time on the Timeline: a cut, fade, strobe, pulse or off.
_Avoid_: Light keyframe, colour change

**Marker**:
A named time on the Timeline placed by hand (for example on a beat of the audio) that Waypoints and Light Cues can snap to.
_Avoid_: Beat, cue point

### Simulation

**Flight**:
What the simulated Drone actually does while trying to follow its Path within its Drone Model's limits, including tilt, lag, overshoot and drift.
_Avoid_: Actual path, trajectory, playback

**Violation**:
A place in a Show where a Path asks for more than the Drone Model can do, a Flight crosses the Safety Net or leaves the Stage, or two Drones touch. It is flagged in red.
_Avoid_: Error, warning, conflict

### Saving

**Project**:
The saved file that holds exactly one Show and everything it needs: the Stage, Drones, Paths, timings, Light Cues and copies of assets such as Projection media and audio. Separate acts are separate Projects. Teammates take turns editing a Project, never at the same time.
_Avoid_: Session, scene, save, situation
