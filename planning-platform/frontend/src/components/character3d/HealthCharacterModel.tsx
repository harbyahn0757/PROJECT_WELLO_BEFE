import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

// ===== TYPES =====
export type CharacterMood = 'happy' | 'neutral' | 'concerned' | 'worried' | 'celebrating'

export interface HealthCharacterState {
  mood: CharacterMood
  highlights: BodyHighlight[]
  overallScore: number   // 0-100
  alertCount: number     // 주의/위험 항목 수
}

export interface BodyHighlight {
  zone: 'head' | 'chest' | 'abdomen' | 'full'
  color: string
  intensity: number   // 0-1
  label: string
}

// 검진 데이터 ↔ 신체 부위 매핑
export interface ZoneMetric {
  zone: BodyZone
  label: string
  value: string
  status: 'normal' | 'warning' | 'danger'
  y: number        // 3D Y 좌표
}

interface CharacterModelProps {
  onIntroComplete?: () => void
  healthState?: HealthCharacterState
  zoneMetrics?: ZoneMetric[]
  onZoneClick?: (metric: ZoneMetric) => void
}

type BodyZone = 'head' | 'face' | 'body' | 'side' | 'lower'

type ReactionType =
  | 'flinch-look'
  | 'shy' | 'surprised' | 'belly-squish' | 'lean'
  | 'pout' | 'head-shake-no' | 'stomp' | 'look-away'
  | 'angry-shake' | 'turn-away'
  | 'dere'
  | 'peek-back'

interface ReactionState {
  type: ReactionType
  timer: number
  lookX: number
  lookY: number
  zone: BodyZone
}

// ===== CONSTANTS =====
const IRRITATION_DECAY = 0.5   // per second
const RAPID_WINDOW = 1500      // ms
const ZONE_HEAD_Y = 0.55
const ZONE_FACE_Y = 0.43
const ZONE_BODY_Y = 0.05
const ZONE_SIDE_X = 0.10

// ===== EASING FUNCTIONS =====
const easeOut = (t: number) => t * (2 - t)
const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
/** Smooth start, fast middle, smooth end — more organic than easeInOut */
const smoothStep = (t: number) => t * t * (3 - 2 * t)
/** Spring-like overshoot ease out */
const springOut = (t: number) => {
  const c = 1.70158
  return 1 + (t - 1) * (t - 1) * ((c + 1) * (t - 1) + c)
}
/** Cubic ease out — smoother deceleration */
const cubicOut = (t: number) => 1 - Math.pow(1 - t, 3)
/** Very gentle ease — almost imperceptible start */
const gentleEase = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)

// ===== HELPERS =====
function getBodyZone(point: THREE.Vector3): BodyZone {
  if (Math.abs(point.x) > ZONE_SIDE_X && point.y > ZONE_BODY_Y && point.y < ZONE_FACE_Y) return 'side'
  if (point.y > ZONE_HEAD_Y) return 'head'
  if (point.y > ZONE_FACE_Y) return 'face'
  if (point.y > ZONE_BODY_Y) return 'body'
  return 'lower'
}

function selectReaction(zone: BodyZone, level: number): ReactionType {
  if (level >= 9) return 'dere'
  if (level >= 6) {
    if (zone === 'face' || zone === 'body' || zone === 'lower') return 'turn-away'
    return 'angry-shake'
  }
  if (level >= 3) {
    switch (zone) {
      case 'head': return 'head-shake-no'
      case 'face': return 'pout'
      case 'body': return 'look-away'
      case 'lower': return 'stomp'       // 짜증날 때: 발 구르기
      case 'side': return 'head-shake-no'
    }
  }
  switch (zone) {
    case 'head': return 'shy'
    case 'face': return 'surprised'
    case 'body': return 'belly-squish'
    case 'lower': return 'flinch-look'  // 귀여운 레벨: 움찔하며 쳐다봄
    case 'side': return 'lean'
  }
}

/** Smoothly interpolate toward target, with dt-independent damping */
function damp(current: number, target: number, lambda: number, dt: number): number {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt))
}

// ===== MOOD → EXPRESSION DEFAULTS =====
function getMoodExpression(mood?: CharacterMood): Record<string, number> {
  switch (mood) {
    case 'happy':
    case 'celebrating':
      return { eyeSquintLeft: 0.5, eyeSquintRight: 0.45, cheekPuff: 0.08 }
    case 'concerned':
      return { eyeWideLeft: 0.15, eyeWideRight: 0.15 }
    case 'worried':
      return { eyeWideLeft: 0.25, eyeWideRight: 0.25 }
    default:
      return {}
  }
}

