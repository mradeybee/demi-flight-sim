import * as THREE from "three"
import { GLTFLoader } from "../node_modules/three/examples/jsm/loaders/GLTFLoader.js"

/**
 * FlightGear landing-gear kits (models/gear/<id>/).
 * Family reuse keeps downloads small while still using real FG meshes.
 */
export const GEAR_KIT_FOR_PLANE = {
  b737: "b737",
  a318: "a320",
  a319: "a320",
  a320: "a320",
  a321: "a320",
  a220: "a320",
  a330: "a330",
  a340: "a340",
  a350: "a330",
  a380: "b747",
  // Beluga extract is doors + nose oleo only — reuse A330 undercarriage.
  beluga: "a330",
  // MD-11F gear layout is closer to a widebody twin than the 777 kit scale.
  md11: "a330",
  b747: "b747",
  b757: "b757",
  b767: "b777",
  b777: "b777",
  b787: "b787",
  atr42: "atr42",
  q400: "q400",
  crj700: "crj",
  crj900: "crj",
  e170: "ejet",
  e190: "ejet",
  bae146: "crj",
  citation: "citation",
  pa28: "light",
  ask21: "ask21",
  heli: "heli",
  evtol: "light",
  drone: "light",
}

/**
 * Per-kit fit.
 * tireOffset: FG tire placement relative to strut, already converted to
 * three.js Y-up (X lateral-ish / aft from AC, Y up, Z lateral twin).
 * lengthRef = FG source aircraft length (not always catalog length).
 */
export const GEAR_KIT_FIT = {
  a320: {
    lengthRef: 37.6,
    style: "parts",
    noseZ: 0.28,
    mainZ: -0.05,
    track: 0.2,
    nlgTire: { x: -0.31, y: -1.93, z: 0 },
    mlgTire: { x: 0, y: -0.57, z: 0 },
  },
  b737: {
    lengthRef: 39.5,
    style: "parts",
    noseZ: 0.28,
    mainZ: -0.05,
    track: 0.2,
    // Nosegear AC already includes tires; mains reuse A320 MLG + tires.
    mlgTire: { x: 0, y: -0.57, z: 0 },
  },
  b747: { lengthRef: 70.7, style: "airframe", noseZ: 0.32, mainZ: -0.08, track: 0.16 },
  b777: { lengthRef: 63.7, style: "airframe", noseZ: 0.3, mainZ: -0.06, track: 0.17 },
  b787: { lengthRef: 56.7, style: "airframe", noseZ: 0.3, mainZ: -0.06, track: 0.17 },
  b757: { lengthRef: 47.3, style: "airframe", noseZ: 0.3, mainZ: -0.05, track: 0.18 },
  a330: { lengthRef: 58.8, style: "airframe", noseZ: 0.3, mainZ: -0.06, track: 0.17 },
  a340: { lengthRef: 63.6, style: "airframe", noseZ: 0.32, mainZ: -0.08, track: 0.16 },
  beluga: { lengthRef: 56.2, style: "airframe", noseZ: 0.3, mainZ: -0.06, track: 0.17 },
  // Reuses b777 kit via GEAR_KIT_FOR_PLANE; fit kept for length/track hints.
  md11: { lengthRef: 61.6, style: "airframe", noseZ: 0.3, mainZ: -0.06, track: 0.16 },
  crj: { lengthRef: 32.3, style: "parts", noseZ: 0.3, mainZ: -0.06, track: 0.2 },
  atr42: { lengthRef: 22.7, style: "airframe", noseZ: 0.32, mainZ: -0.04, track: 0.22 },
  q400: { lengthRef: 32.8, style: "airframe", noseZ: 0.3, mainZ: -0.05, track: 0.2 },
  ejet: { lengthRef: 38.7, style: "airframe", noseZ: 0.3, mainZ: -0.05, track: 0.19 },
  citation: { lengthRef: 14.4, style: "airframe", noseZ: 0.28, mainZ: -0.04, track: 0.22 },
  heli: { lengthRef: 12.2, style: "airframe", skids: true },
  light: { lengthRef: 8.3, style: "airframe", noseZ: 0.28, mainZ: -0.05, track: 0.24 },
  ask21: { lengthRef: 8.4, style: "airframe", noseZ: 0.2, mainZ: 0, track: 0.3 },
}

const loader = new GLTFLoader()
const cache = new Map()
const inflight = new Map()

