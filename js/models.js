import * as THREE from "three"
import { GLTFLoader } from "../node_modules/three/examples/jsm/loaders/GLTFLoader.js"

/** Map catalog plane ids to amvlab GLB files (nologo variants for Demi Airline paint). */
export const MODEL_FILES = {
  b737: "models/b737.glb",
  a320: "models/a320.glb",
  a350: "models/a350.glb",
  b787: "models/b787.glb",
  a380: "models/a380.glb",
  evtol: "models/evtol.glb",
  drone: "models/drone.glb",
}

/**
 * Closest real AMV Lab mesh for hangar planes that lack a dedicated GLB.
 * 747 is built as a high-detail procedural Queen (never aliased to A380).
 */
export const MODEL_ALIASES = {
  b777: "b787",
  g650: "a320",
}

function resolveModelId(id) {
  return MODEL_ALIASES[id] || id
}

/**
 * Extra yaw (radians) after auto-orient.
 * eVTOL/drone have wingtip rotors taller than any fin — fin-seek flips them.
 */
const FACE_YAW = {
  // AMV eVTOL GLB is span-long on Z with cabin on X; +90° puts nose at +Z.
  evtol: Math.PI / 2,
}

/** Skip tall-fin nose seek — rotors/props confuse the peak. */
const SKIP_FIN_SEEK = new Set(["evtol", "drone"])

const cache = new Map()
const loader = new GLTFLoader()
const _corner = new THREE.Vector3()

export function hasRealModel(id) {
  return Boolean(MODEL_FILES[resolveModelId(id)])
}

export function cachedModelCount() {
  return cache.size
}

export async function preloadAircraftModels(onProgress) {
  const entries = Object.entries(MODEL_FILES)
  let done = 0
  await Promise.all(entries.map(async ([id, path]) => {
    try {
      const gltf = await loader.loadAsync(path)
      cache.set(id, gltf.scene)
    } catch (error) {
      console.warn(`Could not load ${path}`, error)
    }
    done += 1
    if (onProgress) onProgress(done, entries.length)
  }))
}

function settleOnGround(model) {
  model.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(model)
  model.position.y -= box.min.y
}

function recenterXZ(model) {
  model.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(model)
  const center = box.getCenter(new THREE.Vector3())
  model.position.x -= center.x
  model.position.z -= center.z
}

function measureSize(model) {
  model.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
}

/**
 * Find the tail-fin direction: tallest vertices near the fuselage centerline.
 * Ignoring large |x| avoids A350 winglets and eVTOL wingtip rotors stealing the peak.
 */
function peakHighXZ(model) {
  model.updateMatrixWorld(true)
  const size = measureSize(model)
  const xGate = Math.max(size.x * 0.18, 1.5)
  const samples = []
  let hiY = -Infinity
  model.traverse((node) => {
    if (!node.isMesh || !node.geometry?.attributes?.position) return
    const pos = node.geometry.attributes.position
    const step = Math.max(1, Math.floor(pos.count / 1200))
    for (let i = 0; i < pos.count; i += step) {
      _corner.fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld)
      if (Math.abs(_corner.x) > xGate) continue
      samples.push(_corner.x, _corner.y, _corner.z)
      if (_corner.y > hiY) hiY = _corner.y
    }
  })
  if (!samples.length || hiY === -Infinity) return { x: 0, z: -1, y: 0 }
  let sumX = 0
  let sumZ = 0
  let count = 0
  for (let i = 0; i < samples.length; i += 3) {
    const y = samples[i + 1]
    if (y < hiY - 0.45) continue
    sumX += samples[i]
    sumZ += samples[i + 2]
    count += 1
  }
  if (!count) return { x: 0, z: -1, y: hiY }
  return { x: sumX / count, z: sumZ / count, y: hiY }
}

/**
 * Put height on Y, wingspan on X, fuselage length on Z.
 * Important for jets whose wings are longer than the fuselage (A380, 787) —
 * a naive "longest axis = nose" leaves them flying sideways.
 */
function alignAircraftAxes(model, def) {
  model.rotation.set(0, 0, 0)
  let size = measureSize(model)

  // 1) Shortest dimension is height → map it onto Y.
  if (size.x <= size.y && size.x <= size.z) {
    model.rotation.z = -Math.PI / 2
  } else if (size.z <= size.y && size.z <= size.x) {
    model.rotation.x = Math.PI / 2
  }
  model.updateMatrixWorld(true)
  size = measureSize(model)

  // 2) Prefer catalog length vs span so wide-body jets face +Z.
  const wantLengthOnZ = def.length >= def.wing.span
  if (wantLengthOnZ) {
    if (size.x > size.z * 1.02) model.rotation.y += Math.PI / 2
  } else if (size.z > size.x * 1.02) {
    model.rotation.y += Math.PI / 2
  }
  model.updateMatrixWorld(true)

  // 3) Yaw so the tall fin sits at −Z and the nose at +Z.
  //    Fixes models (A350) whose length≈span so step 2 leaves them sideways.
  //    Skip for multirotors — rotors beat the fin and spin the craft wrong.
  if (!SKIP_FIN_SEEK.has(def.id)) faceNosePositiveZ(model)
}

