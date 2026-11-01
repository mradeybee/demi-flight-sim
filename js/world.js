import * as THREE from "three"
import {
  PAD_LOCAL,
  RUNWAY_LOCAL,
  slotOrigin,
  padForSlot,
  towerForSlot,
  airportLabel,
} from "./airportSlots.js"

export const PAD = { ...PAD_LOCAL }
export const RUNWAY = { ...RUNWAY_LOCAL }
/** Soft world bound — flat Earth playground spanning all continents. */
export const WORLD_RADIUS = 92000
export { slotOrigin, padForSlot, towerForSlot, airportLabel }

/** Land disks: [x, z, radius, colorHex, label] — simplified whole-world map. */
const CONTINENTS = [
  // North America (Turbo Field / home)
  [-2500, 500, 11000, 0x3e8c45, "North America"],
  // Greenland
  [-8000, -22000, 4200, 0xdde8f2, "Greenland"],
  // South America
  [-7000, 22000, 7500, 0x2f7a3a, "South America"],
  // Europe
  [14000, -9000, 5200, 0x4a9a55, "Europe"],
  // Africa
  [12000, 12000, 7800, 0xc4a35a, "Africa"],
  // Asia (big)
  [32000, -4000, 12000, 0x5a9a4a, "Asia"],
  // India subcontinent bump
  [26000, 8000, 3200, 0x6aaa58, "India"],
  // Australia
  [36000, 22000, 4800, 0xc48a4a, "Australia"],
  // Antarctica
  [2000, 42000, 9000, 0xeaf4ff, "Antarctica"],
  // Japan / Pacific islands
  [42000, -2000, 1800, 0x4a8f52, "Japan"],
  [45000, 6000, 900, 0x3d9a6a, "Pacific isle"],
  [48000, 10000, 700, 0x3d9a6a, "Pacific isle"],
  // UK / Ireland bump off Europe
  [9000, -11000, 1400, 0x4a9a55, "UK"],
  // Caribbean
  [-2000, 9000, 900, 0x3d9a6a, "Caribbean"],
  [500, 10000, 600, 0x3d9a6a, "Caribbean"],
  // Madagascar
  [18000, 18000, 1100, 0x3d8a48, "Madagascar"],
  // New Zealand
  [42000, 28000, 1600, 0x4a8f52, "New Zealand"],
]

const WORLD_AIRPORTS = [
  [10500, -2800, "CAIRO"],
  [-11800, 5200, "MIAMI"],
  [1800, 13200, "RIO"],
  [-2500, -12500, "NUUK"],
  [22000, 4500, "DUBAI"],
  [-21000, -5500, "SEATTLE"],
  [8000, -15500, "REYKJAVIK"],
  [14000, 18000, "NAIROBI"],
  [-16000, -18000, "ANCHORAGE"],
  [32000, -6000, "BEIJING"],
  [38000, 20000, "SYDNEY"],
  [15000, -8000, "PARIS"],
  [10000, -9500, "LONDON"],
  [40000, -1500, "TOKYO"],
  [-9000, 20000, "BUENOS AIRES"],
  [28000, 7000, "MUMBAI"],
  [5000, 8000, "LAGOS"],
  [-15000, 2000, "LOS ANGELES"],
  [0, 38000, "SOUTH POLE"],
  [42000, 27000, "AUCKLAND"],
]

function grassTexture() {
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = "#3e8c45"
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 2200; i += 1) {
    ctx.fillStyle = i % 2 ? "#357a3c" : "#4f9d52"
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 3)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(140, 140)
  return texture
}

function desertTexture() {
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = "#d2b48c"
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 800; i += 1) {
    ctx.fillStyle = i % 2 ? "#c4a574" : "#e0c9a0"
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 2)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(40, 40)
  return texture
}

function makeSign(text) {
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = 160
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = "#102033"
  ctx.fillRect(0, 0, 512, 160)
  ctx.strokeStyle = "#f0a202"
  ctx.lineWidth = 10
  ctx.strokeRect(8, 8, 496, 144)
  ctx.fillStyle = "#f6f1e6"
  ctx.font = "700 64px Arial"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(text, 256, 84)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.Mesh(new THREE.PlaneGeometry(18, 5.6), new THREE.MeshBasicMaterial({ map: texture }))
}

function addTree(instances, index, x, z, scale) {
  const dummy = new THREE.Object3D()
  dummy.position.set(x, 0, z)
  dummy.scale.set(scale, 0.8 + Math.random() * 0.7, scale)
  dummy.updateMatrix()
  instances.setMatrixAt(index, dummy.matrix)
}

