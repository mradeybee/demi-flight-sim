import * as THREE from "three"
import {
  PAD_LOCAL,
  RUNWAY_LOCAL,
  SLOT_ORIGINS,
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

/** Land disks: [x, z, radius, colorHex, label] — muted earth tones (satellite-like). */
const CONTINENTS = [
  // North America (Turbo Field / home)
  [-2500, 500, 11000, 0x4a6340, "North America"],
  // Greenland
  [-8000, -22000, 4200, 0xd2dde8, "Greenland"],
  // South America
  [-7000, 22000, 7500, 0x355a38, "South America"],
  // Europe
  [14000, -9000, 5200, 0x516848, "Europe"],
  // Africa
  [12000, 12000, 7800, 0xba8960, "Africa"],
  // Asia (big)
  [32000, -4000, 12000, 0x4d6a42, "Asia"],
  // India subcontinent bump
  [26000, 8000, 3200, 0x5a7848, "India"],
  // Australia
  [36000, 22000, 4800, 0xb08a52, "Australia"],
  // Antarctica
  [2000, 42000, 9000, 0xe4ecf4, "Antarctica"],
  // Japan / Pacific islands
  [42000, -2000, 1800, 0x456848, "Japan"],
  [45000, 6000, 900, 0x3d6a52, "Pacific isle"],
  [48000, 10000, 700, 0x3d6a52, "Pacific isle"],
  // UK / Ireland bump off Europe
  [9000, -11000, 1400, 0x4e6846, "UK"],
  // Caribbean
  [-2000, 9000, 900, 0x3d6a52, "Caribbean"],
  [500, 10000, 600, 0x3d6a52, "Caribbean"],
  // Madagascar
  [18000, 18000, 1100, 0x3a6840, "Madagascar"],
  // New Zealand
  [42000, 28000, 1600, 0x456848, "New Zealand"],
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

function seededNoise(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function paintTerrainCanvas(size, base, tones, blotches, speckles) {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < blotches; i += 1) {
    const x = seededNoise(i, 1.7) * size
    const y = seededNoise(i, 3.1) * size
    const r = 8 + seededNoise(i, 5.9) * size * 0.18
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
    const tone = tones[i % tones.length]
    grad.addColorStop(0, tone)
    grad.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < speckles; i += 1) {
    ctx.fillStyle = tones[i % tones.length]
    ctx.globalAlpha = 0.35
    ctx.fillRect(seededNoise(i, 9.2) * size, seededNoise(i, 11.4) * size, 1 + (i % 3), 1 + (i % 2))
  }
  ctx.globalAlpha = 1
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  return texture
}

function grassTexture() {
  const texture = paintTerrainCanvas(
    256,
    "#4a6340",
    ["rgba(58,90,52,0.55)", "rgba(72,108,60,0.5)", "rgba(90,118,70,0.4)", "rgba(40,70,42,0.45)"],
    48,
    900
  )
  texture.repeat.set(90, 90)
  return texture
}

function forestTexture() {
  const texture = paintTerrainCanvas(
    256,
    "#355a38",
    ["rgba(40,70,42,0.55)", "rgba(58,88,50,0.45)", "rgba(28,55,34,0.5)", "rgba(70,95,55,0.35)"],
    55,
    800
  )
  texture.repeat.set(70, 70)
  return texture
}

function desertTexture() {
  const texture = paintTerrainCanvas(
    256,
    "#b89660",
    ["rgba(168,130,78,0.5)", "rgba(196,160,110,0.45)", "rgba(140,108,64,0.4)", "rgba(210,180,130,0.35)"],
    40,
    700
  )
  texture.repeat.set(55, 55)
  return texture
}

function iceTexture() {
  const texture = paintTerrainCanvas(
    256,
    "#d8e2ec",
    ["rgba(240,246,252,0.55)", "rgba(190,205,220,0.45)", "rgba(210,222,232,0.4)", "rgba(255,255,255,0.35)"],
    36,
    500
  )
  texture.repeat.set(40, 40)
  return texture
}

function oceanNormalTexture() {
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = "#8080ff"
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 1400; i += 1) {
    const x = seededNoise(i, 2.2) * 256
    const y = seededNoise(i, 4.4) * 256
    const g = 110 + Math.floor(seededNoise(i, 6.6) * 40)
    const b = 180 + Math.floor(seededNoise(i, 8.8) * 50)
    ctx.fillStyle = `rgb(${g},${g},${b})`
    ctx.fillRect(x, y, 2, 1)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(220, 220)
  return texture
}

function groundMaterial(opts) {
  const mat = new THREE.MeshStandardMaterial(opts)
  mat.polygonOffset = true
  mat.polygonOffsetFactor = -1
  mat.polygonOffsetUnits = -2
  return mat
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

function fbmNoise(x, y, octaves = 4) {
  let sum = 0
  let amp = 0.5
  let freq = 1
  for (let i = 0; i < octaves; i += 1) {
    sum += (seededNoise(x * freq, y * freq) * 2 - 1) * amp
    amp *= 0.5
    freq *= 2.05
  }
  return sum
}

function ridgedNoise(x, y, octaves = 4) {
  let sum = 0
  let amp = 0.5
  let freq = 1
  for (let i = 0; i < octaves; i += 1) {
    const n = 1 - Math.abs(seededNoise(x * freq, y * freq) * 2 - 1)
    sum += n * n * amp
    amp *= 0.5
    freq *= 2.15
  }
  return sum
}

function rockTexture() {
  const texture = paintTerrainCanvas(
    256,
    "#6a6862",
    [
      "rgba(90,88,82,0.55)",
      "rgba(110,108,100,0.45)",
      "rgba(70,72,68,0.5)",
      "rgba(130,125,118,0.35)",
      "rgba(55,58,52,0.4)",
    ],
    50,
    700
  )
  texture.repeat.set(6, 6)
  return texture
}

let sharedRockMap = null
function getRockMap() {
  if (!sharedRockMap) sharedRockMap = rockTexture()
  return sharedRockMap
}

function hexToRgb(hex) {
  return {
    r: ((hex >> 16) & 255) / 255,
    g: ((hex >> 8) & 255) / 255,
    b: (hex & 255) / 255,
  }
}

/** Build a radial heightfield mountain (not a cone) with ridges, foothills, and snow. */
function createMountainGeometry(radius, height, seed, opts = {}) {
  const segments = opts.segments || 96
  const snowLine = opts.snowLine ?? 0.62
  const rock = hexToRgb(opts.color ?? 0x6a7068)
  const grass = hexToRgb(opts.grass ?? 0x4a5e3a)
  const snow = { r: 0.93, g: 0.95, b: 0.97 }
  const crater = opts.crater || 0
  const geo = new THREE.PlaneGeometry(radius * 2.2, radius * 2.2, segments, segments)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const ridgeDir = seededNoise(seed, 0.3) * Math.PI
  const cx = Math.cos(ridgeDir)
  const cz = Math.sin(ridgeDir)

  for (let i = 0; i < pos.count; i += 1) {
    const px = pos.getX(i)
    const pz = pos.getZ(i)
    const nx = px / radius
    const nz = pz / radius
    const dist = Math.hypot(nx, nz)
    let y = 0
    if (dist < 1.08) {
      const fall = Math.pow(Math.max(0, 1 - dist / 1.05), 1.35)
      const ridge = Math.abs(nx * cx + nz * cz)
      const along = -nx * cz + nz * cx
      const spine = Math.exp(-ridge * ridge * 7.5) * (0.55 + 0.45 * (1 - Math.abs(along) * 0.35))
      const detail =
        ridgedNoise(nx * 2.4 + seed, nz * 2.4 + seed * 1.3, 5) * 0.55 +
        fbmNoise(nx * 5.5 + seed * 2.1, nz * 5.5 + seed * 0.7, 3) * 0.22
      // Secondary peaks / foothills
      const foothill =
        Math.exp(-Math.hypot(nx - 0.42, nz + 0.28) * 4.2) * 0.28 +
        Math.exp(-Math.hypot(nx + 0.38, nz - 0.22) * 4.8) * 0.22 +
        Math.exp(-Math.hypot(nx - 0.15, nz - 0.48) * 5.5) * 0.18
      y = height * fall * (0.28 + spine * 0.42 + detail * 0.38 + foothill)
      if (crater > 0 && dist < crater) {
        const t = dist / crater
        y *= 0.35 + t * t * 0.65
        y -= height * 0.08 * (1 - t)
      }
      // Flatten skirt so it meets the ground without a hard cliff edge
      if (dist > 0.88) y *= Math.max(0, 1 - (dist - 0.88) / 0.2)
    }
    pos.setY(i, Math.max(0, y))

    const elev = height > 0 ? y / height : 0
    // Approximate slope from local noise gradient
    const slope =
      Math.abs(fbmNoise(nx * 6 + seed, nz * 6 + seed, 2)) * 0.65 +
      Math.min(1, elev * 1.4) * 0.35
    let cr
    let cg
    let cb
    if (opts.snow && elev > snowLine) {
      const t = Math.min(1, (elev - snowLine) / (1 - snowLine + 0.001))
      const mix = Math.pow(t, 0.7) * (0.55 + slope * 0.45)
      cr = rock.r + (snow.r - rock.r) * mix
      cg = rock.g + (snow.g - rock.g) * mix
      cb = rock.b + (snow.b - rock.b) * mix
    } else if (elev < 0.22 && slope < 0.55) {
      const t = 1 - elev / 0.22
      cr = rock.r + (grass.r - rock.r) * t * 0.85
      cg = rock.g + (grass.g - rock.g) * t * 0.85
      cb = rock.b + (grass.b - rock.b) * t * 0.85
    } else {
      const shade = 0.82 + fbmNoise(nx * 8 + seed, nz * 8, 2) * 0.18
      cr = rock.r * shade
      cg = rock.g * shade
      cb = rock.b * shade
    }
    colors[i * 3] = cr
    colors[i * 3 + 1] = cg
    colors[i * 3 + 2] = cb
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

function addMountain(scene, obstacles, x, z, radius, height, color, snow, extra = {}) {
  const seed = Math.abs(x * 0.013 + z * 0.007) % 100
  const geo = createMountainGeometry(radius, height, seed, {
    color,
    snow,
    snowLine: extra.snowLine ?? (snow ? 0.58 : 1.2),
    grass: extra.grass ?? 0x4a5e3a,
    crater: extra.crater || 0,
    segments: extra.segments || (radius > 600 ? 56 : 40),
  })
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: getRockMap(),
    roughness: 0.94,
    metalness: 0.04,
    envMapIntensity: 0.25,
  })
  // Multiply rock map lightly over vertex colors
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `
      #ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D( map, vMapUv );
        diffuseColor.rgb *= mix(vec3(1.0), sampledDiffuseColor.rgb, 0.45);
      #endif
      `
    )
  }
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, -2, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  scene.add(mesh)

  // Soft debris / talus ring so the base doesn't look cut out of a disk
  if (!extra.noSkirt) {
    const skirt = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.72, radius * 1.15, 48),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(color).lerp(new THREE.Color(extra.grass ?? 0x4a5e3a), 0.35),
        roughness: 1,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    )
    skirt.rotation.x = -Math.PI / 2
    skirt.position.set(x, 0.06, z)
    skirt.receiveShadow = true
    scene.add(skirt)
  }

  obstacles.push({ name: "mountain", type: "cone", x, z, r: radius * 0.78, h: height })
  return mesh
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
        roughness: 0.72,
        metalness: 0.18,
        envMapIntensity: 0.55,
      })
    )
    mesh.position.set(x, h / 2, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
    obstacles.push({ name: "city", type: "cylinder", x, z, r: Math.max(w, d) * 0.45, h })
  }
}

