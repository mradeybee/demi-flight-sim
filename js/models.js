import * as THREE from "three"
import { GLTFLoader } from "../node_modules/three/examples/jsm/loaders/GLTFLoader.js"
import { gearKitIdFor, ensureGearKit, preloadGearKits } from "./gearKits.js"

/** Map catalog plane ids to real GLB files. */
export const MODEL_FILES = {
  b737: "models/b737.glb",
  a318: "models/a318.glb",
  a319: "models/a319.glb",
  a320: "models/a320.glb",
  a321: "models/a321.glb",
  a220: "models/a220.glb",
  a330: "models/a330.glb",
  a340: "models/a340.glb",
  a350: "models/a350.glb",
  a380: "models/a380.glb",
  beluga: "models/beluga.glb",
  b747: "models/b747.glb",
  b757: "models/b757.glb",
  b767: "models/b767.glb",
  b777: "models/b777.glb",
  b787: "models/b787.glb",
  // Octal450 / FlightGear MD-11F with current FedEx Express (purple/orange) paint.
  md11: "models/md11.glb",
  atr42: "models/atr42.glb",
  q400: "models/q400.glb",
  crj700: "models/crj700.glb",
  crj900: "models/crj900.glb",
  e170: "models/e170.glb",
  e190: "models/e190.glb",
  bae146: "models/bae146.glb",
  citation: "models/citation.glb",
  pa28: "models/pa28.glb",
  ask21: "models/ask21.glb",
  heli: "models/heli.glb",
  evtol: "models/evtol.glb",
  drone: "models/drone.glb",
}

/** Closest real mesh for hangar planes that lack a dedicated GLB. */
export const MODEL_ALIASES = {}

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
const SKIP_FIN_SEEK = new Set(["evtol", "drone", "heli"])

const cache = new Map()
const inflight = new Map()
const loader = new GLTFLoader()
const _corner = new THREE.Vector3()

export function hasRealModel(id) {
  return Boolean(MODEL_FILES[resolveModelId(id)])
}

export function isModelCached(id) {
  return cache.has(resolveModelId(id))
}

export function cachedModelCount() {
  return cache.size
}

/** Load one GLB into the cache (shared across callers). */
export function ensureModel(id) {
  const modelId = resolveModelId(id)
  const path = MODEL_FILES[modelId]
  if (!path) return Promise.resolve(false)
  if (cache.has(modelId)) return Promise.resolve(true)
  if (inflight.has(modelId)) return inflight.get(modelId)
  const pending = loader
    .loadAsync(path)
    .then(async (gltf) => {
      cache.set(modelId, gltf.scene)
      const kitId = gearKitIdFor(modelId)
      if (kitId) await ensureGearKit(kitId)
      inflight.delete(modelId)
      return true
    })
    .catch((error) => {
      console.warn(`Could not load ${path}`, error)
      inflight.delete(modelId)
      return false
    })
  inflight.set(modelId, pending)
  return pending
}

/**
 * Preload a short list of models so the hangar can open fast.
 * Pass ids to limit; omit to load everything (slow — avoid at boot).
 */
export async function preloadAircraftModels(onProgress, ids = null) {
  const wanted = ids && ids.length
    ? [...new Set(ids.map(resolveModelId).filter((id) => MODEL_FILES[id]))]
    : Object.keys(MODEL_FILES)
  let done = 0
  // Small concurrency keeps first paint snappy without saturating the network.
  const workers = Math.min(3, wanted.length)
  let cursor = 0
  async function worker() {
    while (cursor < wanted.length) {
      const id = wanted[cursor]
      cursor += 1
      await ensureModel(id)
      const kitId = gearKitIdFor(id)
      if (kitId) await ensureGearKit(kitId)
      done += 1
      if (onProgress) onProgress(done, wanted.length)
    }
  }
  await Promise.all(Array.from({ length: workers }, () => worker()))
  // Warm kits for any plane ids that share families not covered above.
  if (ids?.length) await preloadGearKits(ids)
}

