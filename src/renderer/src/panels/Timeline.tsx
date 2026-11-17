import { useRef, useState } from 'react'
import { droneLabel, newId } from '../model/defaults'
import { clampHold, clampWaypointTime, insertWaypointAt } from '../model/path'
import type { Drone, Waypoint } from '../model/types'
import { draftDrone, timelineEnd, useEditor } from '../store/editorStore'
import { formatTime } from './format'

const LABEL_WIDTH = 150
const SNAP_STEP = 0.1
const PLAYHEAD_SNAP_PX = 6
const TICK_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120]

/** Follow a pointer drag with window listeners until the button is released. */
function trackDrag(onMove: (dx: number, e: PointerEvent) => void, onEnd: () => void, startX: number): void {
  const move = (e: PointerEvent): void => onMove(e.clientX - startX, e)
  const up = (): void => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    onEnd()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

/** Snap to 0.1 s, or to the playhead when close to it. Hold Shift for no snapping. */
function snapTime(t: number, pps: number, shift: boolean): number {
  if (shift) return t
  const playhead = useEditor.getState().time
  if (Math.abs(t - playhead) * pps < PLAYHEAD_SNAP_PX) return playhead
  return Math.round(t / SNAP_STEP) * SNAP_STEP
}

function Ruler({ end, pps }: { end: number; pps: number }): React.JSX.Element {
  const setTime = useEditor((s) => s.setTime)
  const setPlaying = useEditor((s) => s.setPlaying)
  const ref = useRef<HTMLDivElement>(null)
  const step = TICK_STEPS.find((s) => s * pps >= 60) ?? 120
  const ticks: number[] = []
  for (let t = 0; t <= end; t += step) ticks.push(t)

  const scrub = (clientX: number): void => {
    const rect = ref.current!.getBoundingClientRect()
    setTime((clientX - rect.left) / pps)
  }

  return (
    <div
      ref={ref}
      className="lane ruler"
      onPointerDown={(e) => {
        setPlaying(false)
        scrub(e.clientX)
        trackDrag((_dx, ev) => scrub(ev.clientX), () => {}, e.clientX)
      }}
    >
      {ticks.map((t) => (
        <div key={t} className="tick" style={{ left: t * pps }}>
          <span>{formatTime(t).replace(/\.00$/, '')}</span>
        </div>
      ))}
    </div>
  )
}

function WaypointMark({ drone, waypoint, index, pps }: { drone: Drone; waypoint: Waypoint; index: number; pps: number }): React.JSX.Element {
  const selected = useEditor((s) => s.selection.kind === 'waypoint' && s.selection.waypointId === waypoint.id)
  const { select, beginGesture, editLive, endGesture } = useEditor.getState()

  const startDrag = (e: React.PointerEvent, what: 'time' | 'hold'): void => {
    e.stopPropagation()
    select({ kind: 'waypoint', droneId: drone.id, waypointId: waypoint.id, handle: null })
    beginGesture()
    const start = what === 'time' ? waypoint.time : waypoint.hold
    trackDrag(
      (dx, ev) =>
        editLive((p) => {
          const d = draftDrone(p, drone.id)
          if (!d) return
          if (what === 'time') {
            d.waypoints[index].time = clampWaypointTime(d.waypoints, index, snapTime(start + dx / pps, pps, ev.shiftKey))
          } else {
            const endT = snapTime(waypoint.time + start + dx / pps, pps, ev.shiftKey)
            d.waypoints[index].hold = clampHold(d.waypoints, index, endT - waypoint.time)
          }
        }),
      endGesture,
      e.clientX
    )
  }

  const stop = { onClick: (e: React.MouseEvent) => e.stopPropagation(), onDoubleClick: (e: React.MouseEvent) => e.stopPropagation() }
  const shape = waypoint.kind === 'takeoff' ? 'takeoff' : waypoint.kind === 'landing' ? 'landing' : 'air'
  return (
    <>
      {waypoint.hold > 0 && (
        <div className="hold-bar" style={{ left: waypoint.time * pps, width: waypoint.hold * pps, background: drone.editorColor }} title={`Hold ${waypoint.hold.toFixed(2)} s`}>
          <div className="hold-grip" {...stop} onPointerDown={(e) => startDrag(e, 'hold')} title="Drag to change the Hold" />
        </div>
      )}
      <div
        className={`waypoint-mark waypoint-mark--${shape}${selected ? ' selected' : ''}`}
        style={{ left: waypoint.time * pps, background: drone.editorColor }}
        title={`${shape === 'air' ? `Waypoint ${index}` : shape} at ${formatTime(waypoint.time)}. Drag to change its time (Shift: no snapping).`}
        {...stop}
        onPointerDown={(e) => startDrag(e, 'time')}
      />
      {selected && waypoint.hold === 0 && index < drone.waypoints.length - 1 && (
        <div className="hold-grip hold-grip--alone" {...stop} style={{ left: waypoint.time * pps + 6 }} onPointerDown={(e) => startDrag(e, 'hold')} title="Drag right to add a Hold" />
      )}
    </>
  )
}

function Track({ drone, pps, width }: { drone: Drone; pps: number; width: number }): React.JSX.Element {
  const active = useEditor((s) => (s.selection.kind === 'drone' || s.selection.kind === 'waypoint') && s.selection.droneId === drone.id)
  const { select, edit, notify } = useEditor.getState()
  const first = drone.waypoints[0]
  const last = drone.waypoints[drone.waypoints.length - 1]

  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    const t = (e.clientX - e.currentTarget.getBoundingClientRect().left) / pps
    const id = newId()
    let ok = false
    edit((p) => {
      const d = draftDrone(p, drone.id)
      if (d) ok = insertWaypointAt(d.waypoints, t, id) !== null
    })
    if (ok) select({ kind: 'waypoint', droneId: drone.id, waypointId: id, handle: null })
    else notify(`Can't add a Waypoint at ${formatTime(t)}: that is before takeoff, after landing, during a Hold or right next to another Waypoint.`)
  }

  return (
    <div className={`timeline-row${active ? ' active' : ''}`}>
      <button className="track-label" onClick={() => select({ kind: 'drone', droneId: drone.id })}>
        <span className="swatch" style={{ background: drone.editorColor }} />
        {droneLabel(drone)}
      </button>
      <div className="lane" style={{ width }} onClick={() => select({ kind: 'drone', droneId: drone.id })} onDoubleClick={onDoubleClick}>
        {first && last && (
          <div className="flight-span" style={{ left: first.time * pps, width: (last.time - first.time) * pps, borderColor: drone.editorColor }} />
        )}
        {drone.waypoints.map((w, i) => (
          <WaypointMark key={w.id} drone={drone} waypoint={w} index={i} pps={pps} />
        ))}
      </div>
    </div>
  )
}

