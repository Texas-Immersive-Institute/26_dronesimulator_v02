import { DRONE_MODELS } from '../model/droneModels'
import { droneLabel, newId } from '../model/defaults'
import { duplicateDrone } from '../model/duplicate'
import {
  clampHold,
  clampWaypointTime,
  insertWaypointAt,
  autoHandles,
  positionAt,
  segmentSpeed,
  setHandleWeight,
  smoothPath,
  syncTakeoffSpot
} from '../model/path'
import { applyPreset, defaultPreset, PRESET_LABELS, presetMatchesPath, presetWarning } from '../model/presets'
import { WALL_LABELS } from '../model/stageGeometry'
import type { Drone, DroneModelId, PathPreset, PathPresetKind, Wall } from '../model/types'
import { length } from '../model/vec'
import { draftDrone, findDrone, findWaypoint, useEditor, type StagePart } from '../store/editorStore'
import { formatTime } from './format'
import { NumberField, Section, SelectField, TextField, Vec3Field } from './Fields'

const WALL_OPTIONS = (Object.keys(WALL_LABELS) as Wall[]).map((w) => [w, WALL_LABELS[w]] as const)

function ProjectInspector(): React.JSX.Element {
  const project = useEditor((s) => s.project)
  const edit = useEditor((s) => s.edit)
  const spec = DRONE_MODELS[project.show.droneModel]
  return (
    <>
      <Section title="Project">
        <TextField label="Show name" value={project.name} onChange={(v) => edit((d) => void (d.name = v))} />
        <NumberField
          label="Duration"
          unit="s"
          step={1}
          min={1}
          value={project.show.duration}
          onChange={(v) => edit((d) => void (d.show.duration = v))}
        />
      </Section>
      <Section title="Drone Model">
        <SelectField<DroneModelId>
          label="Model"
          value={project.show.droneModel}
          options={[
            ['DEXI-5', 'DEXI-5'],
            ['DEXI-3', 'DEXI-3']
          ]}
          onChange={(v) => edit((d) => void (d.show.droneModel = v))}
        />
        <p className="note">Every Drone in a Show is the same Drone Model.</p>
        <dl className="spec">
          <dt>Size</dt>
          <dd>{spec.size ? `${spec.size.length * 1000} × ${spec.size.width * 1000} × ${spec.size.height * 1000} mm` : 'Not published'}</dd>
          <dt>Props</dt>
          <dd>{spec.propDiameterInches}″</dd>
          <dt>Flight time</dt>
          <dd>{spec.flightTimeMinutes} min</dd>
        </dl>
        <p className={spec.size ? 'note' : 'note note--warn'}>{spec.sizeSource}</p>
        <p className="note">{spec.flightTimeSource}</p>
      </Section>
    </>
  )
}

