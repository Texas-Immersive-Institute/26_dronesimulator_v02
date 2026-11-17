import { Html } from '@react-three/drei'
import { DRONE_MODELS, type DroneModelSpec } from '../model/droneModels'
import { droneLabel } from '../model/defaults'
import { positionAt } from '../model/path'
import type { Drone } from '../model/types'
import { selectedDroneId, useEditor } from '../store/editorStore'
import { pickable, PRIORITY } from './picking'

const INCH = 0.0254

/** A generic quadcopter at the Drone Model's published size. */
function Quad({ spec, color }: { spec: DroneModelSpec; color: string }): React.JSX.Element {
  const size = spec.size!
  const r = (spec.propDiameterInches * INCH) / 2
  const mx = Math.max(size.length / 2 - r, r * 0.5)
  const mz = Math.max(size.width / 2 - r, r * 0.5)
  const armLength = Math.hypot(mx, mz) * 2
  const armAngle = Math.atan2(mz, mx)
  const h = size.height
  const motors: [number, number][] = [
    [mx, mz],
    [-mx, mz],
    [mx, -mz],
    [-mx, -mz]
  ]
  return (
    <group>
      <mesh>
        <boxGeometry args={[size.length * 0.32, h * 0.6, size.width * 0.32]} />
        <meshStandardMaterial color="#d7dbe3" />
      </mesh>
      {[armAngle, -armAngle].map((a) => (
        <mesh key={a} rotation={[0, a, 0]}>
          <boxGeometry args={[armLength, h * 0.18, h * 0.25]} />
          <meshStandardMaterial color="#9aa1ad" />
        </mesh>
      ))}
      {motors.map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, h * 0.3, z]}>
          <mesh>
            <cylinderGeometry args={[r * 0.95, r * 0.95, 0.004, 24]} />
            <meshBasicMaterial color={color} transparent opacity={0.35} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[r, Math.max(h * 0.08, 0.004), 6, 32]} />
            <meshStandardMaterial color="#5c6370" />
          </mesh>
        </group>
      ))}
      {/* The Drone's single Light. Light Cues arrive in Milestone 2; it shows white for now. */}
      <mesh position={[0, -h * 0.45, 0]}>
        <sphereGeometry args={[Math.max(h * 0.3, 0.015), 16, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

export function DroneView({ drone }: { drone: Drone }): React.JSX.Element {
  const time = useEditor((s) => s.time)
  const modelId = useEditor((s) => s.project.show.droneModel)
  const selected = useEditor((s) => selectedDroneId(s.selection) === drone.id)
  const hovered = useEditor((s) => s.hovered === `drone:${drone.id}:`)
  const spec = DRONE_MODELS[modelId]
  const position = positionAt(drone.waypoints, time)
  const pick = pickable({ kind: 'drone', droneId: drone.id }, PRIORITY.drone)

  return (
    <group position={position}>
      {/* An invisible, slightly larger box makes the small Drone easy to click. */}
      <mesh userData={pick} visible={false}>
        <boxGeometry args={[0.6, 0.3, 0.6]} />
      </mesh>
      {spec.size ? (
        <Quad spec={spec} color={drone.editorColor} />
      ) : (
        // DEXI-3 size is not published: show a marker, not a guessed size.
        <mesh>
          <octahedronGeometry args={[0.08]} />
          <meshStandardMaterial color={drone.editorColor} wireframe />
        </mesh>
      )}
      {(selected || hovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.28, 0.31, 40]} />
          <meshBasicMaterial color={selected ? '#ffffff' : drone.editorColor} transparent opacity={selected ? 1 : 0.7} />
        </mesh>
      )}
      <Html position={[0, 0.28, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`drone-label${selected ? ' drone-label--selected' : hovered ? ' drone-label--hovered' : ''}`} style={{ borderColor: drone.editorColor }}>
          {droneLabel(drone)}
        </div>
      </Html>
    </group>
  )
}