/** Quietly fill the rest of the hangar after the menu is up. */
export function warmAircraftModels(exceptIds = [], onProgress) {
  const skip = new Set(exceptIds.map(resolveModelId))
  const rest = Object.keys(MODEL_FILES).filter((id) => !skip.has(id) && !cache.has(id))
  if (!rest.length) return Promise.resolve()
  let done = 0
  let chain = Promise.resolve()
  for (const id of rest) {
    chain = chain.then(() => ensureModel(id)).then(() => {
      done += 1
      if (onProgress) onProgress(done, rest.length)
      // Yield so the main thread stays responsive while flying the menu.
      return new Promise((r) => setTimeout(r, 40))
    })
  }
  return chain
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

const GEAR_NAME =
  /(gear|wheel|tire|tyre|strut|oleo|bogie|wheelwell|undercarriage|\bmlg\b|\bnlg\b|ng_bay|gearrod|geardoor)/i
const GEAR_NAME_BLOCK = /(landing[\s_-]?light|land[\s_-]?light|navlight|strobe)/i
/** Real retractable legs / tires — not doors, bays, or empty wheel wells. */
const BAKED_GEAR_PART =
  /(wheel|tire|tyre|strut|oleo|bogie|\bmlg\b|\bnlg\b|undercarriage)/i
const BAKED_GEAR_EXCLUDE = /(door|bay|well|light|rod.?door|gearrod)/i

function collectGearMeshes(root) {
  const gear = []
  root.traverse((node) => {
    if (!node.isMesh || !node.visible) return
    const name = `${node.name} ${node.parent?.name || ""} ${node.parent?.parent?.name || ""}`
    if (GEAR_NAME_BLOCK.test(name)) return
    if (GEAR_NAME.test(name)) gear.push(node)
  })
  return gear
}

function detectBakedGear(gearMeshes) {
  // Need a real set of legs/tires — a lone named scrap (FR24 leftovers) is not enough.
  let hits = 0
  for (const mesh of gearMeshes) {
    const name = `${mesh.name} ${mesh.parent?.name || ""}`
    if (BAKED_GEAR_PART.test(name) && !BAKED_GEAR_EXCLUDE.test(name)) hits += 1
  }
  return hits >= 2
}

/**
 * After settleOnGround, tire bottoms sit near y≈0. Fuselage belly is higher —
 * skip the lowest centerline samples (wheels) and take the next band.
 */
function estimateFuselageBellyY(root) {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  const halfBody = Math.max(0.35, size.x * 0.1)
  const samples = []
  const point = new THREE.Vector3()
  root.traverse((node) => {
    if (!node.isMesh || !node.geometry?.attributes?.position) return
    const pos = node.geometry.attributes.position
    const step = Math.max(1, Math.floor(pos.count / 2500))
    for (let i = 0; i < pos.count; i += step) {
      point.fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld)
      root.worldToLocal(point)
      if (Math.abs(point.x) > halfBody) continue
      // Mid-fuselage band — ignore nose radome / tail cone extremes.
      if (point.z > size.z * 0.42 || point.z < -size.z * 0.35) continue
      samples.push(point.y)
    }
  })
  if (samples.length < 8) return Math.max(0.45, size.y * 0.18)
  samples.sort((a, b) => a - b)
  // Skip lowest ~22% (tires / bogies), read belly just above them.
  const idx = Math.min(samples.length - 1, Math.floor(samples.length * 0.22))
  return Math.max(0.35, samples[idx])
}

/**
 * Only true props / rotors. Matching "fan" also hits FANCOWL / turbofan cowls,
 * and after Collada→GLB bake those meshes often pivot at the scene origin —
 * so spinning them makes parts orbit the whole airplane.
 */
function wantsPropSpin(def) {
  if (["heli", "evtol", "drone", "ask21"].includes(def.id)) return def.id !== "ask21"
  return (def.engines || []).some((engine) => engine.kind === "prop")
}