function StageInspector({ part }: { part?: StagePart }): React.JSX.Element {
  const stage = useEditor((s) => s.project.stage)
  const edit = useEditor((s) => s.edit)
  const { net, projection: p, audience: a } = stage

  const fitAudience = (): void =>
    edit((d) => {
      const s = d.stage
      if (s.net.placement !== 'side') return
      const dist = s.net.distance
      switch (s.net.side) {
        case 'front':
          s.audience = { x: 0, z: s.depth / 2 - dist / 2, width: s.width, depth: dist }
          break
        case 'back':
          s.audience = { x: 0, z: -s.depth / 2 + dist / 2, width: s.width, depth: dist }
          break
        case 'left':
          s.audience = { x: -s.width / 2 + dist / 2, z: 0, width: dist, depth: s.depth }
          break
        case 'right':
          s.audience = { x: s.width / 2 - dist / 2, z: 0, width: dist, depth: s.depth }
          break
      }
    })

  return (
    <>
      <p className="note">Drag any value left or right to resize live. Click the net, Projection or Audience Area in the 3D view to move it.</p>
      <Section title="Room" highlight={part === 'room'}>
        <NumberField label="Width (X)" unit="m" min={1} value={stage.width} onChange={(v) => edit((d) => void (d.stage.width = v))} />
        <NumberField label="Depth (Z)" unit="m" min={1} value={stage.depth} onChange={(v) => edit((d) => void (d.stage.depth = v))} />
        <NumberField label="Ceiling height" unit="m" min={1} value={stage.height} onChange={(v) => edit((d) => void (d.stage.height = v))} />
      </Section>
      <Section title="Safety Net" highlight={part === 'net'}>
        <SelectField
          label="Placement"
          value={net.placement}
          options={[
            ['side', 'Along one side'],
            ['overhead', 'Overhead']
          ]}
          onChange={(v) => edit((d) => void (d.stage.net.placement = v))}
        />
        {net.placement === 'side' ? (
          <>
            <SelectField<Wall> label="Audience wall" value={net.side} options={WALL_OPTIONS} onChange={(v) => edit((d) => void (d.stage.net.side = v))} />
            <NumberField label="Distance from wall" unit="m" min={0} value={net.distance} onChange={(v) => edit((d) => void (d.stage.net.distance = v))} />
          </>
        ) : (
          <NumberField label="Height" unit="m" min={0} value={net.height} onChange={(v) => edit((d) => void (d.stage.net.height = v))} />
        )}
      </Section>
      <Section title="Projection" highlight={part === 'projection'}>
        <SelectField<Wall> label="Wall" value={p.wall} options={WALL_OPTIONS} onChange={(v) => edit((d) => void (d.stage.projection.wall = v))} />
        <NumberField label="Width" unit="m" min={0.1} value={p.width} onChange={(v) => edit((d) => void (d.stage.projection.width = v))} />
        <NumberField label="Height" unit="m" min={0.1} value={p.height} onChange={(v) => edit((d) => void (d.stage.projection.height = v))} />
        <NumberField label="Bottom edge" unit="m" min={0} value={p.bottom} onChange={(v) => edit((d) => void (d.stage.projection.bottom = v))} />
        <NumberField label="Offset along wall" unit="m" value={p.offset} onChange={(v) => edit((d) => void (d.stage.projection.offset = v))} />
      </Section>
      <Section title="Audience Area" highlight={part === 'audience'}>
        <NumberField label="Centre X" unit="m" value={a.x} onChange={(v) => edit((d) => void (d.stage.audience.x = v))} />
        <NumberField label="Centre Z" unit="m" value={a.z} onChange={(v) => edit((d) => void (d.stage.audience.z = v))} />
        <NumberField label="Width (X)" unit="m" min={0.1} value={a.width} onChange={(v) => edit((d) => void (d.stage.audience.width = v))} />
        <NumberField label="Depth (Z)" unit="m" min={0.1} value={a.depth} onChange={(v) => edit((d) => void (d.stage.audience.depth = v))} />
        {net.placement === 'side' && (
          <button className="wide" onClick={fitAudience}>
            Fill the space behind the Safety Net
          </button>
        )}
      </Section>
    </>
  )
}

/** Insert a Waypoint for a Drone at the playhead and select it. */
export function addWaypointAtPlayhead(droneId: string): void {
  const { time, edit, select, notify } = useEditor.getState()
  const id = newId()
  let inserted = false
  edit((d) => {
    const drone = draftDrone(d, droneId)
    if (drone) inserted = insertWaypointAt(drone.waypoints, time, id) !== null
  })
  if (inserted) {
    select({ kind: 'waypoint', droneId, waypointId: id, handle: null })
    notify(null)
  } else {
    notify(`Can't add a Waypoint at ${formatTime(time)}: the playhead is before takeoff, after landing, during a Hold or right next to another Waypoint.`)
  }
}

export function duplicateSelectedDrone(): void {
  const { project, selection, edit, select, notify } = useEditor.getState()
  if (selection.kind !== 'drone' && selection.kind !== 'waypoint') return
  const source = findDrone(project, selection.droneId)
  if (!source) return
  const copy = duplicateDrone(project, source)
  edit((p) => void p.show.drones.push(copy))
  select({ kind: 'drone', droneId: copy.id })
  notify(`Duplicated ${droneLabel(source)} as ${droneLabel(copy)}, 1 m to the side.`)
}

export function deleteDrone(droneId: string): void {
  const { project, edit, select, notify } = useEditor.getState()
  const drone = findDrone(project, droneId)
  if (!drone) return
  edit((p) => void (p.show.drones = p.show.drones.filter((d) => d.id !== droneId)))
  select({ kind: 'project' })
  notify(`Deleted ${droneLabel(drone)}. Ctrl+Z brings it back.`)
}

const PRESET_KINDS = Object.keys(PRESET_LABELS) as PathPresetKind[]

