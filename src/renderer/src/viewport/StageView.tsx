import { Html } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { wallFrame, WALL_LABELS } from '../model/stageGeometry'
import type { Stage, Wall } from '../model/types'
import { add, scale } from '../model/vec'
import { useEditor } from '../store/editorStore'
import { pickable, PRIORITY, useHighlight } from './picking'

const LABEL_Z: [number, number] = [20, 0]

/** Line segments of a grid on a plane of the given size, centred on the origin in XY. */
function gridPositions(sizeX: number, sizeY: number, spacing: number): Float32Array {
  const pts: number[] = []
  const hx = sizeX / 2
  const hy = sizeY / 2
  for (let x = -hx; x <= hx + 1e-6; x += spacing) pts.push(x, -hy, 0, x, hy, 0)
  for (let y = -hy; y <= hy + 1e-6; y += spacing) pts.push(-hx, y, 0, hx, y, 0)
  return new Float32Array(pts)
}

function Grid({ sizeX, sizeY, spacing, color, opacity }: { sizeX: number; sizeY: number; spacing: number; color: string; opacity: number }): React.JSX.Element {
  const positions = useMemo(() => gridPositions(sizeX, sizeY, spacing), [sizeX, sizeY, spacing])
  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineSegments>
  )
}

function Label({ children, position, tone = 'stage' }: { children: React.ReactNode; position: [number, number, number]; tone?: string }): React.JSX.Element {
  return (
    <Html position={position} center zIndexRange={LABEL_Z} style={{ pointerEvents: 'none' }}>
      <div className={`scene-label scene-label--${tone}`}>{children}</div>
    </Html>
  )
}

function Room({ stage }: { stage: Stage }): React.JSX.Element {
  const roomSelected = useEditor((s) => s.selection.kind === 'stage' && (s.selection.part ?? 'room') === 'room')
  const edges = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(stage.width, stage.height, stage.depth)),
    [stage.width, stage.height, stage.depth]
  )
  const walls: Wall[] = ['front', 'back', 'left', 'right']
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <planeGeometry args={[stage.width, stage.depth]} />
        <meshStandardMaterial color="#2a2e37" />
      </mesh>
      <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <Grid sizeX={stage.width} sizeY={stage.depth} spacing={1} color="#5b6474" opacity={0.6} />
      </group>
      <lineSegments geometry={edges} position={[0, stage.height / 2, 0]}>
        <lineBasicMaterial color={roomSelected ? '#4fc3f7' : '#8a94a8'} />
      </lineSegments>
      {walls.map((wall) => {
        const f = wallFrame(stage, wall)
        return (
          <Label key={wall} position={add(f.base, scale(f.inward, 0.35))}>
            {WALL_LABELS[wall]} wall
          </Label>
        )
      })}
      <Label position={[-stage.width / 2, stage.height, -stage.depth / 2]}>
        Stage {stage.width} × {stage.depth} m, {stage.height} m high
      </Label>
    </group>
  )
}

const NET_PICK = pickable({ kind: 'stage', part: 'net' }, PRIORITY.net)
const PROJECTION_PICK = pickable({ kind: 'stage', part: 'projection' }, PRIORITY.projection)
const AUDIENCE_PICK = pickable({ kind: 'stage', part: 'audience' }, PRIORITY.audience)

/** Fill and line opacity: brighter when hovered, brightest when selected. */
const emphasis = (h: { selected: boolean; hovered: boolean }, base: number, hover: number, selected: number): number =>
  h.selected ? selected : h.hovered ? hover : base

function SafetyNetView({ stage }: { stage: Stage }): React.JSX.Element {
  const { net } = stage
  const h = useHighlight(NET_PICK.pick.selection)
  const fill = emphasis(h, 0.05, 0.12, 0.16)
  const lines = emphasis(h, 0.18, 0.35, 0.55)
  if (net.placement === 'overhead') {
    return (
      <group position={[0, net.height, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh userData={NET_PICK}>
          <planeGeometry args={[stage.width, stage.depth]} />
          <meshBasicMaterial color="#ff9f43" transparent opacity={fill} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <Grid sizeX={stage.width} sizeY={stage.depth} spacing={0.5} color="#ff9f43" opacity={lines} />
        <Label position={[0, 0, 0]} tone="net">Safety Net (overhead, {net.height} m)</Label>
      </group>
    )
  }
  const f = wallFrame(stage, net.side)
  const pos = add(add(f.base, scale(f.inward, net.distance)), [0, stage.height / 2, 0])
  return (
    <group position={pos} rotation={[0, f.rotationY, 0]}>
      <mesh userData={NET_PICK}>
        <planeGeometry args={[f.length, stage.height]} />
        <meshBasicMaterial color="#ff9f43" transparent opacity={fill} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Grid sizeX={f.length} sizeY={stage.height} spacing={0.5} color="#ff9f43" opacity={lines} />
      <Label position={[0, stage.height / 2 - 0.3, 0]} tone="net">Safety Net</Label>
    </group>
  )
}

function ProjectionView({ stage }: { stage: Stage }): React.JSX.Element {
  const p = stage.projection
  const f = wallFrame(stage, p.wall)
  const pos = add(add(add(f.base, scale(f.inward, 0.02)), scale(f.along, p.offset)), [0, p.bottom + p.height / 2, 0])
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(p.width, p.height)), [p.width, p.height])
  const h = useHighlight(PROJECTION_PICK.pick.selection)
  return (
    <group position={pos} rotation={[0, f.rotationY, 0]}>
      <mesh userData={PROJECTION_PICK}>
        <planeGeometry args={[p.width, p.height]} />
        <meshBasicMaterial color="#6fa8ff" transparent opacity={emphasis(h, 0.35, 0.5, 0.6)} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={h.selected ? '#ffffff' : '#9cc4ff'} />
      </lineSegments>
      <Label position={[0, 0, 0]} tone="projection">
        Projection {p.width} × {p.height} m
      </Label>
    </group>
  )
}

function AudienceView({ stage }: { stage: Stage }): React.JSX.Element {
  const a = stage.audience
  const h = useHighlight(AUDIENCE_PICK.pick.selection)
  return (
    <group position={[a.x, 0.003, a.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh userData={AUDIENCE_PICK}>
        <planeGeometry args={[a.width, a.depth]} />
        <meshBasicMaterial color="#a77bff" transparent opacity={emphasis(h, 0.25, 0.4, 0.5)} depthWrite={false} />
      </mesh>
      <Label position={[0, 0, 0.05]} tone="audience">Audience Area</Label>
    </group>
  )
}

export function StageView(): React.JSX.Element {
  const stage = useEditor((s) => s.project.stage)
  return (
    <group>
      <Room stage={stage} />
      <AudienceView stage={stage} />
      <SafetyNetView stage={stage} />
      <ProjectionView stage={stage} />
    </group>
  )
}