/** Rotate around Y until the high fin lies toward −Z (nose toward +Z). */
function faceNosePositiveZ(model) {
  const peak = peakHighXZ(model)
  const reach = Math.hypot(peak.x, peak.z)
  if (reach < 0.2) return
  // Current fin angle from +Z; we want it at π (−Z).
  const finAngle = Math.atan2(peak.x, peak.z)
  model.rotation.y += Math.PI - finAngle
  model.updateMatrixWorld(true)
}

function collectGearMeshes(root) {
  const gear = []
  root.traverse((node) => {
    if (!node.isMesh) return
    const name = `${node.name} ${node.parent?.name || ""}`.toLowerCase()
    if (/(gear|wheel|tire|tyre|strut|oleo|bogie)/.test(name)) gear.push(node)
  })
  return gear
}

function collectSpinNodes(root) {
  const nodes = []
  root.traverse((node) => {
    const name = node.name.toLowerCase()
    if (/(prop|rotor|blade|fan)/.test(name) && node.isObject3D) nodes.push(node)
  })
  return nodes
}

/** Make baked GLB paints read like real polished airframes. */
function polishRealMaterials(root) {
  root.traverse((node) => {
    if (!node.isMesh || !node.material) return
    const list = [].concat(node.material)
    for (const mat of list) {
      if (!mat || !mat.color) continue
      const name = `${mat.name || ""} ${node.name || ""}`.toLowerCase()
      const isGlass = name.includes("glass") || name.includes("canopy") || name.includes("window")
        || (mat.transparent && mat.opacity < 0.92)
      const isRubber = name.includes("tire") || name.includes("tyre") || name.includes("wheel")
        || name.includes("rubber")
      const isMetal = name.includes("engine") || name.includes("fan") || name.includes("metal")
        || name.includes("chrome") || name.includes("gear") || name.includes("strut")

      mat.envMapIntensity = Math.max(mat.envMapIntensity || 1, isMetal ? 1.7 : 1.45)
      if (isGlass) {
        mat.transparent = true
        mat.opacity = Math.min(mat.opacity ?? 0.55, 0.62)
        mat.roughness = 0.08
        if ("metalness" in mat) mat.metalness = 0.15
        if ("transmission" in mat) mat.transmission = Math.max(mat.transmission || 0, 0.35)
      } else if (isRubber) {
        if ("metalness" in mat) mat.metalness = 0.05
        if ("roughness" in mat) mat.roughness = 0.92
      } else if (isMetal) {
        if ("metalness" in mat) mat.metalness = Math.min(0.88, Math.max(mat.metalness || 0.45, 0.55))
        if ("roughness" in mat) mat.roughness = Math.min(mat.roughness ?? 0.35, 0.28)
      } else {
        // Painted fuselage / wings — airline gloss
        if ("metalness" in mat) mat.metalness = Math.min(0.55, Math.max(mat.metalness || 0.22, 0.32))
        if ("roughness" in mat) mat.roughness = Math.min(mat.roughness ?? 0.45, 0.32)
      }
      if ("clearcoat" in mat && !isRubber) {
        mat.clearcoat = Math.max(mat.clearcoat || 0, isGlass ? 1 : 0.72)
        mat.clearcoatRoughness = Math.min(mat.clearcoatRoughness ?? 0.25, isGlass ? 0.08 : 0.16)
      }
      mat.needsUpdate = true
    }
    node.castShadow = true
    node.receiveShadow = true
  })
}

export function prepareRealModel(def) {
  const modelId = resolveModelId(def.id)
  const source = cache.get(modelId)
  if (!source) return null
  const root = source.clone(true)
  // Orient using the source mesh rules; scale to this catalog plane's length.
  const orientDef = { ...def, id: modelId }
  alignAircraftAxes(root, orientDef)
  const yaw = FACE_YAW[modelId] || FACE_YAW[def.id] || 0
  if (yaw) {
    root.rotation.y += yaw
    root.updateMatrixWorld(true)
  }
  root.updateMatrixWorld(true)
  let size = measureSize(root)
  const scale = def.length / Math.max(0.01, size.z)
  root.scale.setScalar(scale)
  root.updateMatrixWorld(true)
  if (!SKIP_FIN_SEEK.has(modelId)) faceNosePositiveZ(root)
  recenterXZ(root)
  settleOnGround(root)
  root.updateMatrixWorld(true)
  size = measureSize(root)
  polishRealMaterials(root)
  const gearMeshes = collectGearMeshes(root)
  const spinNodes = collectSpinNodes(root)
  return {
    root,
    gearMeshes,
    spinNodes,
    size,
    restClearance: 0.04,
  }
}