// ===== COMPONENT =====
export function HealthCharacterModel({ onIntroComplete, healthState, zoneMetrics, onZoneClick }: CharacterModelProps) {
  const group = useRef<THREE.Group>(null)
  const { scene } = useGLTF('/models/kindhabit_character.glb')
  const characterScene = useMemo(() => scene, [scene])

  // Bones
  const headBone = useRef<THREE.Bone | null>(null)
  const neckBone = useRef<THREE.Bone | null>(null)
  const spineBone = useRef<THREE.Bone | null>(null)
  const chestBone = useRef<THREE.Bone | null>(null)

  // Core state
  const [introComplete, setIntroComplete] = useState(false)
  const elapsed = useRef(0)

  // Tsundere state
  const reaction = useRef<ReactionState | null>(null)
  const irritation = useRef(0)
  const lastTouchTime = useRef(0)
  const isTurnedAway = useRef(false)
  const groupRotY = useRef(0)
  const targetRotY = useRef(0)
  const groupPosY = useRef(0)
  const groupPosZ = useRef(0)

  // Smooth bone targets (for interpolated motion)
  const smoothHead = useRef({ x: 0, y: 0, z: 0 })
  const smoothNeck = useRef({ x: 0, y: 0 })

  // Overlays
  const cheekPuff = useRef(0)       // 0~1
  const blushIntensity = useRef(0)
  const blushTimer = useRef(0)
  const blushDuration = useRef(0)
  const blushActive = useRef(false)

  // Idle glance
  const glance = useRef({ timer: 0, nextAt: 5 + Math.random() * 5, on: false, targetY: 0, gt: 0 })
  // Micro-movement — very subtle life-like idle sway
  const microMove = useRef({ phase: Math.random() * Math.PI * 2 })

  // Effect timers
  const excTimer = useRef(-1)  // <0 = inactive
  const steamTimer = useRef(-1)
  const heartTimer = useRef(-1)

  // Health scan effect (orange line sweeps top→bottom after intro)
  const scanTimer = useRef(-1)    // <0 = inactive, 0+ = running
  const scanDone = useRef(false)
  const scanLineRef = useRef<THREE.Mesh>(null)
  const scanGlowRef = useRef<THREE.Mesh>(null)

  // Pink indicator circles (appear after scan, pulse on data zones)
  const indicatorsVisible = useRef(false)
  const indicatorTimer = useRef(0)
  const indicatorRefs = useRef<(THREE.Mesh | null)[]>([null, null, null, null, null])

  // Morph targets (Shape Keys from Blender)
  const morphMesh = useRef<THREE.Mesh | null>(null)
  const morphIndices = useRef<Record<string, number>>({})
  const morphTargets = useRef<Record<string, number>>({}) // current smooth values

  // Blink state (independent sub-state — runs regardless of emotion)
  const blink = useRef({
    nextAt: 2 + Math.random() * 4,   // first blink 2-6s after intro
    timer: 0,
    active: false,
    phase: 0,      // 0=idle, 1=closing, 2=opening
    phaseTimer: 0,
    isDouble: false,
    doublePhase: 0,
  })

  // Expression state (driven by reactions)
  const expressionTarget = useRef<Record<string, number>>({})

  // Mesh refs - overlays
  const leftBlush = useRef<THREE.Mesh>(null)
  const rightBlush = useRef<THREE.Mesh>(null)

  // Mesh refs - effects
  const excBarRef = useRef<THREE.Mesh>(null)
  const excDotRef = useRef<THREE.Mesh>(null)
  const steamRefs = useRef<(THREE.Mesh | null)[]>([null, null, null])
  const heartRefs = useRef<(THREE.Mesh | null)[]>([null, null])

  // Find bones + morph targets + enhance material
  useEffect(() => {
    characterScene.traverse((child) => {
      if (child instanceof THREE.Bone) {
        switch (child.name) {
          case 'Head': headBone.current = child; break
          case 'Neck': neckBone.current = child; break
          case 'Spine': spineBone.current = child; break
          case 'Chest': chestBone.current = child; break
        }
      }
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.MeshStandardMaterial
        if (mat?.isMeshStandardMaterial) {
          mat.color.set(0xffffff)
          if (mat.map) mat.emissiveMap = mat.map
          mat.emissive.set(0xffffff)
          mat.emissiveIntensity = 0.85
          mat.roughness = 0.9
          mat.metalness = 0.0
          mat.needsUpdate = true
        }
        // Detect morph targets (Shape Keys)
        if (child.morphTargetDictionary && child.morphTargetInfluences) {
          morphMesh.current = child
          // Pre-compute indices for fast access in useFrame
          const dict = child.morphTargetDictionary
          morphIndices.current = { ...dict }
          // Initialize smooth values to 0
          for (const name of Object.keys(dict)) {
            morphTargets.current[name] = 0
          }
          console.log('[Character] Morph targets found:', Object.keys(dict).join(', '))
        }
      }
    })
  }, [characterScene])

  // ===== TOUCH HANDLER =====
  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!introComplete) return
    e.stopPropagation()

    // Zone-specific metric click — find closest indicator by Y distance
    const hitLocal = group.current ? group.current.worldToLocal(e.point.clone()) : e.point
    if (zoneMetrics && zoneMetrics.length > 0 && onZoneClick) {
      let closest: typeof zoneMetrics[0] | null = null
      let minDist = Infinity
      for (const m of zoneMetrics) {
        const dy = Math.abs(hitLocal.y - m.y)
        const dx = Math.abs(hitLocal.x - (m.x || 0))
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < minDist) { minDist = dist; closest = m }
      }
      if (closest && minDist < 0.15) { onZoneClick(closest); return }
    }

    // Don't interrupt dere
    if (reaction.current?.type === 'dere') return

    const hit = e.point
    const now = Date.now()

    // If turned away → peek back
    if (isTurnedAway.current) {
      reaction.current = { type: 'peek-back', timer: 0, lookX: 0, lookY: 0, zone: 'body' }
      isTurnedAway.current = false
      targetRotY.current = 0
      irritation.current = Math.max(0, irritation.current - 3)
      return
    }

    // Convert to group-local for zone detection
    const localHit = group.current ? group.current.worldToLocal(hit.clone()) : hit
    const zone = getBodyZone(localHit)

    // Look direction (world-space based)
    const lookX = Math.max(-0.25, Math.min(0.25, (0.4 - hit.y) * 0.4))
    const lookY = Math.max(-0.3, Math.min(0.3, hit.x * 0.5))

    // Irritation
    const isRapid = (now - lastTouchTime.current) < RAPID_WINDOW
    irritation.current = Math.min(10, irritation.current + (isRapid ? 1.5 : 0.8))
    lastTouchTime.current = now

    const reactionType = selectReaction(zone, irritation.current)
    reaction.current = { type: reactionType, timer: 0, lookX, lookY, zone }

    // Trigger effects
    if (reactionType === 'angry-shake' || reactionType === 'turn-away') {
      blushActive.current = true; blushTimer.current = 0
      blushDuration.current = reactionType === 'turn-away' ? 5 : 3.5
      steamTimer.current = 0
    }
    if (reactionType === 'pout') {
      cheekPuff.current = 0
      blushActive.current = true; blushTimer.current = 0; blushDuration.current = 2.5
    }
    if (reactionType === 'dere') {
      blushActive.current = true; blushTimer.current = 0; blushDuration.current = 5
      heartTimer.current = 0
    }
    if (reactionType === 'shy') {
      blushActive.current = true; blushTimer.current = 0; blushDuration.current = 2.5
    }
  }, [introComplete, zoneMetrics, onZoneClick])

  // ===== MAIN ANIMATION LOOP =====
  useFrame((_, delta) => {
    // Clamp delta to prevent jumps on tab switch
    const dt = Math.min(delta, 0.05)
    elapsed.current += dt
    const t = elapsed.current
    const head = headBone.current
    const neck = neckBone.current
    const spine = spineBone.current
    const chest = chestBone.current
    const grp = group.current

    // === INTRO (smoother version with gentle settle) ===
    if (!introComplete) {
      if (t < 1.2) {
        // Smooth bow down — cubic ease in
        const p = smoothStep(Math.min(t / 1.2, 1))
        if (head) head.rotation.x = p * 0.32
        if (neck) neck.rotation.x = p * 0.06
        if (spine) spine.rotation.x = p * 0.015
      } else if (t < 1.8) {
        // Hold bow
        if (head) head.rotation.x = 0.32
        if (neck) neck.rotation.x = 0.06
      } else if (t < 2.2) {
        // Small nod during bow
        const p = (t - 1.8) / 0.4
        if (head) head.rotation.x = 0.32 - Math.sin(p * Math.PI) * 0.10
      } else if (t < 3.2) {
        // Rise up — smooth cubic out with slight overshoot
        const p = cubicOut((t - 2.2) / 1.0)
        const overshoot = Math.sin(p * Math.PI) * 0.02 // tiny backward overshoot
        if (head) head.rotation.x = 0.32 * (1 - p) - overshoot
        if (neck) neck.rotation.x = 0.06 * (1 - p) - overshoot * 0.3
        if (spine) spine.rotation.x = 0.015 * (1 - p)
      } else if (t < 3.6) {
        // Gentle settle — spring back to neutral
        const p = (t - 3.2) / 0.4
        const settle = Math.sin(p * Math.PI * 2) * 0.015 * (1 - p)
        if (head) { head.rotation.x = settle; head.rotation.y = 0 }
        if (neck) { neck.rotation.x = settle * 0.3; neck.rotation.y = 0 }
        if (spine) spine.rotation.x = 0
      } else {
        if (head) { head.rotation.x = 0; head.rotation.y = 0 }
        if (neck) { neck.rotation.x = 0; neck.rotation.y = 0 }
        if (spine) spine.rotation.x = 0
        setIntroComplete(true)
        onIntroComplete?.()
        // Trigger health scan effect after intro
        if (!scanDone.current && healthState) {
          scanTimer.current = 0
          scanDone.current = true
        }
      }
      return
    }

    // === HEALTH SCAN TRIGGER (after intro, when healthState arrives) ===
    if (introComplete && !scanDone.current && healthState) {
      scanTimer.current = 0
      scanDone.current = true
    }

    // === IRRITATION DECAY ===
    if (irritation.current > 0) {
      irritation.current = Math.max(0, irritation.current - IRRITATION_DECAY * dt)
    }

    // === GROUP TRANSFORM LERP (damped for smoothness) ===
    if (grp) {
      groupRotY.current = damp(groupRotY.current, targetRotY.current, 5, dt)
      grp.rotation.y = groupRotY.current
      grp.position.y = 0.05 + groupPosY.current
      grp.position.z = groupPosZ.current
    }

    // === BREATHING (organic dual-wave) ===
    // Primary breath cycle + secondary micro-rhythm for organic feel
    const breathPrimary = (Math.sin(t * 1.2) + 1) / 2                    // Main breath ~0.95s cycle
    const breathSecondary = (Math.sin(t * 2.7 + 0.8) + 1) / 2           // Faster subtle overlay
    const breathCombined = breathPrimary * 0.85 + breathSecondary * 0.15  // 85% primary, 15% micro

    if (chest) {
      chest.scale.y = 1 + breathCombined * 0.060   // 6% 부풀림 (더 눈에 띄게)
      chest.scale.x = 1 + breathCombined * 0.020
      chest.scale.z = 1 + breathCombined * 0.025
    }
    if (spine && !reaction.current) {
      // Very gentle forward lean with breath (only when idle)
      spine.rotation.x = breathCombined * 0.008
      spine.rotation.z = 0
    }

    // === MICRO WEIGHT-SHIFT (idle body sway) ===
    microMove.current.phase += dt
    const mp = microMove.current.phase
    if (spine && !reaction.current) {
      // Ultra-subtle lateral sway — like shifting weight between feet
      const sway = Math.sin(mp * 0.4) * 0.006 + Math.sin(mp * 0.65 + 1.2) * 0.003
      spine.rotation.z = sway
    }

    // === REACTION ANIMATIONS ===
    const rx = reaction.current
    let headCtrl = false
    // Target values for smooth interpolation
    let headTargetX = 0, headTargetY = 0, headTargetZ = 0
    let neckTargetX = 0, neckTargetY = 0
    let useSmoothing = false // Some reactions handle their own interpolation

    if (rx) {
      rx.timer += dt
      headCtrl = true
      const T = rx.timer

      switch (rx.type) {

        // ── CUTE: shy (head pat) ──
        case 'shy': {
          if (T < 0.2) {
            const p = smoothStep(T / 0.2)
            if (spine) spine.rotation.x = -0.025 * Math.sin(p * Math.PI)
            headTargetX = p * 0.08; headTargetZ = p * 0.10
            useSmoothing = true
          } else if (T < 1.0) {
            headTargetX = 0.08; headTargetZ = 0.10; headTargetY = rx.lookY * 0.25
            // Gentle micro-sway while shy
            headTargetZ += Math.sin((T - 0.2) * 2.5) * 0.015
            useSmoothing = true
          } else if (T < 1.8) {
            const p = cubicOut((T - 1.0) / 0.8)
            headTargetX = 0.08 * (1 - p) + breathCombined * 0.015 * p
            headTargetZ = 0.10 * (1 - p)
            headTargetY = rx.lookY * 0.25 * (1 - p)
            useSmoothing = true
          } else {
            reaction.current = null; headCtrl = false
          }
          break
        }

        // ── CUTE: surprised (face touch) ──
        case 'surprised': {
          if (T < 0.12) {
            const p = smoothStep(T / 0.12)
            if (chest) { chest.scale.y = 1 + p * 0.06; chest.scale.x = 1 - p * 0.025 }
            groupPosZ.current = -p * 0.04
          } else if (T < 0.6) {
            if (head) { head.rotation.x = -0.04; head.rotation.y = rx.lookY * 0.25 }
            // Small startled wobble
            if (T < 0.35 && head) {
              head.rotation.z = Math.sin((T - 0.12) * 25) * 0.02 * (1 - (T - 0.12) / 0.23)
            }
          } else if (T < 1.4) {
            const p = cubicOut((T - 0.6) / 0.8)
            groupPosZ.current = -0.04 * (1 - p)
            if (chest) {
              chest.scale.y = 1 + 0.06 * (1 - p) + breathCombined * 0.030 * p
              chest.scale.x = 1 - 0.025 * (1 - p) + breathCombined * 0.010 * p
            }
            if (head) {
              head.rotation.x = -0.04 * (1 - p) + breathCombined * 0.015 * p
              head.rotation.y = rx.lookY * 0.25 * (1 - p)
              head.rotation.z = 0
            }
          } else {
            groupPosZ.current = 0
            reaction.current = null; headCtrl = false
          }
          break
        }

        // ── CUTE: belly squish ──
        case 'belly-squish': {
          if (T < 0.08) {
            const p = smoothStep(T / 0.08)
            if (spine) spine.rotation.x = -0.06 * p
            if (chest) {
              chest.scale.y = 1 - p * 0.12
              chest.scale.x = 1 + p * 0.06
              chest.scale.z = 1 + p * 0.06
            }
            groupPosZ.current = -p * 0.025
          } else if (T < 0.5) {
            const p = (T - 0.08) / 0.42
            // Spring bounce recovery
            const spring = 1 + Math.sin(p * Math.PI * 2.5) * 0.03 * (1 - p)
            if (chest) {
              chest.scale.y = (0.88 + p * 0.12) * spring
              chest.scale.x = (1.06 - p * 0.06) / spring
              chest.scale.z = (1.06 - p * 0.06) / spring
            }
            if (spine) spine.rotation.x = -0.06 * (1 - cubicOut(p))
            if (head) {
              head.rotation.x = rx.lookX * cubicOut(p)
              head.rotation.y = rx.lookY * cubicOut(p)
            }
            groupPosZ.current = -0.025 * (1 - cubicOut(p))
          } else if (T < 1.3) {
            groupPosZ.current = 0
            if (head) { head.rotation.x = rx.lookX; head.rotation.y = rx.lookY }
          } else if (T < 2.1) {
            const p = cubicOut((T - 1.3) / 0.8)
            if (head) {
              head.rotation.x = rx.lookX * (1 - p) + breathCombined * 0.015 * p
              head.rotation.y = rx.lookY * (1 - p)
            }
          } else {
            groupPosZ.current = 0
            reaction.current = null; headCtrl = false
          }
          break
        }

        // ── CUTE: lean (side touch) ──
        case 'lean': {
          const dir = rx.lookY > 0 ? -1 : 1
          if (T < 0.2) {
            const p = cubicOut(T / 0.2)
            if (spine) spine.rotation.z = dir * 0.07 * p
            if (head) head.rotation.z = dir * -0.04 * p
          } else if (T < 1.0) {
            if (spine) spine.rotation.z = dir * 0.07
            if (head) {
              head.rotation.z = dir * -0.04
              head.rotation.y = rx.lookY
              head.rotation.x = rx.lookX
              // Gentle sway while leaning
              head.rotation.z += Math.sin((T - 0.2) * 3) * 0.01
            }
          } else if (T < 1.8) {
            const p = cubicOut((T - 1.0) / 0.8)
            if (spine) spine.rotation.z = dir * 0.07 * (1 - p)
            if (head) {
              head.rotation.z = dir * -0.04 * (1 - p)
              head.rotation.y = rx.lookY * (1 - p)
              head.rotation.x = rx.lookX * (1 - p) + breathCombined * 0.015 * p
            }
          } else {
            reaction.current = null; headCtrl = false
          }
          break
        }

        // ── ANNOYED: pout (face) ──
        case 'pout': {
          if (T < 0.25) {
            const p = cubicOut(T / 0.25)
            cheekPuff.current = p
            headTargetY = -rx.lookY * 0.25 * p
            headTargetX = -0.04 * p
            useSmoothing = true
          } else if (T < 2.0) {
            cheekPuff.current = 1
            headTargetY = -rx.lookY * 0.25
            headTargetX = -0.04
            useSmoothing = true
            // Small annoyed head wobble (decaying)
            if (T < 0.7) {
              const wt = T - 0.25
              headTargetZ = Math.sin(wt * 14) * 0.025 * (1 - wt / 0.45)
            }
          } else if (T < 3.0) {
            const p = cubicOut((T - 2.0) / 1.0)
            cheekPuff.current = 1 - p
            headTargetY = -rx.lookY * 0.25 * (1 - p)
            headTargetX = -0.04 * (1 - p) + breathCombined * 0.015 * p
            headTargetZ = 0
            useSmoothing = true
          } else {
            cheekPuff.current = 0
            reaction.current = null; headCtrl = false
          }
          break
        }

        // ── ANNOYED: head shake no ──
        case 'head-shake-no': {
          if (T < 0.12) {
            if (head) head.rotation.x = -0.025 * smoothStep(T / 0.12)
          } else if (T < 1.3) {
            const s = T - 0.12
            const decay = Math.max(0, 1 - s / 1.18)
            // Slower frequency for more natural shake
            const freq = s * 18
            if (head) {
              head.rotation.y = Math.sin(freq) * 0.12 * decay * decay // quadratic decay
              head.rotation.x = -0.025
            }
            if (neck) neck.rotation.y = Math.sin(freq) * 0.04 * decay * decay
          } else if (T < 2.2) {
            const p = cubicOut((T - 1.3) / 0.9)
            if (head) {
              head.rotation.y = 0
              head.rotation.x = -0.025 * (1 - p) + breathCombined * 0.015 * p
            }
            if (neck) neck.rotation.y = 0
          } else {
            reaction.current = null; headCtrl = false
          }
          break
        }

        // ── ANNOYED: stomp ──
        case 'stomp': {
          if (T < 1.5) {
            const decay = Math.max(0, 1 - T / 1.5)
            // More organic stomp — slower frequency, smoother envelope
            groupPosY.current = Math.abs(Math.sin(T * 16)) * 0.020 * decay * decay
            if (head) {
              head.rotation.x = -0.035
              head.rotation.z = Math.sin(T * 10) * 0.015 * decay
            }
            if (spine) spine.rotation.x = -0.018 * decay
          } else if (T < 2.2) {
            groupPosY.current = 0
            const p = cubicOut((T - 1.5) / 0.7)
            if (head) {
              head.rotation.x = -0.035 * (1 - p) + breathCombined * 0.015 * p
              head.rotation.z = 0
            }
          } else {
            groupPosY.current = 0; reaction.current = null; headCtrl = false
          }
          break
        }

        // ── ANNOYED: look away ──
        case 'look-away': {
          const dir = rx.lookY > 0 ? -1 : 1
          if (T < 0.2) {
            const p = cubicOut(T / 0.2)
            if (head) { head.rotation.y = dir * 0.45 * p; head.rotation.x = -0.025 }
            if (neck) neck.rotation.y = dir * 0.12 * p
          } else if (T < 1.6) {
            if (head) {
              head.rotation.y = dir * 0.45
              head.rotation.x = -0.025
              // Small annoyed micro-movement while looking away
              if (T < 0.55) {
                head.rotation.x = -0.025 + Math.sin((T - 0.2) * 7) * 0.015 * (1 - (T - 0.2) / 0.35)
              }
            }
            if (neck) neck.rotation.y = dir * 0.12
          } else if (T < 2.5) {
            const p = cubicOut((T - 1.6) / 0.9)
            if (head) {
              head.rotation.y = dir * 0.45 * (1 - p)
              head.rotation.x = -0.025 * (1 - p) + breathCombined * 0.015 * p
            }
            if (neck) neck.rotation.y = dir * 0.12 * (1 - p)
          } else {
            reaction.current = null; headCtrl = false
          }
          break
        }

        // ── ANGRY: shake ──
        case 'angry-shake': {
          if (T < 0.15) {
            if (spine) spine.rotation.x = -0.04 * Math.sin(smoothStep(T / 0.15) * Math.PI)
          } else if (T < 2.2) {
            const s = T - 0.15
            if (s < 1.6) {
              const decay = Math.max(0, 1 - s / 1.6)
              // Slower, more deliberate angry shake
              const freq = s * 35
              if (head) {
                head.rotation.z = Math.sin(freq) * 0.10 * decay * decay
                head.rotation.y = Math.sin(freq * 0.7) * 0.04 * decay
                head.rotation.x = -0.025
              }
              if (spine) spine.rotation.z = Math.sin(freq) * 0.03 * decay * decay
              if (chest) chest.rotation.z = Math.sin(freq * 1.1) * 0.025 * decay * decay
            } else {
              if (head) { head.rotation.z = 0; head.rotation.x = breathCombined * 0.015 }
              if (spine) spine.rotation.z = 0
              if (chest) chest.rotation.z = 0
            }
          } else if (T < 3.2) {
            const p = cubicOut((T - 2.2) / 1.0)
            if (head) {
              head.rotation.x = breathCombined * 0.015
              head.rotation.z = 0
              head.rotation.y = 0
            }
            // Let breathing handle head naturally
            void p
          } else {
            reaction.current = null; headCtrl = false
          }
          break
        }

        // ── ANGRY: turn away ──
        case 'turn-away': {
          if (T < 0.12) {
            if (spine) spine.rotation.x = -0.04 * smoothStep(T / 0.12)
          } else if (T < 0.7) {
            targetRotY.current = Math.PI
            if (head) head.rotation.z = Math.sin(T * 25) * 0.04 * Math.max(0, 1 - (T - 0.12) / 0.58)
          } else if (T < 2.7) {
            targetRotY.current = Math.PI
            if (head) { head.rotation.x = breathCombined * 0.008; head.rotation.y = 0; head.rotation.z = 0 }
            if (spine) spine.rotation.x = -0.015
          } else if (T < 3.7) {
            // Peek back slightly then turn away again
            const p = (T - 2.7) / 1.0
            if (p < 0.3) {
              if (head) head.rotation.y = -0.30 * cubicOut(p / 0.3)
            } else if (p < 0.7) {
              if (head) head.rotation.y = -0.30
            } else {
              if (head) head.rotation.y = -0.30 * (1 - cubicOut((p - 0.7) / 0.3))
            }
          } else {
            isTurnedAway.current = true
            targetRotY.current = Math.PI
            if (head) { head.rotation.y = 0; head.rotation.x = breathCombined * 0.008 }
            headCtrl = false
          }
          break
        }

        // ── PEEK BACK (from turned-away, on touch) ──
        case 'peek-back': {
          if (T < 0.6) {
            const p = cubicOut(T / 0.6)
            if (head) {
              head.rotation.y = -0.25 * p
              head.rotation.x = breathCombined * 0.015
            }
          } else if (T < 1.8) {
            if (head) {
              head.rotation.y = -0.25
              head.rotation.x = breathCombined * 0.015
              // Small curious tilt
              head.rotation.z = Math.sin((T - 0.6) * 2) * 0.02
            }
          } else if (T < 2.8) {
            const p = cubicOut((T - 1.8) / 1.0)
            if (head) {
              head.rotation.y = -0.25 * (1 - p)
              head.rotation.x = breathCombined * 0.015
              head.rotation.z = 0.02 * (1 - p)
            }
          } else {
            reaction.current = null; headCtrl = false
          }
          break
        }

        // ── DERE: approach + hearts ──
        case 'dere': {
          if (T < 0.6) {
            const p = smoothStep(T / 0.6)
            if (head) {
              head.rotation.z = Math.sin(p * Math.PI * 2) * 0.04
              head.rotation.x = 0.06 * p
            }
          } else if (T < 1.8) {
            const p = smoothStep((T - 0.6) / 1.2)
            groupPosZ.current = p * 0.10
            if (head) {
              head.rotation.x = 0.06
              head.rotation.z = 0.06 * p
            }
          } else if (T < 3.8) {
            groupPosZ.current = 0.10
            if (head) {
              const gp = (T - 1.8) / 2.0
              // Gentle nuzzle motion
              if (gp > 0.25 && gp < 0.55) {
                const np = (gp - 0.25) / 0.3
                head.rotation.x = 0.06 - Math.sin(np * Math.PI) * 0.08
              } else {
                head.rotation.x = 0.06
              }
              head.rotation.z = 0.06 + Math.sin((T - 1.8) * 1.5) * 0.015
            }
          } else if (T < 5.0) {
            const p = cubicOut((T - 3.8) / 1.2)
            groupPosZ.current = 0.10 * (1 - p)
            if (head) {
              head.rotation.x = 0.06 * (1 - p) + breathCombined * 0.015 * p
              head.rotation.z = 0.06 * (1 - p)
            }
          } else {
            groupPosZ.current = 0
            irritation.current = 0
            reaction.current = null; headCtrl = false
          }
          break
        }

        // ── FALLBACK: flinch-look ──
        case 'flinch-look':
        default: {
          if (T < 0.1) {
            if (spine) spine.rotation.x = -0.04 * Math.sin(smoothStep(T / 0.1) * Math.PI)
          } else if (T < 0.5) {
            const p = cubicOut((T - 0.1) / 0.4)
            if (head) { head.rotation.x = p * rx.lookX; head.rotation.y = p * rx.lookY }
            if (neck) { neck.rotation.x = p * rx.lookX * 0.2; neck.rotation.y = p * rx.lookY * 0.15 }
          } else if (T < 1.4) {
            if (head) { head.rotation.x = rx.lookX; head.rotation.y = rx.lookY }
          } else if (T < 2.2) {
            const p = cubicOut((T - 1.4) / 0.8)
            if (head) {
              head.rotation.x = rx.lookX * (1 - p) + breathCombined * 0.015 * p
              head.rotation.y = rx.lookY * (1 - p)
            }
            if (neck) {
              neck.rotation.x = rx.lookX * 0.2 * (1 - p) + breathCombined * 0.006 * p
              neck.rotation.y = rx.lookY * 0.15 * (1 - p)
            }
          } else {
            reaction.current = null; headCtrl = false
          }
          break
        }
      }

      // Apply smooth interpolation for reactions that requested it
      if (useSmoothing && head) {
        smoothHead.current.x = damp(smoothHead.current.x, headTargetX, 12, dt)
        smoothHead.current.y = damp(smoothHead.current.y, headTargetY, 12, dt)
        smoothHead.current.z = damp(smoothHead.current.z, headTargetZ, 12, dt)
        head.rotation.x = smoothHead.current.x
        head.rotation.y = smoothHead.current.y
        head.rotation.z = smoothHead.current.z
      } else if (head) {
        // Sync smooth state to prevent jumps
        smoothHead.current.x = head.rotation.x
        smoothHead.current.y = head.rotation.y
        smoothHead.current.z = head.rotation.z
      }
    }

    // === IDLE HEAD (when not reacting) ===
    if (!headCtrl) {
      const ig = glance.current
      ig.timer += dt

      // Breathing-linked head micro-bob (always active in idle)
      const breathHead = breathCombined * 0.012

      if (!ig.on) {
        if (ig.timer > ig.nextAt) {
          ig.on = true; ig.gt = 0; ig.timer = 0
          ig.targetY = (Math.random() - 0.5) * 0.25
        }
        // Smooth idle head — breathing bob + micro tilt
        const microTilt = Math.sin(mp * 0.3 + 2.0) * 0.004
        headTargetX = breathHead
        headTargetY = 0
        headTargetZ = microTilt
      } else {
        ig.gt += dt
        if (ig.gt < 0.4) {
          const p = smoothStep(ig.gt / 0.4)
          headTargetY = ig.targetY * p
          headTargetX = breathHead
        } else if (ig.gt < 1.8) {
          headTargetY = ig.targetY
          headTargetX = breathHead
          // Micro-drift while glancing
          headTargetY += Math.sin((ig.gt - 0.4) * 1.5) * 0.01
        } else if (ig.gt < 2.4) {
          const p = smoothStep((ig.gt - 1.8) / 0.6)
          headTargetY = ig.targetY * (1 - p)
          headTargetX = breathHead
        } else {
          ig.on = false; ig.timer = 0; ig.nextAt = 3 + Math.random() * 7
        }
      }

      // Damped interpolation for ultra-smooth idle motion
      smoothHead.current.x = damp(smoothHead.current.x, headTargetX, 6, dt)
      smoothHead.current.y = damp(smoothHead.current.y, headTargetY, 6, dt)
      smoothHead.current.z = damp(smoothHead.current.z, headTargetZ, 6, dt)

      if (head) {
        head.rotation.x = smoothHead.current.x
        head.rotation.y = smoothHead.current.y
        head.rotation.z = smoothHead.current.z
      }

      // Neck follows head gently
      neckTargetX = breathCombined * 0.006
      neckTargetY = smoothHead.current.y * 0.25
      smoothNeck.current.x = damp(smoothNeck.current.x, neckTargetX, 4, dt)
      smoothNeck.current.y = damp(smoothNeck.current.y, neckTargetY, 4, dt)
      if (neck) {
        neck.rotation.x = smoothNeck.current.x
        neck.rotation.y = smoothNeck.current.y
      }
    }

    // === BLUSH ===
    if (blushActive.current) {
      blushTimer.current += dt
      const bt = blushTimer.current
      const bd = blushDuration.current
      if (bt < 0.3) blushIntensity.current = smoothStep(bt / 0.3)
      else if (bt < bd - 1.2) blushIntensity.current = 1
      else if (bt < bd) blushIntensity.current = Math.max(0, smoothStep(1 - (bt - (bd - 1.2)) / 1.2))
      else { blushActive.current = false; blushIntensity.current = 0 }
    }
    if (leftBlush.current && rightBlush.current) {
      const op = blushIntensity.current * 0.75
      ;(leftBlush.current.material as THREE.MeshBasicMaterial).opacity = op
      ;(rightBlush.current.material as THREE.MeshBasicMaterial).opacity = op
      leftBlush.current.visible = blushIntensity.current > 0.01
      rightBlush.current.visible = blushIntensity.current > 0.01
    }

    // === CHEEK PUFF (head scale — damped) ===
    if (head) {
      if (cheekPuff.current > 0.01) {
        const targetSX = 1 + cheekPuff.current * 0.07
        const targetSZ = 1 + cheekPuff.current * 0.05
        head.scale.x = damp(head.scale.x, targetSX, 10, dt)
        head.scale.z = damp(head.scale.z, targetSZ, 10, dt)
      } else {
        head.scale.x = damp(head.scale.x, 1, 8, dt)
        head.scale.z = damp(head.scale.z, 1, 8, dt)
      }
    }

    // === MORPH TARGETS (Shape Key expressions) ===
    if (morphMesh.current && morphMesh.current.morphTargetInfluences) {
      const infl = morphMesh.current.morphTargetInfluences
      const idx = morphIndices.current
      const mt = morphTargets.current
      const expr = expressionTarget.current

      // -- Set expression targets based on current reaction --
      for (const key of Object.keys(idx)) {
        expr[key] = 0
      }

      // Map reaction → expression
      if (rx) {
        switch (rx.type) {
          case 'shy':
            expr.eyeSquintLeft = 0.85; expr.eyeSquintRight = 0.85  // 확실한 ^^ 눈
            expr.cheekPuff = 0.12  // 살짝 볼 부풀림 (행복감)
            break
          case 'surprised':
            expr.eyeWideLeft = 0.8; expr.eyeWideRight = 0.8
            break
          case 'pout':
            expr.cheekPuff = cheekPuff.current * 0.7
            break
          case 'head-shake-no':
          case 'angry-shake':
          case 'turn-away':
            // 화남은 눈 morph 없이 몸 애니메이션 + 스팀 + 블러시로 표현
            break
          case 'dere':
            expr.eyeSquintLeft = 0.9; expr.eyeSquintRight = 0.85   // 최대 행복 ^^ 눈
            expr.cheekPuff = 0.25  // 볼 부풀림 (좋아함)
            break
          case 'peek-back':
            expr.eyeWideLeft = 0.3; expr.eyeWideRight = 0.3
            break
          case 'stomp':
          case 'look-away':
            // 짜증은 눈 morph 없이 몸 애니메이션으로 표현
            break
        }
      }

      // -- Independent blink system (runs on top of expressions) --
      const b = blink.current
      if (introComplete) {
        b.timer += dt

        if (!b.active) {
          // Waiting for next blink
          if (b.timer >= b.nextAt) {
            b.active = true
            b.phase = 1  // start closing
            b.phaseTimer = 0
            b.isDouble = Math.random() < 0.12  // 12% chance double blink
            b.doublePhase = 0
          }
        }

        if (b.active) {
          b.phaseTimer += dt
          let blinkValue = 0

          if (b.phase === 1) {
            // Closing: 0.07s fast close (cubicOut)
            const p = Math.min(b.phaseTimer / 0.07, 1)
            blinkValue = cubicOut(p)
            if (p >= 1) { b.phase = 2; b.phaseTimer = 0 }
          } else if (b.phase === 2) {
            // Opening: 0.10s slower open
            const p = Math.min(b.phaseTimer / 0.10, 1)
            blinkValue = 1 - cubicOut(p)
            if (p >= 1) {
              if (b.isDouble && b.doublePhase === 0) {
                // Double blink: brief pause then blink again
                b.doublePhase = 1
                b.phase = 1
                b.phaseTimer = -0.05 // tiny pause before second blink
              } else {
                b.active = false
                b.timer = 0
                b.nextAt = 2.5 + Math.random() * 4.5 // 2.5-7s random
                blinkValue = 0
              }
            }
          }

          if (b.active) {
            // Override blink on top of expression (max with expression value)
            // Left eye leads by ~15ms for asymmetry
            const leftDelay = 0.015
            let leftBlink = blinkValue
            if (b.phaseTimer < leftDelay) leftBlink = 0
            expr.eyeBlinkLeft = Math.max(expr.eyeBlinkLeft || 0, leftBlink)
            expr.eyeBlinkRight = Math.max(expr.eyeBlinkRight || 0, blinkValue)
          }
        }
      }

      // -- Mood-based idle expression (health state) --
      if (introComplete && !rx && healthState) {
        const moodExpr = getMoodExpression(healthState.mood)
        for (const [key, val] of Object.entries(moodExpr)) {
          expr[key] = (expr[key] || 0) + val
        }
      }

      // -- Micro-expressions (breathing-linked) --
      if (introComplete && !rx) {
        // Subtle squint micro-oscillation (life-like)
        const microSquint = Math.sin(t * 0.6 + 0.5) * 0.04
        expr.eyeSquintLeft = (expr.eyeSquintLeft || 0) + Math.max(0, microSquint)
        expr.eyeSquintRight = (expr.eyeSquintRight || 0) + Math.max(0, microSquint * 0.8)
        // Breathing-linked cheek micro-puff
        expr.cheekPuff = (expr.cheekPuff || 0) + breathCombined * 0.03
      }

      // -- Apply all morph targets with smooth damping --
      const morphSpeed = 10  // Higher = faster response
      for (const [name, targetIdx] of Object.entries(idx)) {
        const target = expr[name] || 0
        mt[name] = damp(mt[name] || 0, target, morphSpeed, dt)
        // Apply to mesh (clamp 0-1)
        infl[targetIdx] = Math.max(0, Math.min(1, mt[name]))
      }
    }

    // === EFFECTS ===
    // Exclamation !
    if (excTimer.current >= 0) {
      excTimer.current += dt
      const et = excTimer.current
      let sc = 0
      if (et < 0.12) sc = springOut(et / 0.12) // spring pop-in
      else if (et < 0.7) sc = 1
      else if (et < 1.0) sc = 1 - cubicOut((et - 0.7) / 0.3)
      else { excTimer.current = -1; sc = 0 }
      if (excBarRef.current) { excBarRef.current.visible = sc > 0.01; excBarRef.current.scale.setScalar(sc) }
      if (excDotRef.current) { excDotRef.current.visible = sc > 0.01; excDotRef.current.scale.setScalar(sc) }
    } else {
      if (excBarRef.current) excBarRef.current.visible = false
      if (excDotRef.current) excDotRef.current.visible = false
    }

    // Steam
    if (steamTimer.current >= 0) {
      steamTimer.current += dt
      steamRefs.current.forEach((mesh, i) => {
        if (!mesh) return
        const offset = i * 0.18
        const lt = steamTimer.current - offset
        if (lt > 0 && lt < 1.8) {
          mesh.visible = true
          mesh.position.y = 0.65 + lt * 0.08
          mesh.position.x = (i - 1) * 0.06 + Math.sin(lt * 2 + i) * 0.01
          mesh.position.z = 0.16
          const op = lt < 0.35 ? smoothStep(lt / 0.35) : Math.max(0, 1 - (lt - 0.35) / 1.45)
          ;(mesh.material as THREE.MeshBasicMaterial).opacity = op * 0.6
          mesh.scale.setScalar(1 + lt * 1.8)
        } else {
          mesh.visible = false
        }
      })
      if (steamTimer.current > 2.3) steamTimer.current = -1
    } else {
      steamRefs.current.forEach(m => { if (m) m.visible = false })
    }

    // Hearts
    if (heartTimer.current >= 0) {
      heartTimer.current += dt
      const baseX = [-0.08, 0.06]
      heartRefs.current.forEach((mesh, i) => {
        if (!mesh) return
        const offset = i * 0.35
        const lt = heartTimer.current - offset
        if (lt > 0 && lt < 2.5) {
          mesh.visible = true
          mesh.position.y = 0.55 + lt * 0.06
          mesh.position.x = baseX[i] + Math.sin(lt * 2.5 + i * 1.5) * 0.025
          mesh.position.z = 0.16
          const op = lt < 0.35 ? smoothStep(lt / 0.35) : Math.max(0, 1 - (lt - 0.35) / 2.15)
          const sc = lt < 0.25 ? springOut(lt / 0.25) : 1
          ;(mesh.material as THREE.MeshBasicMaterial).opacity = op * 0.75
          mesh.scale.setScalar(sc * 0.06)
        } else {
          mesh.visible = false
        }
      })
      if (heartTimer.current > 3.5) heartTimer.current = -1
    } else {
      heartRefs.current.forEach(m => { if (m) m.visible = false })
    }

    // Health scan line (orange sweep top→bottom) — wide & slow
    if (scanTimer.current >= 0) {
      scanTimer.current += dt
      const st = scanTimer.current
      const SCAN_DUR = 3.5   // slower sweep
      const TOP_Y = 0.78
      const BOT_Y = -0.18
      const RANGE = TOP_Y - BOT_Y

      if (st < SCAN_DUR) {
        const p = smoothStep(st / SCAN_DUR)
        const y = TOP_Y - p * RANGE

        if (scanLineRef.current) {
          scanLineRef.current.visible = true
          scanLineRef.current.position.y = y
          const fadeIn = st < SCAN_DUR * 0.08 ? smoothStep(st / (SCAN_DUR * 0.08)) : 1
          const fadeOut = st > SCAN_DUR * 0.88 ? smoothStep((SCAN_DUR - st) / (SCAN_DUR * 0.12)) : 1
          ;(scanLineRef.current.material as THREE.MeshBasicMaterial).opacity = fadeIn * fadeOut * 0.85
        }
        if (scanGlowRef.current) {
          scanGlowRef.current.visible = true
          scanGlowRef.current.position.y = y + 0.015
          const fadeIn = st < SCAN_DUR * 0.08 ? smoothStep(st / (SCAN_DUR * 0.08)) : 1
          const fadeOut = st > SCAN_DUR * 0.88 ? smoothStep((SCAN_DUR - st) / (SCAN_DUR * 0.12)) : 1
          ;(scanGlowRef.current.material as THREE.MeshBasicMaterial).opacity = fadeIn * fadeOut * 0.3
        }
      } else {
        scanTimer.current = -1
        if (scanLineRef.current) scanLineRef.current.visible = false
        if (scanGlowRef.current) scanGlowRef.current.visible = false
        // After scan → show pink indicators
        if (zoneMetrics && zoneMetrics.length > 0) {
          indicatorsVisible.current = true
          indicatorTimer.current = 0
        }
      }
    }

    // Indicator circles — fade in after scan, color by status (초록/노랑)
    if (indicatorsVisible.current && zoneMetrics) {
      indicatorTimer.current += dt
      const it = indicatorTimer.current
      const fadeIn = Math.min(it / 0.8, 1)
      const pulse = 0.85 + Math.sin(it * 2.0) * 0.15
      const baseOp = fadeIn * pulse * 0.45

      indicatorRefs.current.forEach((mesh, i) => {
        if (!mesh || i >= zoneMetrics.length) { if (mesh) mesh.visible = false; return }
        const m = zoneMetrics[i]
        mesh.visible = true
        mesh.position.x = m.x || 0
        mesh.position.y = m.y
        // 정상=초록(#4CAF50), 비정상=노랑(#FFB300)
        const mat = mesh.material as THREE.MeshBasicMaterial
        mat.color.set(m.status === 'normal' ? 0x4CAF50 : 0xFFB300)
        mat.opacity = baseOp
        const sc = 0.035 + Math.sin(it * 2.0 + i * 0.5) * 0.005
        mesh.scale.setScalar(sc / 0.035)
      })
    }
  })

  // ===== MATERIALS =====
  // Scan line — bright orange (depthTest:false → 항상 캐릭터 앞에 렌더링)
  const scanLineMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0xff8c00, transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
  }), [])
  // Scan glow — wider, softer orange
  const scanGlowMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0xffa500, transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
  }), [])
  // Indicator circles — data zone markers (depthTest:false → 캐릭터에 가려지지 않음)
  const indicatorMats = useMemo(() => [
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: THREE.DoubleSide }),
  ], [])

  const blushMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0xff8fa0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  }), [])

  const excMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0xffdd44, depthWrite: false, side: THREE.DoubleSide,
  }), [])

  const steamMats = useMemo(() => [
    new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0, depthWrite: false }),
  ], [])

  const heartMats = useMemo(() => [
    new THREE.MeshBasicMaterial({ color: 0xff6b8a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ color: 0xff6b8a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  ], [])

  const heartGeo = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, -0.35)
    s.bezierCurveTo(-0.02, -0.15, -0.5, 0.0, -0.5, 0.3)
    s.bezierCurveTo(-0.5, 0.6, -0.15, 0.7, 0, 0.5)
    s.bezierCurveTo(0.15, 0.7, 0.5, 0.6, 0.5, 0.3)
    s.bezierCurveTo(0.5, 0.0, 0.02, -0.15, 0, -0.35)
    return new THREE.ShapeGeometry(s)
  }, [])

  // ===== JSX =====
  return (
    <group ref={group} position={[0, 0.05, 0]}>
      <primitive object={characterScene} scale={1.5} onPointerDown={handlePointerDown} />

      {/* Health scan line — wide horizontal orange bar sweeps top→bottom */}
      <mesh ref={scanLineRef} position={[0, 0.78, 0.22]} visible={false} material={scanLineMat} renderOrder={10}>
        <planeGeometry args={[0.7, 0.006]} />
      </mesh>
      <mesh ref={scanGlowRef} position={[0, 0.78, 0.20]} visible={false} material={scanGlowMat} renderOrder={9}>
        <planeGeometry args={[0.8, 0.06]} />
      </mesh>

      {/* Indicator circles — data zone markers */}
      {indicatorMats.map((mat, i) => (
        <mesh key={`ind-${i}`} ref={el => { indicatorRefs.current[i] = el }}
          position={[0, 0.4, 0.22]} visible={false} material={mat} renderOrder={8}>
          <circleGeometry args={[0.035, 20]} />
        </mesh>
      ))}

      {/* Blush circles on cheeks */}
      <mesh ref={leftBlush} position={[-0.09, 0.47, 0.12]} visible={false} material={blushMat}>
        <circleGeometry args={[0.05, 16]} />
      </mesh>
      <mesh ref={rightBlush} position={[0.09, 0.47, 0.12]} visible={false} material={blushMat}>
        <circleGeometry args={[0.05, 16]} />
      </mesh>

      {/* Exclamation mark ! — z=0.18 to be IN FRONT of character */}
      <mesh ref={excBarRef} position={[0, 0.72, 0.18]} visible={false} material={excMat}>
        <boxGeometry args={[0.025, 0.09, 0.01]} />
      </mesh>
      <mesh ref={excDotRef} position={[0, 0.665, 0.18]} visible={false} material={excMat}>
        <sphereGeometry args={[0.013, 8, 8]} />
      </mesh>

      {/* Steam particles (anger) — z=0.16 in front of head top */}
      {steamMats.map((mat, i) => (
        <mesh key={`steam-${i}`} ref={el => { steamRefs.current[i] = el }}
          position={[(i - 1) * 0.06, 0.65, 0.16]} visible={false} material={mat}>
          <circleGeometry args={[0.025, 8]} />
        </mesh>
      ))}

      {/* Heart particles (dere) — z=0.16 in front of face */}
      {heartMats.map((mat, i) => (
        <mesh key={`heart-${i}`} ref={el => { heartRefs.current[i] = el }}
          position={[i === 0 ? -0.1 : 0.08, 0.55, 0.16]} visible={false}
          material={mat} geometry={heartGeo} />
      ))}
    </group>
  )
}

useGLTF.preload('/models/kindhabit_character.glb')