/** Ready-made Paths whose settings regenerate the Waypoints as you change them. */
function PresetSection({ drone }: { drone: Drone }): React.JSX.Element {
  const stage = useEditor((s) => s.project.stage)
  const { edit, notify } = useEditor.getState()
  const preset = drone.preset

  const apply = (kind: PathPresetKind): void => {
    edit((p) => {
      const d = draftDrone(p, drone.id)
      if (!d) return
      d.preset = defaultPreset(kind, d, p.stage, d.preset)
      applyPreset(d)
    })
    notify(`${droneLabel(drone)} now flies the ${PRESET_LABELS[kind]} preset. Ctrl+Z puts the old Path back.`)
  }
  const update = (fn: (pr: PathPreset) => void): void =>
    edit((p) => {
      const d = draftDrone(p, drone.id)
      if (!d?.preset) return
      fn(d.preset as PathPreset)
      applyPreset(d)
    })
  const detach = (): void =>
    edit((p) => {
      const d = draftDrone(p, drone.id)
      if (d) delete d.preset
    })

  if (!preset) {
    return (
      <Section title="Path preset">
        <p className="note">Generate a ready-made Path with its Waypoints filled in. It replaces this Drone's current Path (Ctrl+Z undoes it).</p>
        <div className="preset-grid">
          {PRESET_KINDS.map((k) => (
            <button key={k} onClick={() => apply(k)}>
              {PRESET_LABELS[k]}
            </button>
          ))}
        </div>
      </Section>
    )
  }

  const matches = presetMatchesPath(drone)
  const warning = presetWarning(drone.waypoints, stage)
  const landing = drone.waypoints[drone.waypoints.length - 1]
  const fastest = Math.max(0, ...drone.waypoints.slice(0, -1).map((_, i) => segmentSpeed(drone.waypoints, i)))
  const int = (v: number): number => Math.max(1, Math.round(v))

  return (
    <Section title={`Path preset · ${PRESET_LABELS[preset.kind]}`}>
      <SelectField<PathPresetKind> label="Pattern" value={preset.kind} options={PRESET_KINDS.map((k) => [k, PRESET_LABELS[k]] as const)} onChange={apply} />
      {!matches && (
        <p className="note note--warn">
          The Path was edited by hand after this preset made it. Changing a setting here regenerates the Path and replaces those edits.{' '}
          <button className="link" onClick={detach}>
            Keep my edits
          </button>
        </p>
      )}
      <NumberField label="Takeoff at" unit="s" min={0} value={preset.start} title="When the Drone leaves its Takeoff Spot" onChange={(v) => update((pr) => void (pr.start = v))} />
      <NumberField
        label="Climb / descent"
        unit="s"
        min={0.2}
        value={preset.transit}
        title="Time to fly up from the Takeoff Spot to the pattern, and back down to land"
        onChange={(v) => update((pr) => void (pr.transit = v))}
      />

      {preset.kind === 'hover' && (
        <>
          <Vec3Field label="Hover point" value={preset.point} onChange={(v) => update((pr) => pr.kind === 'hover' && void (pr.point = v))} />
          <NumberField label="Hover for" unit="s" min={0} value={preset.hold} onChange={(v) => update((pr) => pr.kind === 'hover' && void (pr.hold = v))} />
        </>
      )}

      {preset.kind === 'backAndForth' && (
        <>
          <Vec3Field label="Point A" value={preset.a} onChange={(v) => update((pr) => pr.kind === 'backAndForth' && void (pr.a = v))} />
          <Vec3Field label="Point B" value={preset.b} onChange={(v) => update((pr) => pr.kind === 'backAndForth' && void (pr.b = v))} />
          <NumberField label="Time per leg" unit="s" min={0.2} value={preset.legTime} title="Flying time from A to B (or back), not counting Holds" onChange={(v) => update((pr) => pr.kind === 'backAndForth' && void (pr.legTime = v))} />
          <NumberField label="Hold at ends" unit="s" min={0} value={preset.hold} onChange={(v) => update((pr) => pr.kind === 'backAndForth' && void (pr.hold = v))} />
          <NumberField label="Legs" step={1} digits={0} min={1} max={60} value={preset.legs} title="1 = A to B, 2 = there and back, and so on" onChange={(v) => update((pr) => pr.kind === 'backAndForth' && void (pr.legs = int(v)))} />
        </>
      )}

      {preset.kind === 'circle' && (
        <>
          <Vec3Field label="Centre" value={preset.center} onChange={(v) => update((pr) => pr.kind === 'circle' && void (pr.center = v))} />
          <NumberField label="Radius" unit="m" min={0.1} value={preset.radius} onChange={(v) => update((pr) => pr.kind === 'circle' && void (pr.radius = v))} />
          <NumberField label="Time per lap" unit="s" min={0.5} value={preset.lapTime} onChange={(v) => update((pr) => pr.kind === 'circle' && void (pr.lapTime = v))} />
          <NumberField label="Laps" step={1} digits={0} min={1} max={60} value={preset.laps} onChange={(v) => update((pr) => pr.kind === 'circle' && void (pr.laps = int(v)))} />
          <NumberField label="Join at angle" unit="°" step={5} digits={0} value={preset.angle} title="Where the Drone joins the circle: 0° is toward +X, 90° toward +Z" onChange={(v) => update((pr) => pr.kind === 'circle' && void (pr.angle = v))} />
          <label className="field checkbox">
            <input type="checkbox" checked={preset.clockwise} onChange={(e) => update((pr) => pr.kind === 'circle' && void (pr.clockwise = e.target.checked))} />
            <span>Clockwise seen from above</span>
          </label>
        </>
      )}

      {preset.kind === 'figureEight' && (
        <>
          <Vec3Field label="Centre" value={preset.center} onChange={(v) => update((pr) => pr.kind === 'figureEight' && void (pr.center = v))} />
          <NumberField label="Width" unit="m" min={0.2} value={preset.width} title="End to end. The eight is half as deep as it is wide." onChange={(v) => update((pr) => pr.kind === 'figureEight' && void (pr.width = v))} />
          <NumberField label="Time per lap" unit="s" min={0.5} value={preset.lapTime} onChange={(v) => update((pr) => pr.kind === 'figureEight' && void (pr.lapTime = v))} />
          <NumberField label="Laps" step={1} digits={0} min={1} max={60} value={preset.laps} onChange={(v) => update((pr) => pr.kind === 'figureEight' && void (pr.laps = int(v)))} />
          <NumberField label="Turn" unit="°" step={5} digits={0} value={preset.angle} title="Rotate the eight about the vertical" onChange={(v) => update((pr) => pr.kind === 'figureEight' && void (pr.angle = v))} />
        </>
      )}

      <dl className="spec">
        <dt>Lands at</dt>
        <dd>{formatTime(landing?.time ?? 0)}</dd>
        <dt>Waypoints</dt>
        <dd>{drone.waypoints.length}</dd>
        <dt>Fastest</dt>
        <dd>{fastest.toFixed(2)} m/s</dd>
      </dl>
      {warning && <p className="note note--warn">{warning}</p>}
      <p className="note">Drag the Drone's {preset.kind === 'backAndForth' ? 'A and B' : preset.kind === 'hover' ? 'hover point' : 'centre'} marker in the 3D view to move it, or drag the Drone to move the whole pattern.</p>
      <div className="button-row">
        <button onClick={detach} title="Keep the Waypoints as they are and edit them by hand from now on">
          Convert to plain Waypoints
        </button>
        {!matches && <button onClick={() => update(() => {})}>Regenerate</button>}
      </div>
    </Section>
  )
}