function addMountain(scene, obstacles, x, z, radius, height, color, snow) {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, 7),
    new THREE.MeshStandardMaterial({ color, roughness: 1 })
  )
  mesh.position.set(x, height / 2 - 8, z)
  scene.add(mesh)
  if (snow) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.28, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.8 })
    )
    cap.position.set(x, height - 20, z)
    scene.add(cap)
  }
  obstacles.push({ name: "mountain", type: "cone", x, z, r: radius * 0.72, h: height })
}

function addCity(scene, obstacles, cx, cz, count, palette) {
  for (let i = 0; i < count; i += 1) {
    const h = 16 + Math.random() * 90
    const w = 12 + Math.random() * 22
    const d = 12 + Math.random() * 22
    const col = 4
    const x = cx + (i % col) * 48 - col * 18 + (Math.random() - 0.5) * 10
    const z = cz + Math.floor(i / col) * 52 - 40 + (Math.random() - 0.5) * 10
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color: palette[i % palette.length],
        roughness: 0.55,
        metalness: 0.12,
      })
    )
    mesh.position.set(x, h / 2, z)
    mesh.castShadow = true
    scene.add(mesh)
    obstacles.push({ name: "city", type: "cylinder", x, z, r: Math.max(w, d) * 0.45, h })
  }
}

function addAirport(scene, obstacles, ox, oz, label) {
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x3a404a, roughness: 0.88 })
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(40, 1400), asphalt)
  strip.rotation.x = -Math.PI / 2
  strip.position.set(ox, 0.04, oz + 700)
  strip.receiveShadow = true
  scene.add(strip)
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 280),
    new THREE.MeshStandardMaterial({ color: 0x9aa1aa, roughness: 0.92 })
  )
  apron.rotation.x = -Math.PI / 2
  apron.position.set(ox - 140, 0.03, oz + 180)
  scene.add(apron)
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 3.2, 34, 10),
    new THREE.MeshStandardMaterial({ color: 0xd7d1c6 })
  )
  tower.position.set(ox + 70, 17, oz + 160)
  tower.castShadow = true
  scene.add(tower)
  const sign = makeSign(label)
  sign.position.set(ox + 50, 4, oz + 40)
  sign.rotation.y = -0.5
  scene.add(sign)
  obstacles.push({ name: "tower", type: "cylinder", x: ox + 70, z: oz + 160, r: 6, h: 36 })
}