// Only real bay doors — do NOT match D_STRUCTU/L strut forgings (those are the
// chunky visible legs; hiding them left spindly oleos that looked detached).
const DOOR_RE = /(geardoor|baydoor|innerdoor|outerdoor|nosegear_door|ngdoor|lhngdoor|rhngdoor|mlgdoor|door_)/i
const ATTACH_RE = /(fitting|oleo|strut|ngoleo|mlgoleo|actuator|torque)/i
const TIRE_RE = /(tire|tyre|wheel|rim|bearing|rubber|ngtyre|lgtires|rgtires|^blg[lr]|^wlg[lr]|nosewheel)/i
const BLACK_MAT_RE = /(tire|tyre|wheel|rubber|_black_)/i

export function gearKitIdFor(planeId) {
  return GEAR_KIT_FOR_PLANE[planeId] || null
}

export function isGearKitCached(kitId) {
  return cache.has(kitId)
}

/** Test/helper: inject already-parsed kit scenes into the cache. */
export function seedGearKitCache(kitId, scenes) {
  cache.set(kitId, scenes)
}

async function loadKitJson(kitId) {
  const res = await fetch(`models/gear/${kitId}/kit.json`)
  if (!res.ok) throw new Error(`gear kit ${kitId}: ${res.status}`)
  return res.json()
}

/** Ensure a kit's GLB parts are in memory. */
export function ensureGearKit(kitId) {
  if (!kitId) return Promise.resolve(false)
  if (cache.has(kitId)) return Promise.resolve(true)
  if (inflight.has(kitId)) return inflight.get(kitId)
  const pending = loadKitJson(kitId)
    .then(async (kit) => {
      const scenes = []
      for (const part of kit.parts) {
        const gltf = await loader.loadAsync(`models/gear/${kitId}/${part}`)
        scenes.push({ name: part.replace(/\.glb$/i, ""), scene: gltf.scene })
      }
      cache.set(kitId, scenes)
      inflight.delete(kitId)
      return true
    })
    .catch((err) => {
      console.warn(`Could not load gear kit ${kitId}`, err)
      inflight.delete(kitId)
      return false
    })
  inflight.set(kitId, pending)
  return pending
}

export async function preloadGearKits(planeIds, onProgress) {
  const kitIds = [...new Set(planeIds.map(gearKitIdFor).filter(Boolean))]
  let done = 0
  for (const id of kitIds) {
    await ensureGearKit(id)
    done += 1
    if (onProgress) onProgress(done, kitIds.length)
  }
}

function measureBox(obj) {
  obj.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(obj)
}

function nodeLabel(node) {
  return `${node.name || ""} ${node.parent?.name || ""}`
}

function isTireMesh(node) {
  if (!node?.isMesh) return false
  const name = nodeLabel(node)
  if (DOOR_RE.test(name)) return false
  return (
    TIRE_RE.test(name) ||
    /_black_/i.test(node.name || "") ||
    /^ngtyre|^lgtires|^rgtires/i.test(node.name || "")
  )
}

/** Hide gear doors / bay panels that float when kits are hung under hangar shells. */
function hideDoorMeshes(root) {
  root.updateMatrixWorld(true)
  const full = measureBox(root)
  const legH = Math.max(0.2, full.max.y - full.min.y)
  const box = new THREE.Box3()
  root.traverse((node) => {
    if (!node.isMesh) return
    const label = nodeLabel(node)
    if (DOOR_RE.test(label)) {
      node.visible = false
      return
    }
    // Tall FG "FITTING" volumes read as empty gaps — hide them so the oleo
    // can sit flush on the belly without a hollow meter of invisible mesh.
    if (/fitting/i.test(label)) {
      box.setFromObject(node)
      if (box.max.y - box.min.y > legH * 0.35) node.visible = false
    }
  })
}

/**
 * World-space Y of the attach point.
 * Prefer OLEO / strut tops. FG "FITTING" meshes are often huge empty volumes
 * whose bbox top sits on the belly while the visible oleo hangs a meter below
 * — that reads as a floating gap. Only use FITTING when it's a compact plate.
 */
function measureAttachTopY(root) {
  root.updateMatrixWorld(true)
  let fittingMax = -Infinity
  let compactFittingMax = -Infinity
  let oleoMax = -Infinity
  let otherMax = -Infinity
  const full = measureBox(root)
  const legH = Math.max(0.2, full.max.y - full.min.y)
  const box = new THREE.Box3()
  root.traverse((node) => {
    if (!node.isMesh || !node.visible) return
    const label = nodeLabel(node)
    if (DOOR_RE.test(label) || isTireMesh(node)) return
    box.setFromObject(node)
    if (!Number.isFinite(box.max.y)) return
    const h = box.max.y - box.min.y
    if (/fitting/i.test(label)) {
      fittingMax = Math.max(fittingMax, box.max.y)
      // Compact attach plates only — skip tall empty fitting volumes.
      if (h <= legH * 0.35) compactFittingMax = Math.max(compactFittingMax, box.max.y)
    } else if (ATTACH_RE.test(label)) {
      oleoMax = Math.max(oleoMax, box.max.y)
    } else {
      otherMax = Math.max(otherMax, box.max.y)
    }
  })
  if (Number.isFinite(oleoMax)) return oleoMax
  if (Number.isFinite(compactFittingMax)) return compactFittingMax
  if (Number.isFinite(otherMax)) return otherMax
  if (Number.isFinite(fittingMax)) return fittingMax
  return full.max.y
}

