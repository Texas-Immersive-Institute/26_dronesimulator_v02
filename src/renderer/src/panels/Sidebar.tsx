import { DRONE_SOFT_LIMIT, droneLabel, newDrone } from '../model/defaults'
import { selectedDroneId, useEditor } from '../store/editorStore'

export function addDrone(): void {
  const { project, edit, select, notify } = useEditor.getState()
  const drone = newDrone(project)
  edit((p) => void p.show.drones.push(drone))
  select({ kind: 'drone', droneId: drone.id })
  notify(project.show.drones.length + 1 > DRONE_SOFT_LIMIT ? `This Show now has more than ${DRONE_SOFT_LIMIT} Drones.` : null)
}

export function Sidebar(): React.JSX.Element {
  const drones = useEditor((s) => s.project.show.drones)
  const selection = useEditor((s) => s.selection)
  const select = useEditor((s) => s.select)
  const activeDrone = selectedDroneId(selection)
  const sorted = [...drones].sort((a, b) => a.number - b.number)

  return (
    <nav className="sidebar">
      <button className={`nav-item${selection.kind === 'project' ? ' active' : ''}`} onClick={() => select({ kind: 'project' })}>
        Project
      </button>
      <button className={`nav-item${selection.kind === 'stage' ? ' active' : ''}`} onClick={() => select({ kind: 'stage' })}>
        Stage
      </button>
      <div className="sidebar-heading">
        <span>Drones ({drones.length})</span>
        <button onClick={addDrone} title="Add a Drone">
          + Add
        </button>
      </div>
      {sorted.map((d) => (
        <button key={d.id} className={`nav-item${activeDrone === d.id ? ' active' : ''}`} onClick={() => select({ kind: 'drone', droneId: d.id })}>
          <span className="swatch" style={{ background: d.editorColor }} />
          {droneLabel(d)}
        </button>
      ))}
      {drones.length === 0 && <p className="note">No Drones yet. Add 5–10 for a Show.</p>}
      {drones.length > DRONE_SOFT_LIMIT && <p className="note note--warn">More than {DRONE_SOFT_LIMIT} Drones.</p>}
    </nav>
  )
}