function addAirport(scene, obstacles, ox, oz, label) {
  const asphalt = groundMaterial({ color: 0x343940, roughness: 0.9 })
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(40, 1400), asphalt)
  strip.rotation.x = -Math.PI / 2
  strip.position.set(ox, 0.18, oz + 700)
  strip.receiveShadow = true
  scene.add(strip)
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 280),
    groundMaterial({ color: 0x8e959e, roughness: 0.94 })
  )
  apron.rotation.x = -Math.PI / 2
  apron.position.set(ox - 140, 0.14, oz + 180)
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
  const roadMat = groundMaterial({ color: 0x3a3f45, roughness: 0.96 })
  const roadDashMat = groundMaterial({ color: 0xe8e6df, roughness: 1, metalness: 0 })
  roadDashMat.polygonOffsetFactor = -2
  roadDashMat.polygonOffsetUnits = -4
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
  const oceanMap = oceanNormalTexture()
  const ocean = new THREE.Mesh(
    new THREE.CircleGeometry(WORLD_RADIUS, 64),
    new THREE.MeshStandardMaterial({
      color: 0x0a4a6e,
      roughness: 0.18,
      metalness: 0.35,
      envMapIntensity: 1.15,
      normalMap: oceanMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
    })
  )
  ocean.rotation.x = -Math.PI / 2
  ocean.position.y = -1.6
  ocean.receiveShadow = true
  scene.add(ocean)

  const landDisks = []
  const grassMap = grassTexture()
  const forestMap = forestTexture()
  const sandMap = desertTexture()
  const snowMap = iceTexture()
  for (const [x, z, r, color, label] of CONTINENTS) {
    const isHome = label === "North America"
    const isDesert = label === "Africa" || label === "Australia"
    const isIce = label === "Antarctica" || label === "Greenland"
    const isForest = label === "South America" || label === "Madagascar"
    let map = grassMap
    if (isDesert) map = sandMap
    else if (isIce) map = snowMap
    else if (isForest) map = forestMap
    else if (isHome) map = grassMap
    const mat = groundMaterial({
      // Maps already carry biome color; keep tint near-white so they don't go muddy.
      color: map ? 0xffffff : color,
      map,
      roughness: isIce ? 0.42 : 0.95,
      metalness: isIce ? 0.12 : 0,
      envMapIntensity: isIce ? 0.55 : 0.2,
    })
    mat.polygonOffsetFactor = 1
    mat.polygonOffsetUnits = 1
    const land = new THREE.Mesh(
      new THREE.CircleGeometry(r, Math.max(36, Math.min(96, Math.floor(r / 90)))),
      mat
    )
    land.rotation.x = -Math.PI / 2
    land.position.set(x, 0, z)
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
    groundMaterial({ color: 0xcbb888, roughness: 1, map: sandMap })
  )
  sand.rotation.x = -Math.PI / 2
  sand.position.set(520, 0.12, 500)
  sand.receiveShadow = true
  scene.add(sand)

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 14000),
    new THREE.MeshStandardMaterial({
      color: 0x156a92,
      roughness: 0.16,
      metalness: 0.32,
      envMapIntensity: 1.05,
      normalMap: oceanMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
    })
  )
  water.rotation.x = -Math.PI / 2
  // Starts past the beach so slot airports on land stay dry visually.
  // Fixed height (no bobbing) — vertical motion against the ocean caused flicker.
  water.position.set(8200, -0.85, 500)
  water.receiveShadow = true
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
      groundMaterial({ color: 0xffffff, map: grassMap, roughness: 0.95 })
    )
    plateau.material.polygonOffsetFactor = -1
    plateau.rotation.x = -Math.PI / 2
    plateau.position.set(ox - 80, 0.08, oz + 700)
    plateau.receiveShadow = true
    group.add(plateau)

    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(340, 720),
      groundMaterial({ color: 0x8e959e, roughness: 0.94 })
    )
    apron.rotation.x = -Math.PI / 2
    apron.position.set(ox - 200, 0.16, oz + 320)
    apron.receiveShadow = true
    group.add(apron)

    const taxi = new THREE.Mesh(
      new THREE.PlaneGeometry(150, 22),
      groundMaterial({ color: 0x5f656e, roughness: 0.92 })
    )
    taxi.rotation.x = -Math.PI / 2
    taxi.position.set(ox - 70, 0.2, oz + 200)
    taxi.receiveShadow = true
    group.add(taxi)

    const asphalt = groundMaterial({ color: 0x343940, roughness: 0.9 })
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(48, 2000), asphalt)
    runway.rotation.x = -Math.PI / 2
    runway.position.set(ox, 0.22, oz + 1000)
    runway.receiveShadow = true
    group.add(runway)

    const paint = groundMaterial({ color: 0xeeeae0, roughness: 1, metalness: 0 })
    paint.polygonOffsetFactor = -3
    paint.polygonOffsetUnits = -6
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 1960), paint)
      edge.rotation.x = -Math.PI / 2
      edge.position.set(ox + side * 22, 0.28, oz + 1000)
      group.add(edge)
    }
    for (let z = 50; z < 1960; z += 54) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 26), paint)
      dash.rotation.x = -Math.PI / 2
      dash.position.set(ox, 0.28, oz + z)
      group.add(dash)
    }
    for (const z of [36, 1964]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(40, 8), paint)
      bar.rotation.x = -Math.PI / 2
      bar.position.set(ox, 0.3, oz + z)
      group.add(bar)
    }

    const number = makeSign("36")
    number.rotation.x = -Math.PI / 2
    number.rotation.z = Math.PI
    number.scale.set(0.55, 0.55, 0.55)
    number.position.set(ox, 0.32, oz + 130)
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
  for (let i = 0; i < 24; i += 1) {
    const a0 = (i / 24) * Math.PI * 2
    const a1 = ((i + 1) / 24) * Math.PI * 2
    const x0 = Math.cos(a0) * HIGHWAY_R + HIGHWAY_CX
    const z0 = Math.sin(a0) * HIGHWAY_R + HIGHWAY_CZ
    const x1 = Math.cos(a1) * HIGHWAY_R + HIGHWAY_CX
    const z1 = Math.sin(a1) * HIGHWAY_R + HIGHWAY_CZ
    addRoadSegment(x0, z0, x1, z1, HIGHWAY_WIDTH, scene, 0.04)
  }

  // Seed slot 0 so the hangar has a field before join completes.
  ensureAirport(0, "Turbo")

  // Fast hangar path: nearby trees + a few clouds. Heavy scenery loads in enrich().
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 2.2, 5)
  const leafGeo = new THREE.ConeGeometry(1.6, 4.2, 6)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.95 })
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f5a32, roughness: 0.88 })
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, 280)
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, 280)
  let treeIndex = 0
  for (let z = 0; z < 2000 && treeIndex < 90; z += 40) {
    if (z > 120 && z < 300) continue
    for (const side of [-1, 1]) {
      if (treeIndex >= 90) break
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
  trunks.count = treeIndex
  leaves.count = treeIndex
  trunks.instanceMatrix.needsUpdate = true
  leaves.instanceMatrix.needsUpdate = true
  trunks.castShadow = true
  leaves.castShadow = true
  scene.add(trunks, leaves)

  let volcanoPos = { x: 44500, z: -200 }
  const clouds = []
  const cloudMat = new THREE.MeshLambertMaterial({
    color: 0xe8eef4,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  })
  for (let i = 0; i < 12; i += 1) {
    const puff = new THREE.Group()
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(36, 8, 6), cloudMat)
    mesh.scale.set(1.6, 0.5, 1.2)
    puff.add(mesh)
    const ang = (i / 12) * Math.PI * 2
    puff.position.set(Math.cos(ang) * (900 + i * 140), 1100 + (i % 4) * 160, Math.sin(ang) * (900 + i * 140))
    puff.userData.speed = 4 + (i % 5)
    scene.add(puff)
    clouds.push(puff)
  }

  let enriched = false
  function enrich() {
    if (enriched) return
    enriched = true

    for (const [ox, oz, label] of WORLD_AIRPORTS) {
      addAirport(scene, obstacles, ox, oz, label)
    }

    while (treeIndex < 180) {
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

    const AIRPORT_MOUNTAIN_CLEAR = 3800
    const airportKeepouts = [
      ...WORLD_AIRPORTS.map(([ax, az]) => ({ x: ax, z: az + 700 })),
      ...SLOT_ORIGINS.map((o) => ({ x: o.x, z: o.z + 1000 })),
    ]
    function placeAwayFromAirports(x, z, radius) {
      let px = x
      let pz = z
      for (let pass = 0; pass < 6; pass += 1) {
        let moved = false
        for (const a of airportKeepouts) {
          const need = radius * 1.15 + AIRPORT_MOUNTAIN_CLEAR
          const dx = px - a.x
          const dz = pz - a.z
          const d = Math.hypot(dx, dz)
          if (d >= need) continue
          moved = true
          if (d < 1) { px = a.x + need; pz = a.z }
          else {
            const s = need / d
            px = a.x + dx * s
            pz = a.z + dz * s
          }
        }
        if (!moved) return { x: px, z: pz, ok: true }
      }
      for (const a of airportKeepouts) {
        if (Math.hypot(px - a.x, pz - a.z) < radius * 1.15 + AIRPORT_MOUNTAIN_CLEAR) {
          return { x: px, z: pz, ok: false }
        }
      }
      return { x: px, z: pz, ok: true }
    }

    const peaks = [
      [180, 5200, 720, 780, 0x6a6e68, true],
      [520, 5600, 380, 420, 0x61665f, true],
      [-220, 4900, 320, 360, 0x5e645c, true],
      [-3200, 4800, 580, 600, 0x61685f, true],
      [-18000, -2000, 820, 980, 0x636860, true],
      [-12000, 1000, 580, 680, 0x556054, true],
      [-11000, 21000, 780, 1180, 0x556058, true],
      [-7500, 24000, 680, 1040, 0x4a564e, true],
      [17000, -5500, 520, 780, 0x726a5e, true],
      [18500, -4000, 460, 640, 0x666258, true],
      [6500, 12500, 620, 740, 0x8a7355, false],
      [14000, 14000, 720, 860, 0x927850, false],
      [26500, 2500, 1100, 1680, 0x8a949c, true],
      [32000, 2800, 860, 1480, 0x909aa4, true],
      [24500, 4500, 680, 1180, 0x7a8892, true],
      [37000, 23500, 560, 600, 0x9a6a38, false],
      [0, 42000, 1200, 980, 0xd0dae4, true],
      [4000, 44000, 820, 760, 0xc4d0dc, true],
      [44500, -800, 480, 920, 0x4a3a32, false],
    ]
    for (const [x0, z0, r, h, c, snow] of peaks) {
      const placed = placeAwayFromAirports(x0, z0, r)
      if (!placed.ok) continue
      const arid = !snow && ((c >> 16) & 255) > 120
      addMountain(scene, obstacles, placed.x, placed.z, r, h, c, snow, {
        snowLine: snow ? (h > 1000 ? 0.48 : 0.56) : 1.2,
        grass: arid ? 0x7a6a48 : 0x4a5e3a,
      })
    }

    {
      const fujiR = 520
      const placed = placeAwayFromAirports(volcanoPos.x, volcanoPos.z, fujiR)
      if (placed.ok) {
        volcanoPos = { x: placed.x, z: placed.z }
        addMountain(scene, obstacles, placed.x, placed.z, fujiR, 1100, 0x3a2a22, true, {
          crater: 0.12, snowLine: 0.72, grass: 0x3a4030, segments: 48,
        })
        const lava = new THREE.Mesh(
          new THREE.SphereGeometry(55, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0xff4a12, emissive: 0xff2a00, emissiveIntensity: 0.85, roughness: 0.4 })
        )
        lava.position.set(placed.x, 980, placed.z)
        scene.add(lava)
        obstacles.push({ name: "volcano", type: "cone", x: placed.x, z: placed.z, r: 360, h: 1100 })
        if (api.landmarks?.volcano) {
          api.landmarks.volcano.x = volcanoPos.x
          api.landmarks.volcano.z = volcanoPos.z
        }
      }
    }

    for (const [x, z] of [[10800, -3000], [11200, -2600], [10400, -2500]]) {
      const pyr = new THREE.Mesh(new THREE.ConeGeometry(90, 160, 4), new THREE.MeshStandardMaterial({ color: 0xd4b896, roughness: 1 }))
      pyr.position.set(x, 70, z)
      pyr.rotation.y = Math.PI / 4
      scene.add(pyr)
      obstacles.push({ name: "pyramid", type: "cone", x, z, r: 70, h: 160 })
    }

    const lightTower = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 48, 10), new THREE.MeshStandardMaterial({ color: 0xf2f0ea }))
    lightTower.position.set(560, 24, -40)
    const lightCap = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 6, 10), new THREE.MeshBasicMaterial({ color: 0xffe066 }))
    lightCap.position.set(560, 50, -40)
    scene.add(lightTower, lightCap)
    obstacles.push({ name: "lighthouse", type: "cylinder", x: 560, z: -40, r: 8, h: 52 })

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 900), new THREE.MeshStandardMaterial({ color: 0x6a727c, metalness: 0.35, roughness: 0.55 }))
    bridge.position.set(900, 18, 4200)
    scene.add(bridge)

    const urban = [0x8a929c, 0x6f7882, 0x9aa3ad, 0x7a6e62, 0x5c6570]
    for (const args of [
      [-980, 2500, 16, urban], [400, 2800, 10, urban], [-15000, 1800, 12, urban],
      [-8500, 21000, 10, urban], [14500, -8200, 12, urban], [31000, -5000, 14, urban],
      [39500, -1200, 12, urban], [37000, 21000, 10, [0xd8a878, 0xc09060, 0xa87848]],
      [5000, 8500, 8, urban], [14000, 17500, 8, urban],
    ]) addCity(scene, obstacles, ...args)

    const boatMat = new THREE.MeshStandardMaterial({ color: 0xf7f7f2 })
    for (const spot of [[700, 400], [4000, 2000], [8000, -3000], [15000, 2000], [28000, 6000]]) {
      const boat = new THREE.Mesh(new THREE.BoxGeometry(22, 5, 8), boatMat)
      boat.position.set(spot[0], 1.8, spot[1])
      scene.add(boat)
    }

    for (let i = 0; i < 60; i += 1) {
      const puff = new THREE.Group()
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(32 + (i % 4) * 10, 8, 6), cloudMat)
      mesh.scale.set(1.5, 0.45, 1.1)
      puff.add(mesh)
      const ang = Math.random() * Math.PI * 2
      const rad = 2200 + Math.random() * (WORLD_RADIUS * 0.85)
      puff.position.set(Math.cos(ang) * rad, 900 + Math.random() * 2200, Math.sin(ang) * rad)
      puff.userData.speed = 4 + Math.random() * 8
      scene.add(puff)
      clouds.push(puff)
    }
  }

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
    [0, "#0a1a38"],
    [0.28, "#1a4a7a"],
    [0.52, "#4a86b0"],
    [0.78, "#a8c8dc"],
    [1, "#d8c8a8"],
  ])
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(WORLD_RADIUS * 1.35, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false })
  )
  scene.add(sky)

  const sunBall = new THREE.Mesh(
    new THREE.SphereGeometry(160, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xfff3c8, fog: false, transparent: true, opacity: 0.92 })
  )
  sunBall.position.set(8000, 9000, -4000)
  scene.add(sunBall)

  // Simple moon opposite the sun
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(70, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xd8dee8, fog: false })
  )
  moon.position.set(-10000, 7000, 6000)
  scene.add(moon)

  function update(dt) {
    for (const cloud of clouds) {
      cloud.position.x += cloud.userData.speed * dt
      if (cloud.position.x > WORLD_RADIUS * 0.9) cloud.position.x = -WORLD_RADIUS * 0.9
    }
    // Soft ocean shimmer via normal scroll — no vertical bobbing (that caused flicker).
    const t = performance.now() * 0.00004
    oceanMap.offset.set(t * 0.35, t * 0.22)
  }

  function resetRings() {
    // Rings course removed — kept as a no-op for older call sites.
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
    rings: [],
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
      volcano: { x: volcanoPos.x, y: 900, z: volcanoPos.z },
      pyramids: { x: 10800, y: 80, z: -3000 },
      southPole: { x: 0, y: 40, z: 38000 },
      lighthouse: { x: 560, y: 52, z: -40 },
      bridge: { x: 900, y: 40, z: 4200 },
      city: { x: -980, y: 120, z: 2500 },
    },
    continents: landDisks,
    nearestRegion,
    enrich,
  }
  return api
}