/** Approximate tire radius from tire meshes, else from lowest non-door extent. */
function measureTireRadius(root) {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3()
  let best = 0
  root.traverse((node) => {
    if (!node.isMesh || !node.visible || !isTireMesh(node)) return
    box.setFromObject(node)
    const h = box.max.y - box.min.y
    const w = Math.max(box.max.x - box.min.x, box.max.z - box.min.z)
    best = Math.max(best, Math.min(h, w) * 0.5)
  })
  if (best > 0.05) return best
  const full = measureBox(root)
  return Math.max(0.15, (full.max.y - full.min.y) * 0.12)
}

function targetTireRadius(def, fit) {
  const r = def.radius || 1.5
  if (fit.skids) return THREE.MathUtils.clamp(r * 0.12, 0.12, 0.28)
  return THREE.MathUtils.clamp(r * 0.3, 0.48, 0.62)
}

/**
 * Strut length from belly attach to tire bottom.
 * Match the settled hangar GLB belly→floor gap so the jet doesn't sit on stilts.
 * Tire readability comes from reinforceTireDiscs(), not from stretching struts.
 */
function targetDrop(def, fit, bellyY = null, floorY = 0, tireR = 0.45) {
  if (fit.skids) {
    return THREE.MathUtils.clamp(def.radius * 0.35, 0.35, 1.4)
  }
  if (bellyY != null && Number.isFinite(bellyY)) {
    const fromMesh = bellyY - floorY + tireR * 1.05
    return THREE.MathUtils.clamp(fromMesh, 1.05, 1.75)
  }
  return THREE.MathUtils.clamp(tireR * 2.5, 1.05, 1.75)
}

/**
 * FG legs often leave a hollow gap under the belly (tall empty FITTING volumes).
 * Add a simple metal oleo from the attach point down to the tires so the hangar
 * silhouette reads as connected gear, not floating scraps.
 */
function reinforceStrutFillers(group, tireR) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8b929a,
    metalness: 0.72,
    roughness: 0.34,
  })
  for (const holder of group.children) {
    if (!holder?.isObject3D) continue
    holder.updateMatrixWorld(true)
    let tireTop = -Infinity
    const box = new THREE.Box3()
    const v = new THREE.Vector3()
    holder.traverse((node) => {
      if (!node.isMesh || !node.visible || !isTireMesh(node)) return
      if (/_disc$/.test(node.name || "")) return
      box.setFromObject(node)
      for (const c of [
        [box.min.x, box.max.y, box.min.z],
        [box.max.x, box.max.y, box.max.z],
      ]) {
        v.set(c[0], c[1], c[2])
        holder.worldToLocal(v)
        tireTop = Math.max(tireTop, v.y)
      }
    })
    if (!Number.isFinite(tireTop)) continue
    const top = 0.04
    const bot = Math.min(-0.2, tireTop + Math.max(0.08, tireR * 0.12))
    const len = Math.max(0.35, top - bot)
    const radius = THREE.MathUtils.clamp(tireR * 0.28, 0.1, 0.2)
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.75, radius, len, 10), mat)
    strut.name = `${holder.name || "leg"}_filler`
    strut.position.set(0, (top + bot) * 0.5, 0)
    strut.castShadow = true
    holder.add(strut)
  }
}

/**
 * FG tire meshes are thin and vanish at hangar camera distance. Drop a solid
 * torus on each tire (axle-aligned) so wheels read as attached rubber.
 */