function isPropSpinName(name) {
  if (/(fancowl|turbofan|reverser|nacelle|cowl|hold|cone|spinner|door|gear|wing|fan)/.test(name)) {
    // Allow clear prop discs even if the name also contains noise.
    if (!/propdisc|propeller|prop[_\s]?[lr0-9]|rotor/.test(name)) return false
  }
  return /prop|rotor|blade/.test(name)
}

/** Re-parent mesh under a pivot at its geometric center so rotation doesn't orbit the airframe. */
function pivotAtMeshCenter(mesh) {
  mesh.updateMatrixWorld(true)
  const center = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3())
  const parent = mesh.parent
  if (!parent) return mesh
  const pivot = new THREE.Group()
  pivot.name = `${mesh.name || "prop"}_spin`
  parent.add(pivot)
  parent.worldToLocal(center)
  pivot.position.copy(center)
  pivot.attach(mesh)
  return pivot
}

function collectSpinNodes(root, def) {
  if (!wantsPropSpin(def)) return []
  const meshes = []
  root.traverse((node) => {
    if (!node.visible || !node.isMesh) return
    const name = node.name.toLowerCase()
    if (isPropSpinName(name)) meshes.push(node)
  })
  return meshes.map(pivotAtMeshCenter)
}

/**
 * FlightGear / FR24 conversions often ship cabin seats, pilots, zero-volume
 * helpers, and open animation leftovers that look like scattered parts.
 */
const JUNK_NAME = /(pilot|piloto|passenger|seat|cabin|cockpit_?inside|interior|collision|shadow|helper|lod[0-9]|hitbox|bound)/i

function meshVolume(mesh) {
  mesh.updateMatrixWorld(true)
  const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3())
  return Math.abs(size.x * size.y * size.z)
}

function cleanupRealModel(root) {
  const remove = []
  root.updateMatrixWorld(true)
  const whole = new THREE.Box3().setFromObject(root)
  const wholeSize = whole.getSize(new THREE.Vector3())
  const wholeVol = Math.max(1e-6, Math.abs(wholeSize.x * wholeSize.y * wholeSize.z))
  root.traverse((node) => {
    if (!node.isMesh) return
    const name = `${node.name || ""} ${node.parent?.name || ""}`
    if (JUNK_NAME.test(name)) {
      remove.push(node)
      return
    }
    const vol = meshVolume(node)
    // Degenerate helpers and dust-sized debris.
    if (vol < 1e-5) {
      remove.push(node)
      return
    }
    // Tiny scraps relative to the whole airframe (window pins, empty doors, etc.).
    if (vol < wholeVol * 1e-7) remove.push(node)
  })
  for (const node of remove) {
    node.visible = false
    node.parent?.remove(node)
  }
}

function mapImageSize(mat) {
  const img = mat?.map?.image
  if (!img) return null
  const w = img.naturalWidth || img.width || 0
  const h = img.naturalHeight || img.height || 0
  return w && h ? { w, h } : null
}

/**
 * FlightGear MD-11 AC→GLB loses object names, so baked gear can't be detected.
 * Strip the 1024×1024 landing-gear atlas plus orphan untextured low meshes
 * (stilts/scissors that used plain materials), then fit a real gear kit.
 */
