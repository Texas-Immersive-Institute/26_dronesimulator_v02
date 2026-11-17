# The Path is the intent; the Flight is simulated from it

A Drone's Path is what the choreographer asks for. Playback runs a simulated Drone that tries to follow the Path within its Drone Model's limits, producing a separate Flight with realistic tilt, lag, overshoot and drift. We chose this over playing the Path back exactly because the point of the tool is to see, before show night, where real drones will not do what was drawn. Wherever the Path asks for more than the Drone can do, we flag it in red and never silently re-time or correct it. The choreographer stays the one who fixes it.

## Consequences

- Two things are drawn for each Drone: the Path, and where it actually flew.
- Safety checks (the Safety Net, spacing) must run on the Flight, not just the Path.