function reinforceTireDiscs(group, tireR) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x151515,
    roughness: 0.94,
    metalness: 0.04,
  })
  const tires = []
  group.traverse((node) => {
    // Only real tire/tyre meshes — rims/bearings get wrong thin-axis reads.
    if (!node.isMesh || !node.visible) return
    if (!/tyre|tire/i.test(node.name || "")) return
    if (DOOR_RE.test(nodeLabel(node))) return
    tires.push(node)
  })
  if (!tires.length) {
    group.traverse((node) => {
      if (isTireMesh(node) && node.visible) tires.push(node)
    })
  }
  group.updateMatrixWorld(true)
  const worldQuat = new THREE.Quaternion()
  const parentQuat = new THREE.Quaternion()
  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  for (const mesh of tires) {
    const box = new THREE.Box3().setFromObject(mesh)
    if (!Number.isFinite(box.min.x)) continue
    box.getSize(size)
    box.getCenter(center)
    // World-space thin axis = axle (before parenting into rotated FG nodes).
    let axle = "x"
    if (size.y <= size.x && size.y <= size.z) axle = "y"
    else if (size.z <= size.x && size.z <= size.y) axle = "z"

    const radius = Math.max(tireR * 0.95, Math.min(size.x, size.y, size.z) * 0.4)
    const tube = THREE.MathUtils.clamp(radius * 0.3, 0.08, 0.18)
    const disc = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.8, tube, 8, 20), mat)
    disc.name = `${mesh.name || "tire"}_disc`
    disc.castShadow = true

    // Build world orientation (torus default axle = Z), then convert into mesh local.
    if (axle === "x") worldQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
    else if (axle === "y") worldQuat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
    else worldQuat.identity()

    mesh.updateMatrixWorld(true)
    mesh.getWorldQuaternion(parentQuat)
    disc.quaternion.copy(parentQuat).invert().multiply(worldQuat)
    mesh.worldToLocal(center)
    disc.position.copy(center)
    mesh.add(disc)
  }
}

/** Make FG gear read as metal struts + rubber tires under airline lighting. */
function polishGearMaterials(root) {
  root.traverse((node) => {
    if (!node.isMesh || !node.material) return
    const list = [].concat(node.material)
    const name = nodeLabel(node).toLowerCase()
    const matNames = list.map((m) => (m?.name || "").toLowerCase()).join(" ")
    const isRubber =
      isTireMesh(node) ||
      BLACK_MAT_RE.test(name) ||
      BLACK_MAT_RE.test(matNames)
    for (const mat of list) {
      if (!mat) continue
      if (isRubber) {
        if (mat.color) mat.color.set(0x1a1a1a)
        if ("metalness" in mat) mat.metalness = 0.05
        if ("roughness" in mat) mat.roughness = 0.92
      } else {
        if (mat.color) {
          const c = mat.color
          if (c.r > 0.92 && c.g > 0.92 && c.b > 0.92) c.set(0xb8bcc2)
        }
        if ("metalness" in mat) mat.metalness = Math.max(mat.metalness || 0.4, 0.55)
        if ("roughness" in mat) mat.roughness = Math.min(mat.roughness ?? 0.4, 0.35)
      }
      mat.needsUpdate = true
    }
    node.castShadow = true
    node.receiveShadow = true
  })
}

/**
 * Estimate axle axis from vertex variance (min variance ≈ axle).
 * Want axle along +X so wheels roll along Z.
 */
function tireAxleAxis(tireRoot) {
  tireRoot.updateMatrixWorld(true)
  const pts = []
  const v = new THREE.Vector3()
  tireRoot.traverse((node) => {
    if (!node.isMesh || !node.geometry?.attributes?.position) return
    const pos = node.geometry.attributes.position
    const step = Math.max(1, Math.floor(pos.count / 1500))
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld)
      pts.push(v.x, v.y, v.z)
    }
  })
  if (pts.length < 9) {
    const size = measureBox(tireRoot).getSize(new THREE.Vector3())
    if (size.y <= size.x && size.y <= size.z) return "y"
    if (size.x <= size.y && size.x <= size.z) return "x"
    return "z"
  }
  let cx = 0
  let cy = 0
  let cz = 0
  const n = pts.length / 3
  for (let i = 0; i < pts.length; i += 3) {
    cx += pts[i]
    cy += pts[i + 1]
    cz += pts[i + 2]
  }
  cx /= n
  cy /= n
  cz /= n
  let vx = 0
  let vy = 0
  let vz = 0
  for (let i = 0; i < pts.length; i += 3) {
    const dx = pts[i] - cx
    const dy = pts[i + 1] - cy
    const dz = pts[i + 2] - cz
    vx += dx * dx
    vy += dy * dy
    vz += dz * dz
  }
  if (vx <= vy && vx <= vz) return "x"
  if (vy <= vx && vy <= vz) return "y"
  return "z"
}

/**
 * Roll a tire root so the axle lies along X. Skip if already correct.
 * Rotates about the bbox center so offset mesh pivots don't fling geometry.
 */