function stripMd11BakedGear(root) {
  const kill = new Set()
  root.traverse((node) => {
    if (!node.isMesh || !node.material) return
    for (const mat of [].concat(node.material)) {
      const size = mapImageSize(mat)
      if (size && size.w === 1024 && size.h === 1024) {
        kill.add(node)
        break
      }
    }
  })
  for (const node of kill) {
    node.visible = false
    node.parent?.remove(node)
  }

  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  // Anything hanging in the bottom band without a paint/wing/fan map is leftover gear.
  const lowCut = box.min.y + Math.max(1.2, (box.max.y - box.min.y) * 0.14)
  const orphans = []
  root.traverse((node) => {
    if (!node.isMesh || !node.visible) return
    const mats = [].concat(node.material)
    const hasPaintMap = mats.some((mat) => {
      const size = mapImageSize(mat)
      if (!size) return false
      // Fuselage 8192×2048, wings 2048×2048, fans 4096×1024
      return (size.w >= 2048) || (size.w === 4096 && size.h === 1024)
    })
    if (hasPaintMap) return
    const meshBox = new THREE.Box3().setFromObject(node)
    if (meshBox.max.y < lowCut) orphans.push(node)
  })
  for (const node of orphans) {
    node.visible = false
    node.parent?.remove(node)
  }
  return kill.size + orphans.length
}

/** Make baked GLB paints read like real polished airframes. */
function polishRealMaterials(root) {
  root.traverse((node) => {
    if (!node.isMesh || !node.material) return
    const list = [].concat(node.material)
    for (const mat of list) {
      if (!mat || !mat.color) continue
      const name = `${mat.name || ""} ${node.name || ""}`.toLowerCase()
      const alpha = mat.opacity ?? 1
      const isGlass = name.includes("glass") || name.includes("canopy") || name.includes("window")
        || name.includes("material.025")
        || (mat.transparent && alpha < 0.92 && !mat.map)
        || (mat.alphaMode === "BLEND" && !mat.map)
      const isRubber = name.includes("tire") || name.includes("tyre") || name.includes("wheel")
        || name.includes("rubber")
      const isMetal = name.includes("engine") || name.includes("fan") || name.includes("metal")
        || name.includes("chrome") || name.includes("gear") || name.includes("strut")

      mat.envMapIntensity = Math.max(mat.envMapIntensity || 1, isMetal ? 1.7 : 1.45)
      if (isGlass) {
        // Simple tinted glass — MeshPhysical transmission draws as white slabs here.
        mat.transparent = true
        mat.opacity = 0.28
        mat.depthWrite = false
        mat.color.set(0x152433)
        mat.roughness = 0.06
        if ("metalness" in mat) mat.metalness = 0.05
        if ("transmission" in mat) mat.transmission = 0
        if ("clearcoat" in mat) {
          mat.clearcoat = 0.35
          mat.clearcoatRoughness = 0.12
        }
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
      if ("clearcoat" in mat && !isRubber && !isGlass) {
        mat.clearcoat = Math.max(mat.clearcoat || 0, 0.72)
        mat.clearcoatRoughness = Math.min(mat.clearcoatRoughness ?? 0.25, 0.16)
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
  cleanupRealModel(root)
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
  recenterXZ(root)
  settleOnGround(root)
  root.updateMatrixWorld(true)
  size = measureSize(root)
  polishRealMaterials(root)
  // MD-11F: strip unnamed FG gear atlas so the b777 kit sits cleanly.
  if (def.id === "md11" || modelId === "md11") {
    stripMd11BakedGear(root)
    settleOnGround(root)
    root.updateMatrixWorld(true)
    size = measureSize(root)
  }
  const gearMeshes = collectGearMeshes(root)
  const spinNodes = collectSpinNodes(root, def)
  const box = new THREE.Box3().setFromObject(root)
  // settleOnGround puts the lowest mesh point (usually tires) at y≈0.
  const restClearance = Math.max(0.02, -box.min.y + 0.02)
  const bellyClearance = estimateFuselageBellyY(root)
  // Only treat separated wheel/strut meshes as baked gear. Most hangar GLBs
  // (FR24/AMV) omit legs entirely — those need a FlightGear gear kit.
  let hasBakedGear = detectBakedGear(gearMeshes)
  if (def.id === "md11" || modelId === "md11") hasBakedGear = false
  return {
    root,
    gearMeshes,
    spinNodes,
    size,
    restClearance,
    bellyClearance,
    hasBakedGear,
    needsGearKit: !hasBakedGear,
  }
}