function PlayheadPosition({ drone }: { drone: Drone }): React.JSX.Element {
  const time = useEditor((s) => s.time)
  const [x, y, z] = positionAt(drone.waypoints, time)
  return (
    <p className="note">
      At {formatTime(time)}: X {x.toFixed(2)} · Y {y.toFixed(2)} · Z {z.toFixed(2)} m
    </p>
  )
}

function DroneInspector({ drone }: { drone: Drone }): React.JSX.Element {
  const edit = useEditor((s) => s.edit)
  const select = useEditor((s) => s.select)
  const setTime = useEditor((s) => s.setTime)
  const update = (fn: (d: NonNullable<ReturnType<typeof draftDrone>>) => void): void =>
    edit((p) => {
      const d = draftDrone(p, drone.id)
      if (d) fn(d)
    })

  return (
    <>
      <Section title={droneLabel(drone)}>
        <TextField label="Name" value={drone.name} placeholder="optional" onChange={(v) => update((d) => void (d.name = v))} />
        <label className="field">
          <span className="field-label">Editor colour</span>
          <span className="field-input">
            <input type="color" value={drone.editorColor} onChange={(e) => update((d) => void (d.editorColor = e.target.value))} />
          </span>
        </label>
        <p className="note">The editor colour marks this Drone's Path and track. It is not its Light.</p>
        <PlayheadPosition drone={drone} />
        <p className="note">Drag the Drone in the 3D view to move it at the playhead: it moves the Waypoint it is at, or adds one there.</p>
      </Section>
      <PresetSection drone={drone} />
      <Section title="Takeoff Spot">
        {(['X', 'Z'] as const).map((axis, i) => (
          <NumberField
            key={axis}
            label={axis}
            unit="m"
            value={drone.takeoffSpot[i]}
            onChange={(v) =>
              update((d) => {
                d.takeoffSpot[i] = v
                syncTakeoffSpot(d)
              })
            }
          />
        ))}
      </Section>
      <Section title={`Path · ${drone.waypoints.length} Waypoints`}>
        <ol className="waypoint-list">
          {drone.waypoints.map((w, i) => (
            <li key={w.id}>
              <button
                onClick={() => {
                  select({ kind: 'waypoint', droneId: drone.id, waypointId: w.id, handle: null })
                  setTime(w.time)
                }}
              >
                <span>{w.kind === 'air' ? `Waypoint ${i}` : w.kind === 'takeoff' ? 'Takeoff' : 'Landing'}</span>
                <span>{formatTime(w.time)}</span>
              </button>
            </li>
          ))}
        </ol>
        <button className="wide" onClick={() => addWaypointAtPlayhead(drone.id)}>
          Add Waypoint at playhead
        </button>
        <div className="button-row">
          <button onClick={() => update((d) => smoothPath(d.waypoints))}>Smooth whole Path</button>
          <button onClick={() => update((d) => d.waypoints.forEach((w) => (w.segment = 'linear')))}>Make all linear</button>
        </div>
      </Section>
      <Section title="Copy and delete">
        <button className="wide" onClick={duplicateSelectedDrone} title="Ctrl+D">
          Duplicate {droneLabel(drone)}
        </button>
        <button className="wide danger" onClick={() => deleteDrone(drone.id)} title="Delete key">
          Delete {droneLabel(drone)}
        </button>
      </Section>
    </>
  )
}