export function createWorld(scene) {
  const obstacles = []
  const roads = []
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x3d4248, roughness: 0.95 })
  const roadDashMat = new THREE.MeshBasicMaterial({ color: 0xf0f0f0 })
  const HIGHWAY_CX = -400
  const HIGHWAY_CZ = 800
  const HIGHWAY_R = 6200
  const HIGHWAY_WIDTH = 14

  function distToSegment(px, pz, x0, z0, x1, z1) {
    const dx = x1 - x0
    const dz = z1 - z0
    const len2 = dx * dx + dz * dz
    if (len2 < 1e-6) return Math.hypot(px - x0, pz - z0)
    let t = ((px - x0) * dx + (pz - z0) * dz) / len2
    t = Math.max(0, Math.min(1, t))
    return Math.hypot(px - (x0 + t * dx), pz - (z0 + t * dz))
  }

  function addRoadSegment(x0, z0, x1, z1, width = HIGHWAY_WIDTH, parent = scene, y = 0.04) {
    const dx = x1 - x0
    const dz = z1 - z0
    const len = Math.hypot(dx, dz)
    if (len < 0.5) return null
    const yaw = Math.atan2(dx, dz)
    const cx = (x0 + x1) / 2
    const cz = (z0 + z1) / 2
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(width, len), roadMat)
    seg.rotation.x = -Math.PI / 2
    seg.rotation.z = yaw
    seg.position.set(cx, y, cz)
    seg.receiveShadow = true
    parent.add(seg)
    const entry = { x0, z0, x1, z1, width, cx, cz, len, yaw }
    roads.push(entry)
    return entry
  }

  function addDashedCenterline(x0, z0, x1, z1, parent, y = 0.06) {
    const dx = x1 - x0
    const dz = z1 - z0
    const len = Math.hypot(dx, dz)
    const yaw = Math.atan2(dx, dz)
    const ux = dx / len
    const uz = dz / len
    for (let d = 4; d < len - 4; d += 14) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 6), roadDashMat)
      dash.rotation.x = -Math.PI / 2
      dash.rotation.z = yaw
      dash.position.set(x0 + ux * d, y, z0 + uz * d)
      parent.add(dash)
    }
  }

  // —— Whole-world ocean ——
  const ocean = new THREE.Mesh(
    new THREE.CircleGeometry(WORLD_RADIUS, 128),
    new THREE.MeshStandardMaterial({ color: 0x0f5f8c, roughness: 0.28, metalness: 0.2 })
  )
  ocean.rotation.x = -Math.PI / 2
  ocean.position.y = -0.25
  scene.add(ocean)

  const landDisks = []
  const grassMap = grassTexture()
  const sandMap = desertTexture()
  for (const [x, z, r, color, label] of CONTINENTS) {
    const isHome = label === "North America"
    const isDesert = label === "Africa" || label === "Australia"
    const isIce = label === "Antarctica" || label === "Greenland"
    const mat = new THREE.MeshStandardMaterial({
      color: isHome || (!isDesert && !isIce) ? 0xffffff : color,
      map: isHome ? grassMap : isDesert ? sandMap : null,
      roughness: isIce ? 0.45 : 1,
      metalness: isIce ? 0.08 : 0,
    })
    if (!isHome && !isDesert) mat.color.setHex(color)
    const land = new THREE.Mesh(new THREE.CircleGeometry(r, Math.max(24, Math.min(72, Math.floor(r / 120)))), mat)
    land.rotation.x = -Math.PI / 2
    land.position.set(x, 0.02, z)
    land.receiveShadow = true
    scene.add(land)
    landDisks.push({ x, z, r: r * 0.92, label })
    if (r > 2500 && label !== "Pacific isle" && label !== "Caribbean") {
      const tag = makeSign(label.toUpperCase())
      tag.position.set(x, 28, z - r * 0.15)
      tag.scale.set(2.2, 2.2, 2.2)
      scene.add(tag)
    }
  }

  // Home Atlantic beach strip — kept east of Turbo Field, not under player pads.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 14000),
    new THREE.MeshStandardMaterial({ color: 0xd9c48a, roughness: 1 })
  )
  sand.rotation.x = -Math.PI / 2
  sand.position.set(520, 0.025, 500)
  sand.receiveShadow = true
  scene.add(sand)

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 14000),
    new THREE.MeshStandardMaterial({ color: 0x1c7eae, roughness: 0.25, metalness: 0.15 })
  )
  water.rotation.x = -Math.PI / 2
  // Starts past the beach so slot airports on land stay dry visually.
  water.position.set(8200, -0.05, 500)
  scene.add(water)

  // Player airports (multiplayer slots) — built on demand via ensureAirport.
  const playerAirports = new Map()

  function paintSignTexture(mesh, text) {
    const canvas = document.createElement("canvas")
    canvas.width = 512
    canvas.height = 160
    const ctx = canvas.getContext("2d")
    ctx.fillStyle = "#102033"
    ctx.fillRect(0, 0, 512, 160)
    ctx.strokeStyle = "#f0a202"
    ctx.lineWidth = 10
    ctx.strokeRect(8, 8, 496, 144)
    ctx.fillStyle = "#f6f1e6"
    ctx.font = "700 48px Arial"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const label = String(text).slice(0, 22)
    ctx.fillText(label, 256, 84)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    if (mesh.material.map) mesh.material.map.dispose()
    mesh.material.map = texture
    mesh.material.needsUpdate = true
  }

  function buildPlayerAirport(ox, oz, label) {
    const group = new THREE.Group()
    group.name = `airport-${ox}-${oz}`

    // Grass plateau under the pad so coasts never look like open ocean.
    const plateau = new THREE.Mesh(
      new THREE.CircleGeometry(900, 48),
      new THREE.MeshStandardMaterial({ color: 0x3e8c45, roughness: 1 })
    )
    plateau.rotation.x = -Math.PI / 2
    plateau.position.set(ox - 80, 0.015, oz + 700)
    plateau.receiveShadow = true
    group.add(plateau)

    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(340, 720),
      new THREE.MeshStandardMaterial({ color: 0x9aa1aa, roughness: 0.92 })
    )
    apron.rotation.x = -Math.PI / 2
    apron.position.set(ox - 200, 0.03, oz + 320)
    apron.receiveShadow = true
    group.add(apron)

    const taxi = new THREE.Mesh(
      new THREE.PlaneGeometry(150, 22),
      new THREE.MeshStandardMaterial({ color: 0x6d737c, roughness: 0.9 })
    )
    taxi.rotation.x = -Math.PI / 2
    taxi.position.set(ox - 70, 0.045, oz + 200)
    taxi.receiveShadow = true
    group.add(taxi)

    const asphalt = new THREE.MeshStandardMaterial({ color: 0x3a404a, roughness: 0.88 })
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(48, 2000), asphalt)
    runway.rotation.x = -Math.PI / 2
    runway.position.set(ox, 0.05, oz + 1000)
    runway.receiveShadow = true
    group.add(runway)

    const paint = new THREE.MeshBasicMaterial({ color: 0xf4f4f4 })
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 1960), paint)
      edge.rotation.x = -Math.PI / 2
      edge.position.set(ox + side * 22, 0.07, oz + 1000)
      group.add(edge)
    }
    for (let z = 50; z < 1960; z += 54) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 26), paint)
      dash.rotation.x = -Math.PI / 2
      dash.position.set(ox, 0.07, oz + z)
      group.add(dash)
    }
    for (const z of [36, 1964]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(40, 8), paint)
      bar.rotation.x = -Math.PI / 2
      bar.position.set(ox, 0.08, oz + z)
      group.add(bar)
    }

    const number = makeSign("36")
    number.rotation.x = -Math.PI / 2
    number.rotation.z = Math.PI
    number.scale.set(0.55, 0.55, 0.55)
    number.position.set(ox, 0.09, oz + 130)
    group.add(number)

    const sign = makeSign(label)
    sign.position.set(ox + 46, 4.2, oz + 70)
    sign.rotation.y = -0.6
    group.add(sign)
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x22262c })
    )
    post.position.set(ox + 46, 2, oz + 70)
    group.add(post)

    const towerGroup = new THREE.Group()
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 4.2, 42, 12),
      new THREE.MeshStandardMaterial({ color: 0xd7d1c6, roughness: 0.7 })
    )
    shaft.position.y = 21
    shaft.castShadow = true
    const cab = new THREE.Mesh(
      new THREE.CylinderGeometry(6.5, 6.5, 5, 12),
      new THREE.MeshStandardMaterial({ color: 0x8ecae6, roughness: 0.25, metalness: 0.2 })
    )
    cab.position.y = 44
    cab.castShadow = true
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(7.2, 3.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x1d3557 })
    )
    roof.position.y = 48
    towerGroup.add(shaft, cab, roof)
    towerGroup.position.set(ox + 115, 0, oz + 190)
    group.add(towerGroup)
    obstacles.push({ name: "tower", type: "cylinder", x: ox + 115, z: oz + 190, r: 8, h: 50 })

    const hangar = new THREE.Mesh(
      new THREE.BoxGeometry(78, 16, 46),
      new THREE.MeshStandardMaterial({ color: 0x6e7784, metalness: 0.45, roughness: 0.45 })
    )
    hangar.position.set(ox - 310, 8, oz + 120)
    hangar.castShadow = true
    hangar.receiveShadow = true
    group.add(hangar)
    const hangarDoor = new THREE.Mesh(
      new THREE.BoxGeometry(36, 10, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xc5ccd4 })
    )
    hangarDoor.position.set(ox - 310, 5.2, oz + 143)
    group.add(hangarDoor)
    obstacles.push({ name: "hangar", type: "cylinder", x: ox - 310, z: oz + 120, r: 42, h: 18 })

    // Service road: apron / car pad → west edge of field, then south toward highway spur.
    const carPadX = ox + PAD_LOCAL.x - 40
    const carPadZ = oz + PAD_LOCAL.z + 40
    const roadW = 12
    const westX = ox - 420
    const southZ = oz + 780
    addRoadSegment(carPadX, carPadZ, westX, carPadZ, roadW, group, 0.05)
    addDashedCenterline(carPadX, carPadZ, westX, carPadZ, group, 0.07)
    addRoadSegment(westX, carPadZ, westX, southZ, roadW, group, 0.05)
    addDashedCenterline(westX, carPadZ, westX, southZ, group, 0.07)
    // Spur from airport service tip out to the highway ring.
    const ang = Math.atan2(southZ - HIGHWAY_CZ, westX - HIGHWAY_CX)
    const hx = Math.cos(ang) * HIGHWAY_R + HIGHWAY_CX
    const hz = Math.sin(ang) * HIGHWAY_R + HIGHWAY_CZ
    addRoadSegment(westX, southZ, hx, hz, 12, scene, 0.045)
    addDashedCenterline(westX, southZ, hx, hz, scene, 0.065)

    scene.add(group)
    return { group, sign, ox, oz, label }
  }

  function ensureAirport(slot, name) {
    const key = Number(slot) || 0
    const origin = slotOrigin(key)
    const label = airportLabel(name)
    let entry = playerAirports.get(key)
    if (!entry) {
      entry = buildPlayerAirport(origin.x, origin.z, label)
      playerAirports.set(key, entry)
    } else if (entry.label !== label) {
      entry.label = label
      paintSignTexture(entry.sign, label)
    }
    return entry
  }

  // Highway ring around home continent (registered in roads[] for driving).
  for (let i = 0; i < 48; i += 1) {
    const a0 = (i / 48) * Math.PI * 2
    const a1 = ((i + 1) / 48) * Math.PI * 2
    const x0 = Math.cos(a0) * HIGHWAY_R + HIGHWAY_CX
    const z0 = Math.sin(a0) * HIGHWAY_R + HIGHWAY_CZ
    const x1 = Math.cos(a1) * HIGHWAY_R + HIGHWAY_CX
    const z1 = Math.sin(a1) * HIGHWAY_R + HIGHWAY_CZ
    addRoadSegment(x0, z0, x1, z1, HIGHWAY_WIDTH, scene, 0.04)
  }

  // Seed slot 0 so the hangar has a field before join completes.
  ensureAirport(0, "Turbo")

  // Scenic airports across the whole world (not player pads)
  for (const [ox, oz, label] of WORLD_AIRPORTS) {
    addAirport(scene, obstacles, ox, oz, label)
  }

  // Trees near home runway
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.2, 5)
  const leafGeo = new THREE.ConeGeometry(1.6, 4.2, 6)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4f32 })
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7d32 })
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, 280)
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, 280)
  let treeIndex = 0
  for (let z = 0; z < 2000 && treeIndex < 150; z += 32) {
    if (z > 120 && z < 300) continue
    for (const side of [-1, 1]) {
      if (treeIndex >= 150) break
      const x = side * (70 + Math.random() * 18)
      addTree(trunks, treeIndex, x, z + Math.random() * 8, 1)
      const leafDummy = new THREE.Object3D()
      leafDummy.position.set(x, 3.2, z)
      leafDummy.scale.set(1, 0.85 + Math.random() * 0.4, 1)
      leafDummy.updateMatrix()
      leaves.setMatrixAt(treeIndex, leafDummy.matrix)
      treeIndex += 1
    }
  }
  // Jungle island trees (sparse markers)
  for (let i = 0; i < 80 && treeIndex < 280; i += 1) {
    const x = -12000 + (Math.random() - 0.5) * 3000
    const z = 4000 + (Math.random() - 0.5) * 3000
    addTree(trunks, treeIndex, x, z, 1.4 + Math.random())
    const leafDummy = new THREE.Object3D()
    leafDummy.position.set(x, 4.2, z)
    leafDummy.scale.set(1.5, 1.2, 1.5)
    leafDummy.updateMatrix()
    leaves.setMatrixAt(treeIndex, leafDummy.matrix)
    treeIndex += 1
  }
  trunks.count = treeIndex
  leaves.count = treeIndex
  trunks.instanceMatrix.needsUpdate = true
  leaves.instanceMatrix.needsUpdate = true
  trunks.castShadow = true
  leaves.castShadow = true
  scene.add(trunks, leaves)

  // Mountain ranges on every continent
  const peaks = [
    // Rockies / Appalachians
    [180, 3600, 560, 720, 0x6d7270, true],
    [-1600, 2400, 480, 560, 0x66706a, true],
    [-18000, -2000, 700, 900, 0x6a7068, true],
    [-12000, 1000, 500, 640, 0x556b58, true],
    // Andes
    [-9000, 18000, 600, 1100, 0x5a6a5e, true],
    [-7500, 24000, 520, 980, 0x4a5a50, true],
    // Alps / Europe
    [13000, -8500, 400, 720, 0x7d7468, true],
    [16000, -7000, 350, 600, 0x6a7068, true],
    // Atlas / Africa
    [9000, 9000, 500, 700, 0x8a7355, false],
    [14000, 14000, 600, 820, 0x9a8060, false],
    // Himalayas
    [28000, -1000, 900, 1600, 0xb8c8d8, true],
    [30000, 500, 700, 1400, 0xc5d4e0, true],
    [26000, 2000, 550, 1100, 0xa8b8c8, true],
    // Australia
    [34000, 20000, 450, 560, 0xa65a30, false],
    // Antarctica
    [0, 40000, 1000, 900, 0xe8f0f8, true],
    [4000, 43000, 700, 700, 0xd8e4f0, true],
    // Japan volcanoes
    [42000, -1500, 400, 900, 0x4a3a32, false],
    [42500, -500, 320, 700, 0x3a2a22, false],
  ]
  for (const [x, z, r, h, c, snow] of peaks) addMountain(scene, obstacles, x, z, r, h, c, snow)

  // Mount Fuji-style volcano
  const volcano = new THREE.Mesh(
    new THREE.ConeGeometry(420, 1100, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 1 })
  )
  volcano.position.set(42200, 540, -800)
  scene.add(volcano)
  const lava = new THREE.Mesh(
    new THREE.SphereGeometry(90, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4a12 })
  )
  lava.position.set(42200, 1080, -800)
  scene.add(lava)
  obstacles.push({ name: "volcano", type: "cone", x: 42200, z: -800, r: 320, h: 1100 })

  // Egypt pyramids
  for (const [x, z] of [[10800, -3000], [11200, -2600], [10400, -2500]]) {
    const pyr = new THREE.Mesh(
      new THREE.ConeGeometry(90, 160, 4),
      new THREE.MeshStandardMaterial({ color: 0xd4b896, roughness: 1 })
    )
    pyr.position.set(x, 70, z)
    pyr.rotation.y = Math.PI / 4
    scene.add(pyr)
    obstacles.push({ name: "pyramid", type: "cone", x, z, r: 70, h: 160 })
  }

  // Coastal lighthouse
  const lightTower = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 5, 48, 10),
    new THREE.MeshStandardMaterial({ color: 0xf2f0ea })
  )
  lightTower.position.set(560, 24, -40)
  const lightCap = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6, 6, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe066 })
  )
  lightCap.position.set(560, 50, -40)
  scene.add(lightTower, lightCap)
  obstacles.push({ name: "lighthouse", type: "cylinder", x: 560, z: -40, r: 8, h: 52 })

  // Long bridge across a bay
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(18, 4, 900),
    new THREE.MeshStandardMaterial({ color: 0x6a727c, metalness: 0.35, roughness: 0.55 })
  )
  bridge.position.set(900, 18, 4200)
  scene.add(bridge)
  for (const z of [3900, 4200, 4500]) {
    const pier = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 4, 20, 8),
      new THREE.MeshStandardMaterial({ color: 0x555a60 })
    )
    pier.position.set(900, 8, z)
    scene.add(pier)
  }

  // Cities on every continent
  const urban = [0xcfd6df, 0xb7c3ce, 0x9fb0c2, 0xd7c4a3, 0xa8b5c0]
  addCity(scene, obstacles, -980, 2500, 28, urban)
  addCity(scene, obstacles, 400, 2800, 18, urban)
  addCity(scene, obstacles, -15000, 1800, 22, urban)
  addCity(scene, obstacles, -11000, 5000, 16, [0x9ec9a0, 0xb8d4b0, 0x7aa87c])
  addCity(scene, obstacles, -8500, 21000, 18, urban)
  addCity(scene, obstacles, 14500, -8200, 24, urban)
  addCity(scene, obstacles, 10500, -9200, 20, urban)
  addCity(scene, obstacles, 11500, 11000, 16, [0xe8d5b7, 0xd4c0a0, 0xc9b896])
  addCity(scene, obstacles, 31000, -5000, 26, urban)
  addCity(scene, obstacles, 39500, -1200, 22, urban)
  addCity(scene, obstacles, 37000, 21000, 18, [0xd8a878, 0xc09060, 0xa87848])
  addCity(scene, obstacles, 27000, 7500, 16, urban)
  addCity(scene, obstacles, 5000, 8500, 14, urban)
  addCity(scene, obstacles, 14000, 17500, 12, urban)

  // Boats / freighters on the seas
  const boatMat = new THREE.MeshStandardMaterial({ color: 0xf7f7f2 })
  const boatSpots = [
    [700, 400], [980, -200], [1400, 900], [4000, 2000], [8000, -3000],
    [-9000, 6000], [3000, 11000], [-5000, -9000], [15000, 2000], [-2000, 16000],
    [18000, 12000], [-20000, 2000], [6000, -18000], [-14000, -14000], [28000, 6000],
  ]
  for (const spot of boatSpots) {
    const boat = new THREE.Mesh(new THREE.BoxGeometry(22, 5, 8), boatMat)
    boat.position.set(spot[0], 1.8, spot[1])
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(8, 4, 5),
      new THREE.MeshStandardMaterial({ color: 0x1d3557 })
    )
    cabin.position.set(spot[0] + 3, 5, spot[1])
    scene.add(boat, cabin)
  }

  // Oil platforms
  for (const [x, z] of [[6000, 4000], [-7000, 9000], [12000, 10000], [16000, -8000], [-24000, 8000]]) {
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(40, 4, 40),
      new THREE.MeshStandardMaterial({ color: 0x8a9098, metalness: 0.5 })
    )
    deck.position.set(x, 8, z)
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2.5, 16, 8),
      new THREE.MeshStandardMaterial({ color: 0x555a60 })
    )
    leg.position.set(x, 0, z)
    const flare = new THREE.Mesh(
      new THREE.SphereGeometry(3, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff7a2a })
    )
    flare.position.set(x + 12, 22, z)
    scene.add(deck, leg, flare)
    obstacles.push({ name: "platform", type: "cylinder", x, z, r: 28, h: 24 })
  }

  // Cloud layer across the whole planet
  const clouds = []
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.88,
    roughness: 1,
  })
  for (let i = 0; i < 180; i += 1) {
    const puff = new THREE.Group()
    const blobs = 3 + (i % 4)
    for (let b = 0; b < blobs; b += 1) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(22 + (b % 3) * 10, 8, 6), cloudMat)
      mesh.position.set((b - 1) * 18, (b % 2) * 7, (b % 3 - 1) * 8)
      puff.add(mesh)
    }
    const ang = Math.random() * Math.PI * 2
    const rad = 600 + Math.random() * (WORLD_RADIUS * 0.88)
    puff.position.set(Math.cos(ang) * rad, 420 + Math.random() * 1400, Math.sin(ang) * rad)
    puff.userData.speed = 6 + Math.random() * 12
    scene.add(puff)
    clouds.push(puff)
  }

  // Ring course — around-the-world tour
  const rings = [
    { x: 0, y: 32, z: 1150, r: 26, yaw: 0 },
    { x: -160, y: 90, z: 1650, r: 24, yaw: 0.45 },
    { x: -40, y: 160, z: 2300, r: 28, yaw: 0.2 },
    { x: 360, y: 120, z: 1750, r: 26, yaw: -0.8 },
    { x: 30, y: 55, z: 480, r: 22, yaw: Math.PI },
    { x: -900, y: 220, z: 3200, r: 30, yaw: 0.3 },
    { x: -11000, y: 280, z: 4800, r: 32, yaw: -0.5 },
    { x: 10000, y: 320, z: -8500, r: 34, yaw: 1.0 },
    { x: 28000, y: 400, z: -3000, r: 36, yaw: 0.8 },
    { x: 39000, y: 350, z: -1000, r: 34, yaw: 1.2 },
    { x: 36000, y: 300, z: 20000, r: 36, yaw: -0.9 },
    { x: 12000, y: 280, z: 12000, r: 34, yaw: 0.4 },
    { x: -7000, y: 320, z: 21000, r: 34, yaw: -1.1 },
    { x: 2000, y: 260, z: 38000, r: 38, yaw: Math.PI },
    { x: -15000, y: 300, z: -4000, r: 32, yaw: -0.6 },
  ].map((ring) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(ring.r, Math.max(0.8, ring.r * 0.045), 10, 40),
      new THREE.MeshBasicMaterial({ color: 0x2de2d1 })
    )
    mesh.position.set(ring.x, ring.y, ring.z)
    mesh.rotation.y = ring.yaw
    scene.add(mesh)
    return { ...ring, mesh, got: false }
  })

  // Sky dome
  const skyCanvas = document.createElement("canvas")
  skyCanvas.width = 16
  skyCanvas.height = 256
  const skyCtx = skyCanvas.getContext("2d")
  const skyTex = new THREE.CanvasTexture(skyCanvas)
  skyTex.colorSpace = THREE.SRGBColorSpace
  function paintSky(stops) {
    const gradient = skyCtx.createLinearGradient(0, 0, 0, 256)
    for (const [t, color] of stops) gradient.addColorStop(t, color)
    skyCtx.fillStyle = gradient
    skyCtx.fillRect(0, 0, 16, 256)
    skyTex.needsUpdate = true
  }
  paintSky([
    [0, "#0b3d91"],
    [0.35, "#1f6fd0"],
    [0.55, "#79c6ff"],
    [0.78, "#d7f1ff"],
    [1, "#f3e2c2"],
  ])
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(WORLD_RADIUS * 1.35, 32, 20),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false })
  )
  scene.add(sky)

  const sunBall = new THREE.Mesh(
    new THREE.SphereGeometry(140, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff1c2, fog: false })
  )
  sunBall.position.set(8000, 9000, -4000)
  scene.add(sunBall)

  // Simple moon opposite the sun
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(70, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xe8eef5, fog: false })
  )
  moon.position.set(-10000, 7000, 6000)
  scene.add(moon)

  function update(dt) {
    for (const cloud of clouds) {
      cloud.position.x += cloud.userData.speed * dt
      if (cloud.position.x > WORLD_RADIUS * 0.9) cloud.position.x = -WORLD_RADIUS * 0.9
    }
    for (const ring of rings) {
      ring.mesh.rotation.z += dt * 0.25
    }
    water.position.y = -0.08 + Math.sin(performance.now() * 0.0006) * 0.04
  }

  function resetRings() {
    for (const ring of rings) {
      ring.got = false
      ring.mesh.material.color.set(0x2de2d1)
    }
  }

  function onRunway(x, z) {
    return Math.abs(x - RUNWAY.x) < RUNWAY.halfWidth && z > RUNWAY.z0 && z < RUNWAY.z1
  }

  function nearestRoad(x, z) {
    let best = null
    let bestDist = Infinity
    for (const seg of roads) {
      const d = distToSegment(x, z, seg.x0, seg.z0, seg.x1, seg.z1)
      if (d < bestDist) {
        bestDist = d
        best = seg
      }
    }
    return best ? { seg: best, dist: bestDist } : null
  }

  function onRoad(x, z) {
    const hit = nearestRoad(x, z)
    if (!hit) return false
    return hit.dist <= hit.seg.width * 0.55
  }

  function onDrivable(x, z) {
    return onRoad(x, z) || onRunway(x, z) || onPlayerAirport(x, z)
  }

  function setLocalAirport(slot, name) {
    ensureAirport(slot, name)
    const origin = slotOrigin(slot)
    const pad = padForSlot(slot)
    const tower = towerForSlot(slot)
    PAD.x = pad.x
    PAD.z = pad.z
    RUNWAY.x = origin.x + RUNWAY_LOCAL.x
    RUNWAY.z0 = origin.z + RUNWAY_LOCAL.z0
    RUNWAY.z1 = origin.z + RUNWAY_LOCAL.z1
    RUNWAY.halfWidth = RUNWAY_LOCAL.halfWidth
    api.towerPos = tower
    api.localSlot = Number(slot) || 0
    api.localOrigin = origin
    api.airportName = airportLabel(name)
    return { pad, tower, origin, label: api.airportName }
  }

  function onPlayerAirport(x, z) {
    for (const entry of playerAirports.values()) {
      const { ox, oz } = entry
      // Runway strip
      if (Math.abs(x - ox) < RUNWAY_LOCAL.halfWidth + 8 && z > oz - 40 && z < oz + RUNWAY_LOCAL.z1 + 40) {
        return true
      }
      // Apron / hangar pad
      if (Math.abs(x - (ox - 200)) < 200 && Math.abs(z - (oz + 320)) < 400) return true
      // Grass plateau under the field
      if (Math.hypot(x - (ox - 80), z - (oz + 700)) < 900) return true
    }
    return false
  }

  function overWater(x, z = 0) {
    // Active / any player field always counts as dry (takeoff & taxi).
    if (onRunway(x, z) || onPlayerAirport(x, z)) return false
    // Atlantic beach near Turbo Field always counts as water
    if (x > 540 && x < 12000 && Math.abs(z) < 7000) {
      let onLand = false
      for (const disk of landDisks) {
        if (Math.hypot(x - disk.x, z - disk.z) < disk.r) { onLand = true; break }
      }
      if (!onLand) return true
    }
    for (const disk of landDisks) {
      if (Math.hypot(x - disk.x, z - disk.z) < disk.r) return false
    }
    return Math.hypot(x, z) < WORLD_RADIUS
  }

  function nearestRegion(x, z) {
    for (const disk of landDisks) {
      if (Math.hypot(x - disk.x, z - disk.z) < disk.r) return disk.label
    }
    return "Ocean"
  }

  const api = {
    obstacles,
    roads,
    rings,
    update,
    resetRings,
    onRunway,
    onRoad,
    nearestRoad,
    onDrivable,
    onPlayerAirport,
    overWater,
    paintSky,
    sky,
    sunBall,
    moon,
    clouds,
    cloudMat,
    buildings: [],
    towerPos: towerForSlot(0),
    localSlot: 0,
    localOrigin: slotOrigin(0),
    airportName: airportLabel("Turbo"),
    ensureAirport,
    setLocalAirport,
    landmarks: {
      cairo: { x: 10500, y: 80, z: -2800 },
      miami: { x: -11800, y: 60, z: 5200 },
      rio: { x: 1800, y: 60, z: 13200 },
      london: { x: 10000, y: 60, z: -9500 },
      paris: { x: 15000, y: 60, z: -8000 },
      tokyo: { x: 40000, y: 60, z: -1500 },
      sydney: { x: 38000, y: 60, z: 20000 },
      beijing: { x: 32000, y: 60, z: -6000 },
      volcano: { x: 42200, y: 900, z: -800 },
      pyramids: { x: 10800, y: 80, z: -3000 },
      southPole: { x: 0, y: 40, z: 38000 },
      lighthouse: { x: 560, y: 52, z: -40 },
      bridge: { x: 900, y: 40, z: 4200 },
      city: { x: -980, y: 120, z: 2500 },
    },
    continents: landDisks,
    nearestRegion,
  }
  return api
}
