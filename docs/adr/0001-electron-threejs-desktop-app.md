# Desktop app built with Electron and Three.js

The simulator must run as a desktop app on both Windows and Mac for a small team, with heavily custom editing tools (a 3D Waypoint editor, a multi-track Timeline, inspectors). We chose one Electron + Three.js codebase over Unity, Blender/Skybrush Studio and Godot. Custom editing UI is far faster to build with web tech than in a Unity runtime build. Blender/Skybrush is designed for large outdoor shows and would force the Blender interface on the team. Electron ships the same Chromium renderer on both operating systems, so the 3D view looks identical on each, which Tauri's per-OS webviews do not guarantee.

## Consequences

- Larger install size than Tauri, which we accept for consistent rendering.
- Mac builds can be produced in CI (GitHub macOS runners), but signing, notarisation and real testing still need a Mac.