function uprightTires(tireRoot) {
  const axis = tireAxleAxis(tireRoot)
  if (axis === "x") return

  tireRoot.updateMatrixWorld(true)
  const parent = tireRoot.parent
  if (parent) {
    const center = measureBox(tireRoot).getCenter(new THREE.Vector3())
    parent.worldToLocal(center)
    const pivot = new THREE.Group()
    pivot.name = `${tireRoot.name || "tire"}_upright`
    parent.add(pivot)
    pivot.position.copy(center)
    pivot.attach(tireRoot)
    if (axis === "y") pivot.rotation.z += Math.PI / 2
    else pivot.rotation.y += Math.PI / 2
    pivot.updateMatrixWorld(true)
  } else {
    if (axis === "y") tireRoot.rotation.z += Math.PI / 2
    else tireRoot.rotation.y += Math.PI / 2
    tireRoot.updateMatrixWorld(true)
  }
}

/**
 * Upright baked-in tires as ONE assembly (B737 NLG).
 * Axle is taken from a SINGLE tire mesh — dual-wheel spacing along the axle
 * inflates cluster AABB/variance and falsely reports axle-X.
 */
function uprightBakedTireAssembly(strut) {
  const tires = []
  strut.traverse((node) => {
    // Prefer rubber tires over rims for a cleaner thin-axis read.
    if (node.isMesh && /tyre|tire/i.test(node.name || "") && !DOOR_RE.test(nodeLabel(node))) {
      tires.push(node)
    }
  })
  if (!tires.length) {
    strut.traverse((node) => {
      if (isTireMesh(node)) tires.push(node)
    })
  }
  if (!tires.length) return

  strut.updateMatrixWorld(true)
  const probe = tires[0]
  const axis = tireAxleAxis(probe)
  if (axis === "x") return

  const cluster = new THREE.Box3()
  for (const mesh of tires) cluster.expandByObject(mesh)
  if (!Number.isFinite(cluster.min.x)) return

  const parent = strut.parent
  if (!parent) {
    if (axis === "y") strut.rotation.z += Math.PI / 2
    else strut.rotation.y += Math.PI / 2
    strut.updateMatrixWorld(true)
    return
  }
  const center = cluster.getCenter(new THREE.Vector3())
  parent.worldToLocal(center)
  const pivot = new THREE.Group()
  pivot.name = `${strut.name || "strut"}_tireUpright`
  parent.add(pivot)
  pivot.position.copy(center)
  pivot.attach(strut)
  if (axis === "y") pivot.rotation.z += Math.PI / 2
  else pivot.rotation.y += Math.PI / 2
  pivot.updateMatrixWorld(true)
}

/**
 * Scale + shift a leg so the attach fitting sits at local y=0 and the tire
 * bottoms land ~`drop` below. Always scale by attach→bottom distance (not raw
 * bbox height) so oleo tops hang flush under the belly.
 */
function hangLegToBelly(obj, tireR, drop, { preferTireScale = false } = {}) {
  hideDoorMeshes(obj)
  obj.position.set(0, 0, 0)
  obj.rotation.set(0, 0, 0)
  // Keep any non-uniform child scales; reset the leg wrapper only.
  if (obj.scale.x === 0) obj.scale.set(1, 1, 1)
  obj.updateMatrixWorld(true)

  let attachY = measureAttachTopY(obj)
  let box = measureBox(obj)
  let span = Math.max(0.2, attachY - box.min.y)

  // Scale primarily to the belly→floor drop; tire discs handle readability.
  let scale = drop / span
  if (preferTireScale) {
    const tireR0 = measureTireRadius(obj)
    const tireScale = tireR / Math.max(0.08, tireR0)
    scale = THREE.MathUtils.clamp(tireScale, scale * 0.9, scale * 1.15)
    const newSpan = span * scale
    if (newSpan > drop * 1.12) scale *= (drop * 1.12) / newSpan
    if (newSpan < drop * 0.88) scale *= (drop * 0.88) / Math.max(0.2, newSpan)
  }
  obj.scale.multiplyScalar(scale)
  obj.updateMatrixWorld(true)

  attachY = measureAttachTopY(obj)
  box = measureBox(obj)
  obj.position.y -= attachY
  obj.position.x -= (box.min.x + box.max.x) * 0.5
  obj.position.z -= (box.min.z + box.max.z) * 0.5
  obj.updateMatrixWorld(true)
  hideMeshesAboveAttach(obj)
  return measureBox(obj)
}

/** After hanging, hide strut scraps that sit entirely above the belly line. */
function hideMeshesAboveAttach(leg) {
  leg.updateMatrixWorld(true)
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  leg.traverse((node) => {
    if (!node.isMesh || !node.visible) return
    if (isTireMesh(node)) return
    box.setFromObject(node)
    let minLocalY = Infinity
    const corners = [
      [box.min.x, box.min.y, box.min.z],
      [box.max.x, box.min.y, box.min.z],
      [box.min.x, box.min.y, box.max.z],
      [box.max.x, box.min.y, box.max.z],
    ]
    for (const c of corners) {
      v.set(c[0], c[1], c[2])
      leg.worldToLocal(v)
      minLocalY = Math.min(minLocalY, v.y)
    }
    if (minLocalY > 0.14) node.visible = false
  })
}

