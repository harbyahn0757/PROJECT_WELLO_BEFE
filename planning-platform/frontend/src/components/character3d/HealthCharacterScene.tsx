import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three'
import { HealthCharacterModel, HealthCharacterState, ZoneMetric } from './HealthCharacterModel'

interface CharacterSceneProps {
  width?: string
  height?: string
  backgroundColor?: string
  onIntroComplete?: () => void
  onZoneClick?: (metric: ZoneMetric) => void
  healthState?: HealthCharacterState
  zoneMetrics?: ZoneMetric[]
  enableRotation?: boolean
}

/** Lights that follow camera — consistent lighting from top-right regardless of rotation */
function CameraFollowLights() {
  const keyLight = useRef<THREE.DirectionalLight>(null)
  const fillLight = useRef<THREE.DirectionalLight>(null)
  const rimLight = useRef<THREE.DirectionalLight>(null)
  const neckFillLight = useRef<THREE.DirectionalLight>(null)

  useFrame(({ camera }) => {
    // Key light: top-right relative to camera
    if (keyLight.current) {
      const offset = new THREE.Vector3(2, 3, 1)
      offset.applyQuaternion(camera.quaternion)
      keyLight.current.position.copy(camera.position).add(offset)
    }
    // Fill light: left relative to camera
    if (fillLight.current) {
      const offset = new THREE.Vector3(-1.5, 1, 0.5)
      offset.applyQuaternion(camera.quaternion)
      fillLight.current.position.copy(camera.position).add(offset)
    }
    // Rim light: behind-below relative to camera
    if (rimLight.current) {
      const offset = new THREE.Vector3(0, -0.5, -2)
      offset.applyQuaternion(camera.quaternion)
      rimLight.current.position.copy(camera.position).add(offset)
    }
    // Neck fill: from below-front to brighten neck-head junction shadow
    if (neckFillLight.current) {
      const offset = new THREE.Vector3(0, -1.5, 1.5)
      offset.applyQuaternion(camera.quaternion)
      neckFillLight.current.position.copy(camera.position).add(offset)
    }
  })

  return (
    <>
      <directionalLight ref={keyLight} intensity={1.0} color="#ffffff" />
      <directionalLight ref={fillLight} intensity={0.7} color="#ffffff" />
      <directionalLight ref={rimLight} intensity={0.3} color="#ffffff" />
      <directionalLight ref={neckFillLight} intensity={0.5} color="#ffffff" />
    </>
  )
}

export default function HealthCharacterScene({
  width = '100%',
  height = '400px',
  backgroundColor = 'transparent',
  onIntroComplete,
  onZoneClick,
  healthState,
  zoneMetrics,
  enableRotation = true,
}: CharacterSceneProps) {
  return (
    <div style={{ width, height, touchAction: 'none' }}>
      <Canvas
        camera={{ position: [0, 0.3, 3.0], fov: 40 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.NoToneMapping,
        }}
        dpr={[1, 2]}
        style={{ background: backgroundColor }}
      >
        {/* Ambient base + camera-following directional lights */}
        <ambientLight intensity={1.6} />
        <CameraFollowLights />

        <Suspense fallback={null}>
          <HealthCharacterModel
            onIntroComplete={onIntroComplete}
            healthState={healthState}
            zoneMetrics={zoneMetrics}
            onZoneClick={onZoneClick}
          />

          {enableRotation && (
            <CameraControls
              minPolarAngle={Math.PI / 4}
              maxPolarAngle={Math.PI / 1.5}
              minDistance={2.5}
              maxDistance={5.5}
              azimuthRotateSpeed={0.5}
              polarRotateSpeed={0.5}
              dollySpeed={0.3}
            />
          )}
        </Suspense>
      </Canvas>
    </div>
  )
}