export function deleteSelectedWaypoint(): void {
  const { selection, project, edit, select, notify } = useEditor.getState()
  if (selection.kind !== 'waypoint') return
  const found = findWaypoint(project, selection.droneId, selection.waypointId)
  if (!found) return
  if (found.waypoint.kind !== 'air') {
    notify('Takeoff and landing are part of every Path and cannot be deleted.')
    return
  }
  edit((p) => {
    const d = draftDrone(p, selection.droneId)
    if (d) d.waypoints.splice(found.index, 1)
  })
  select({ kind: 'drone', droneId: selection.droneId })
}

function WaypointInspector({ droneId, waypointId }: { droneId: string; waypointId: string }): React.JSX.Element | null {
  const project = useEditor((s) => s.project)
  const edit = useEditor((s) => s.edit)
  const select = useEditor((s) => s.select)
  const setTime = useEditor((s) => s.setTime)
  const found = findWaypoint(project, droneId, waypointId)
  if (!found) return null
  const { drone, index, waypoint: w } = found
  const wps = drone.waypoints
  const isLast = index === wps.length - 1
  const prevBezier = index > 0 && wps[index - 1].segment === 'bezier'
  const ownBezier = !isLast && w.segment === 'bezier'
  const title = w.kind === 'air' ? `Waypoint ${index}` : w.kind === 'takeoff' ? 'Takeoff' : 'Landing'

  const update = (fn: (wps: NonNullable<ReturnType<typeof draftDrone>>['waypoints'], d: NonNullable<ReturnType<typeof draftDrone>>) => void): void =>
    edit((p) => {
      const d = draftDrone(p, droneId)
      if (d) fn(d.waypoints, d)
    })

  return (
    <>
      <Section title={`${droneLabel(drone)} · ${title}`}>
        <NumberField label="Time" unit="s" min={0} value={w.time} onChange={(v) => update((ws) => void (ws[index].time = clampWaypointTime(ws, index, v)))} />
        {!isLast && (
          <NumberField
            label="Hold"
            unit="s"
            min={0}
            value={w.hold}
            title={w.kind === 'takeoff' ? 'Time spent on the floor before taking off' : 'Time spent here before moving on'}
            onChange={(v) => update((ws) => void (ws[index].hold = clampHold(ws, index, v)))}
          />
        )}
        <button className="wide" onClick={() => setTime(w.time)}>
          Move playhead here
        </button>
      </Section>
      <Section title="Position">
        {w.kind === 'air' ? (
          (['X', 'Y (height)', 'Z'] as const).map((axis, i) => (
            <NumberField key={axis} label={axis} unit="m" value={w.position[i]} onChange={(v) => update((ws) => void (ws[index].position[i] = v))} />
          ))
        ) : (
          <>
            <p className="note">On the Takeoff Spot. Moving it moves the takeoff and landing together.</p>
            {(['X', 'Z'] as const).map((axis, i) => (
              <NumberField
                key={axis}
                label={axis}
                unit="m"
                value={drone.takeoffSpot[i]}
                onChange={(v) =>
                  update((_ws, d) => {
                    d.takeoffSpot[i] = v
                    syncTakeoffSpot(d)
                  })
                }
              />
            ))}
          </>
        )}
      </Section>
      {!isLast && (
        <Section title="Segment to next Waypoint">
          <SelectField
            label="Shape"
            value={w.segment}
            options={[
              ['linear', 'Linear'],
              ['bezier', 'Bezier curve']
            ]}
            onChange={(v) =>
              update((ws) => {
                ws[index].segment = v
                if (v === 'bezier') {
                  // Give a fresh curve visible handles at both ends.
                  if (length(ws[index].outHandle) === 0) ws[index].outHandle = autoHandles(ws, index).outHandle
                  if (length(ws[index + 1].inHandle) === 0) ws[index + 1].inHandle = autoHandles(ws, index + 1).inHandle
                }
              })
            }
          />
          <p className="note">Average speed: {segmentSpeed(wps, index).toFixed(2)} m/s</p>
        </Section>
      )}
      {(prevBezier || ownBezier) && (
        <Section title="Bezier handles">
          {prevBezier && (
            <NumberField
              label="In weight"
              unit="m"
              min={0}
              value={length(w.inHandle)}
              onChange={(v) => update((ws) => setHandleWeight(ws, index, 'in', v))}
            />
          )}
          {ownBezier && (
            <NumberField
              label="Out weight"
              unit="m"
              min={0}
              value={length(w.outHandle)}
              onChange={(v) => update((ws) => setHandleWeight(ws, index, 'out', v))}
            />
          )}
          <label className="field checkbox">
            <input type="checkbox" checked={w.handlesLinked} onChange={(e) => update((ws) => void (ws[index].handlesLinked = e.target.checked))} />
            <span>Linked handles (smooth corner)</span>
          </label>
          <div className="button-row">
            <button
              onClick={() =>
                update((ws) => {
                  const h = autoHandles(ws, index)
                  ws[index].inHandle = h.inHandle
                  ws[index].outHandle = h.outHandle
                })
              }
            >
              Auto handles
            </button>
            {prevBezier && <button onClick={() => select({ kind: 'waypoint', droneId, waypointId, handle: 'in' })}>Drag in handle</button>}
            {ownBezier && <button onClick={() => select({ kind: 'waypoint', droneId, waypointId, handle: 'out' })}>Drag out handle</button>}
          </div>
          <p className="note">A longer handle (more weight) makes the curve leave or arrive more gradually.</p>
        </Section>
      )}
      {w.kind === 'air' && (
        <Section title="Danger zone">
          <button className="wide danger" onClick={deleteSelectedWaypoint}>
            Delete Waypoint
          </button>
        </Section>
      )}
    </>
  )
}

export function Inspector(): React.JSX.Element {
  const selection = useEditor((s) => s.selection)
  const project = useEditor((s) => s.project)
  let body: React.JSX.Element
  if (selection.kind === 'stage') body = <StageInspector part={selection.part} />
  else if (selection.kind === 'drone' && findDrone(project, selection.droneId)) body = <DroneInspector drone={findDrone(project, selection.droneId)!} />
  else if (selection.kind === 'waypoint' && findWaypoint(project, selection.droneId, selection.waypointId))
    body = <WaypointInspector droneId={selection.droneId} waypointId={selection.waypointId} />
  else body = <ProjectInspector />
  return <aside className="inspector">{body}</aside>
}