/**
 * Clone a cached kit into a Group ready to parent under an aircraft root.
 * @param {number} bellyY craft-local Y of fuselage underside
 * @param {{ floorY?: number }} [opts] craft-local Y of airframe lowest skin
 */
export function buildGearKitGroup(planeDef, bellyY = -0.5, opts = {}) {
  const kitId = gearKitIdFor(planeDef.id)
  if (!kitId || !cache.has(kitId)) return null
  const fit = GEAR_KIT_FIT[kitId] || { lengthRef: planeDef.length, style: "airframe" }
  const parts = cache.get(kitId)
  const group = new THREE.Group()
  group.name = `gearKit_${kitId}`

  const floorY = Number.isFinite(opts.floorY) ? opts.floorY : 0
  const tireR = targetTireRadius(planeDef, fit)
  const drop = targetDrop(planeDef, fit, bellyY, floorY, tireR)

  if (fit.style === "parts") {
    assemblePartsKit(group, parts, planeDef, fit, bellyY, tireR, drop)
  } else {
    assembleAirframeKit(group, parts, planeDef, fit, bellyY, tireR, drop)
  }

  polishGearMaterials(group)
  reinforceTireDiscs(group, tireR)
  reinforceStrutFillers(group, tireR)
  wireWheelSpins(group)

  const retractRoots = []
  for (const child of group.children) {
    retractRoots.push(child)
    child.userData.gearHome = {
      pos: child.position.clone(),
      rot: child.rotation.clone(),
      visible: true,
    }
  }

  return { group, wheels: group.userData.wheels || [], retractRoots, kitId, skids: Boolean(fit.skids) }
}

function wireWheelSpins(group) {
  const wheels = []
  const tireMeshes = []
  group.traverse((node) => {
    if (!node.isMesh || !node.visible) return
    if (!isTireMesh(node)) return
    tireMeshes.push(node)
  })
  group.updateMatrixWorld(true)
  for (const node of tireMeshes) {
    const parent = node.parent
    if (!parent) continue
    const center = new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3())
    const spin = new THREE.Group()
    spin.name = `${node.name || "tire"}_spin`
    parent.worldToLocal(center)
    parent.add(spin)
    spin.position.copy(center)
    spin.attach(node)
    const box = new THREE.Box3().setFromObject(spin)
    const radius = Math.max(0.1, (box.max.y - box.min.y) * 0.5)
    wheels.push({ spin, radius })
  }
  group.userData.wheels = wheels
}

/**
 * Build one leg: strut + tires as a SINGLE unit (FG relative offsets), then
 * hang/scale the whole thing under the belly.
 */
function assemblePartsKit(group, parts, def, fit, bellyY, tireR, drop) {
  const byName = Object.fromEntries(parts.map((p) => [p.name, p.scene.clone(true)]))
  const track = def.wing.span * (fit.track || def.gear.track || 0.2)
  const noseZ = def.length * (fit.noseZ ?? 0.28)
  const mainZ = def.length * (fit.mainZ ?? -0.05)

  const mountLeg = (strut, tires, offset, x, z, name) => {
    if (!strut) return
    const leg = new THREE.Group()
    leg.name = name || "leg"
    leg.add(strut)
    if (tires) {
      uprightTires(tires)
      if (offset) tires.position.set(offset.x || 0, offset.y || 0, offset.z || 0)
      leg.add(tires)
    } else {
      // Baked tires on the strut (B737 NLG / CRJ) — upright as one cluster.
      uprightBakedTireAssembly(strut)
    }
    hangLegToBelly(leg, tireR, drop, { preferTireScale: true })
    const holder = new THREE.Group()
    holder.name = name || "leg"
    holder.add(leg)
    // Tuck into the belly so thin FG fittings don't read as a gap.
    holder.position.set(x, bellyY + Math.max(0.08, tireR * 0.12), z)
    group.add(holder)
  }

  if (byName.nlg) {
    mountLeg(byName.nlg, byName.nlg_tires || null, fit.nlgTire, 0, noseZ, "nlg")
  }

  if (byName.mlg_left && byName.mlg_right) {
    mountLeg(byName.mlg_left, byName.mlg_tires?.clone(true) || null, fit.mlgTire, -track / 2, mainZ, "mlgL")
    mountLeg(byName.mlg_right, byName.mlg_tires?.clone(true) || null, fit.mlgTire, track / 2, mainZ, "mlgR")
  } else if (byName.mlg) {
    mountLeg(byName.mlg, null, null, 0, mainZ, "mlg")
  }
}