export function Timeline(): React.JSX.Element {
  const project = useEditor((s) => s.project)
  const time = useEditor((s) => s.time)
  const playing = useEditor((s) => s.playing)
  const { setPlaying, setTime } = useEditor.getState()
  const [pps, setPps] = useState(40)
  const end = timelineEnd(project)
  const laneWidth = (end + 5) * pps
  const drones = [...project.show.drones].sort((a, b) => a.number - b.number)

  return (
    <section className="timeline">
      <div className="timeline-bar">
        <button onClick={() => setTime(0)} title="Go to start (Home)">
          ⏮
        </button>
        <button className="play" onClick={() => setPlaying(!playing)} title="Play / pause (Space)">
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <span className="time-readout">
          {formatTime(time)} <span className="muted">/ {formatTime(end)}</span>
        </span>
        <span className="spacer" />
        <span className="muted hint">Double-click a track to add a Waypoint · drag diamonds to retime · Shift disables snapping</span>
        <label className="zoom">
          Zoom
          <input type="range" min={8} max={200} value={pps} onChange={(e) => setPps(Number(e.target.value))} />
        </label>
      </div>
      <div className="timeline-scroll">
        <div className="timeline-content" style={{ width: LABEL_WIDTH + laneWidth }}>
          <div className="timeline-row ruler-row">
            <div className="track-label">Time</div>
            <div style={{ width: laneWidth, position: 'relative' }}>
              <Ruler end={end + 5} pps={pps} />
              <div className="show-end" style={{ left: project.show.duration * pps }} title="End of the Show" />
            </div>
          </div>
          {drones.map((d) => (
            <Track key={d.id} drone={d} pps={pps} width={laneWidth} />
          ))}
          {drones.length === 0 && <p className="note timeline-empty">Add Drones from the left panel to see their tracks.</p>}
          <div className="playhead" style={{ left: LABEL_WIDTH + time * pps }} />
        </div>
      </div>
    </section>
  )
}
