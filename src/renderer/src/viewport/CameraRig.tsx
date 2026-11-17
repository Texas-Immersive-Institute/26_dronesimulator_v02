import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEditor } from '../store/editorStore'

const MARGIN = 1.2

/**
 * Free 3D camera (orbit, pan, zoom), or a flat 90° view of the Stage from the
 * top, front (audience side) or right side. Flat views can pan and zoom but not rotate.
 */
export function CameraRig(): React.JSX.Element {
  const view = useEditor((s) => s.view)
  const { width, depth, height } = useEditor((s) => s.project.stage)
  const size = useThree((s) => s.size)

  if (view === 'perspective') {
    return (
      <>
        <PerspectiveCamera
          key="perspective"
          makeDefault
          fov={45}
          near={0.05}
          far={1000}
          position={[width * 0.75, height * 1.4, depth * 1.6]}
        />
        <OrbitControls key="orbit-perspective" makeDefault target={[0, height * 0.3, 0]} />
      </>
    )
  }

  const far = Math.max(width, depth, height) * 10
  const fit = (spanX: number, spanY: number): number =>
    Math.min(size.width / (spanX * MARGIN), size.height / (spanY * MARGIN))

  if (view === 'top') {
    return (
      <>
        <OrthographicCamera
          key="top"
          makeDefault
          position={[0, height + far / 2, 0]}
          up={[0, 0, -1]}
          near={0.01}
          far={far * 2}
          zoom={fit(width, depth)}
        />
        <OrbitControls key="orbit-top" makeDefault enableRotate={false} target={[0, 0, 0]} />
      </>
    )
  }

  const front = view === 'front'
  return (
    <>
      <OrthographicCamera
        key={view}
        makeDefault
        position={front ? [0, height / 2, depth / 2 + far / 2] : [width / 2 + far / 2, height / 2, 0]}
        near={0.01}
        far={far * 2}
        zoom={front ? fit(width, height) : fit(depth, height)}
      />
      <OrbitControls key={`orbit-${view}`} makeDefault enableRotate={false} target={[0, height / 2, 0]} />
    </>
  )
}