/**
 * Airframe kits ship as one FG extract. Prefer named leg groups
 * (nose_gear / LeftGear / …); otherwise keep as one unit. Never rotate
 * individual tire meshes — that detaches wheels from their struts.
 */
function assembleAirframeKit(group, parts, def, fit, bellyY, tireR, drop) {
  const scene = parts[0]?.scene.clone(true)
  if (!scene) return

  hideDoorMeshes(scene)
  scene.updateMatrixWorld(true)
  const rawBox = measureBox(scene)
  const rawSize = rawBox.getSize(new THREE.Vector3())
  const ref = fit.lengthRef || Math.max(rawSize.z, rawSize.x, 1)
  scene.scale.setScalar(def.length / ref)
  scene.updateMatrixWorld(true)
  let box = measureBox(scene)
  let height = box.max.y - box.min.y
  if (!fit.skids && (height > drop * 1.55 || height < drop * 0.5)) {
    scene.scale.multiplyScalar(drop / Math.max(0.2, height))
    scene.updateMatrixWorld(true)
  }
  if (fit.yaw) scene.rotation.y += fit.yaw
  scene.updateMatrixWorld(true)

  const track = def.wing.span * (fit.track || def.gear.track || 0.18)
  const noseZ = def.length * (fit.noseZ ?? 0.3)
  const mainZ = def.length * (fit.mainZ ?? -0.05)

  if (!fit.skids) {
    const placeMeshes = (meshes, x, z, name) => {
      if (!meshes.length) return false
      const leg = new THREE.Group()
      leg.name = name
      for (const m of meshes) leg.attach(m)
      hangLegToBelly(leg, tireR, drop, { preferTireScale: false })
      const holder = new THREE.Group()
      holder.name = name
      holder.add(leg)
      holder.position.set(x, bellyY + Math.max(0.08, tireR * 0.12), z)
      group.add(holder)
      return true
    }

    // Prefer flat bucketing — it also picks lone tire meshes (b747 blglf/wlglf)
    // that named-group collection misses. Fall back to named groups next.
    const flat = collectFlatLegMeshes(scene)
    if (flat) {
      placeMeshes(flat.nose, 0, noseZ, "nlg")
      placeMeshes(flat.left, -track / 2, mainZ, "mlgL")
      placeMeshes(flat.right, track / 2, mainZ, "mlgR")
      if (flat.body?.length) {
        // Bundle body-gear scraps into at most two centerline bogies (747).
        const bodyL = []
        const bodyR = []
        const center = new THREE.Vector3()
        for (const node of flat.body) {
          new THREE.Box3().setFromObject(node).getCenter(center)
          if (center.x < -0.05) bodyL.push(node)
          else if (center.x > 0.05) bodyR.push(node)
          else (bodyL.length <= bodyR.length ? bodyL : bodyR).push(node)
        }
        placeMeshes(bodyL, -track * 0.22, mainZ - def.length * 0.02, "mlgBL")
        placeMeshes(bodyR, track * 0.22, mainZ - def.length * 0.02, "mlgBR")
      }
      scene.visible = false
      return
    }

    const named = collectNamedLegGroups(scene)
    const noseG = named.filter((l) => l.role === "nose").map((l) => l.node)
    const leftG = named.filter((l) => l.role === "left").map((l) => l.node)
    const rightG = named.filter((l) => l.role === "right").map((l) => l.node)
    const bodyG = named.filter((l) => l.role === "body").map((l) => l.node)
    if (noseG.length + leftG.length + rightG.length >= 2 && (leftG.length || rightG.length)) {
      placeMeshes(noseG, 0, noseZ, "nlg")
      placeMeshes(leftG, -track / 2, mainZ, "mlgL")
      placeMeshes(rightG, track / 2, mainZ, "mlgR")
      for (let i = 0; i < bodyG.length; i++) {
        const x = bodyG.length === 1 ? 0 : THREE.MathUtils.lerp(-track * 0.3, track * 0.3, i / Math.max(1, bodyG.length - 1))
        placeMeshes([bodyG[i]], x, mainZ - def.length * 0.02, `mlgB${i}`)
      }
      scene.visible = false
      return
    }
  }

  // Skids / unsplit blob — hang as one unit under the belly.
  hangAirframeUnit(scene)
  const holder = new THREE.Group()
  holder.name = "gear"
  holder.add(scene)
  holder.position.set(0, bellyY + Math.max(0.08, tireR * 0.12), 0)
  group.add(holder)
}

function hangAirframeUnit(obj) {
  obj.updateMatrixWorld(true)
  const attachY = measureAttachTopY(obj)
  const box = measureBox(obj)
  obj.position.y -= attachY
  obj.position.x -= (box.min.x + box.max.x) * 0.5
  obj.position.z -= (box.min.z + box.max.z) * 0.5
}

/** Named Object3D groups that already bundle a whole leg. */
function collectNamedLegGroups(scene) {
  const found = []
  const sceneSize = measureBox(scene).getSize(new THREE.Vector3())
  const maxDim = Math.max(sceneSize.x, sceneSize.y, sceneSize.z, 1)

  let roots = scene.children.slice()
  if (roots.length === 1 && !roots[0].isMesh) roots = roots[0].children.slice()

  for (const node of roots) {
    if (!node || node.isMesh) continue
    const n = (node.name || "").toLowerCase()
    if (!n || /fuselage|effect|door|well|fairing|wingin|bay|engine/.test(n)) continue
    let role = null
    if (/nosegear|nose_gear|^nlg_|frtgear/.test(n) && !/door|well/.test(n)) role = "nose"
    else if (/(^left_gear|^leftgear|mlg.?l|wlg.?left|blg.?left)/.test(n)) role = "left"
    else if (/(^right_gear|^rightgear|mlg.?r|wlg.?right|blg.?right)/.test(n)) role = "right"
    else if (/(mid_gear|body.?gear|center.?gear)/.test(n)) role = "body"
    if (!role) continue
    let meshes = 0
    node.traverse((c) => {
      if (c.isMesh) meshes += 1
    })
    if (meshes < 1) continue
    // Reject grab-bag groups that are basically the whole kit (e.g. b747 nosewheel002).
    const size = measureBox(node).getSize(new THREE.Vector3())
    if (Math.max(size.x, size.z) > maxDim * 0.55) continue
    found.push({ node, role, name: node.name })
  }
  return found
}

const SKIP_FLAT_RE = /door|well|fairing|bay|engine|revlink|rudder|trim|compart|armature|plane$|effect|wingin|taxi-light|geardr|dr[1-4]$|ibdoor/

/**
 * Flat FG extracts: bucket every top-level child by name into nose/left/right.
 */
function collectFlatLegMeshes(scene) {
  const nose = []
  const left = []
  const right = []
  const body = []
  let world = scene
  if (scene.children.length === 1 && !scene.children[0].isMesh) world = scene.children[0]
  const sceneSize = measureBox(scene).getSize(new THREE.Vector3())
  const maxDim = Math.max(sceneSize.x, sceneSize.z, 1)

  const classify = (node) => {
    const n = (node.name || "").toLowerCase()
    if (!n || SKIP_FLAT_RE.test(n) || DOOR_RE.test(n)) return
    if (
      /(gearnose|nosegear|nose_gear|^nlg_|frt|wheelf|gear[1-9]?f$|gearf[lr]?$|nosewheel)/.test(n) &&
      !/left|right|main|blg|wlg/.test(n)
    ) {
      nose.push(node)
    } else if (/^blg|body.?gear|mid_gear|center.?gear|mainwheels|main.?strut/.test(n)) {
      // 747 body-gear / ATR combined mains — centerline stations.
      body.push(node)
    } else if (
      /(gearleft|leftgear|left_gear|_left|lh|lhwheel|gearl[0-9l]|wheell|wlg_?left|^wlgl|maingear1|maingrtires[12]|left_rear|left_trim|^l(gear|strut|axle|wheel|damper|maingear|winggear|geartubing)|mainstrut1)/.test(
        n
      )
    ) {
      left.push(node)
    } else if (
      /(gearright|rightgear|right_gear|_right|rh|rhwheel|gearr[0-9]|wheelr|wlg_?right|^wlgr|maingear2|maingrtires[34]|right_rear|right_trim|^r(gear|strut|axle|wheel|damper|maingear|winggear|geartubing)|mainstrut2)/.test(
        n
      )
    ) {
      right.push(node)
    } else if (/^nosegear$|^noses?$|^nlg/.test(n)) {
      nose.push(node)
    }
  }

  for (const child of world.children) {
    const n = (child.name || "").toLowerCase()
    if (!n || SKIP_FLAT_RE.test(n) || DOOR_RE.test(n)) continue
    const size = measureBox(child).getSize(new THREE.Vector3())
    // Explode oversized grab-bags (b747 nosewheel002) into classifiable children.
    if (Math.max(size.x, size.z) > maxDim * 0.55) {
      for (const sub of child.children) classify(sub)
      continue
    }
    classify(child)
  }

  // 747 body-gear tires blglf/blgrr etc. already matched left/right via blgl/blgr.
  if (!nose.length || (!left.length && !right.length)) return null
  if (nose.length + left.length + right.length < 3) return null
  return { nose, left, right, body }
}
