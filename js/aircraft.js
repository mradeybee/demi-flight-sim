import * as THREE from "three"
import { hasRealModel, prepareRealModel } from "./models.js"
import { buildGearKitGroup } from "./gearKits.js"
import { applyDemiAirline } from "./airline.js"
import { applyTypeLook } from "./looks.js"
import { COCKPIT_BUTTONS } from "./cockpitButtons.js"

const PROFILES = {
  // Blunter GA nose (not a needle).
  light: [[0.12, 0], [0.55, 0.05], [0.92, 0.16], [1, 0.38], [1, 0.72], [0.78, 0.88], [0.4, 0.96], [0.1, 1]],
  aerobat: [[0.08, 0], [0.5, 0.08], [0.95, 0.28], [1, 0.52], [0.82, 0.78], [0.32, 0.94], [0.06, 1]],
  twin: [[0.14, 0], [0.55, 0.06], [0.95, 0.2], [1, 0.42], [1, 0.74], [0.65, 0.9], [0.22, 1]],
  // Airliner: rounded nose, long parallel tube, tapered tail.
  tube: [[0.22, 0], [0.7, 0.04], [0.95, 0.1], [1, 0.2], [1, 0.78], [0.78, 0.9], [0.35, 0.97], [0.1, 1]],
  jumbo: [[0.28, 0], [0.75, 0.04], [0.96, 0.1], [1, 0.22], [1, 0.8], [0.82, 0.91], [0.4, 0.97], [0.12, 1]],
  // MD-11: sharper Douglas nose, long constant section, clean taper into the #3/T-tail.
  md11: [[0.14, 0], [0.48, 0.035], [0.82, 0.07], [0.96, 0.12], [1, 0.2], [1, 0.78], [0.88, 0.88], [0.55, 0.94], [0.22, 0.98], [0.06, 1]],
  biz: [[0.18, 0], [0.6, 0.05], [0.92, 0.16], [1, 0.38], [0.95, 0.72], [0.55, 0.9], [0.14, 1]],
  warbird: [[0.1, 0], [0.4, 0.05], [0.75, 0.16], [1, 0.38], [1, 0.62], [0.72, 0.82], [0.3, 0.94], [0.06, 1]],
  fighter: [[0.08, 0], [0.35, 0.06], [0.7, 0.22], [0.95, 0.45], [1, 0.65], [0.55, 0.84], [0.18, 0.95], [0.02, 1]],
  herc: [[0.22, 0], [0.8, 0.05], [1, 0.14], [1, 0.86], [0.75, 0.95], [0.32, 1]],
  // Gradual forward taper; droop tip continues from ~0.7×radius down to a point.
  concorde: [[0.7, 0], [0.88, 0.05], [1, 0.12], [1, 0.5], [0.97, 0.75], [0.78, 0.88], [0.42, 0.95], [0.16, 1]],
}

function makePart(group, apply, { delay = 0, lambda = 4, start = 0 } = {}) {
  return { group, apply, delay, lambda, t: start, dest: start, wait: 0 }
}

function canvasTexture(draw, w, h) {
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  draw(canvas.getContext("2d"), w, h)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function camoTexture(colors) {
  return canvasTexture((ctx, w, h) => {
    ctx.fillStyle = colors[0]
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 18; i += 1) {
      ctx.fillStyle = colors[i % 2 ? 1 : 2]
      ctx.beginPath()
      ctx.ellipse(Math.random() * w, Math.random() * h, 30 + Math.random() * 50, 16 + Math.random() * 24, Math.random() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }, 256, 256)
}

function checkerTexture() {
  const texture = canvasTexture((ctx, w, h) => {
    const size = 32
    for (let y = 0; y < h; y += size) {
      for (let x = 0; x < w; x += size) {
        ctx.fillStyle = (x / size + y / size) % 2 ? "#f4f4f4" : "#e10600"
        ctx.fillRect(x, y, size, size)
      }
    }
  }, 256, 256)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

function labelTexture(text, color) {
  return canvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = color
    ctx.font = "700 92px Arial"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(text, w / 2, h / 2)
  }, 512, 256)
}

function decalTexture(kind) {
  return canvasTexture((ctx, w, h) => {
    const c = w / 2
    if (kind === "raf") {
      ctx.fillStyle = "#1d4e89"
      ctx.beginPath()
      ctx.arc(c, c, 60, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = "#f4f4f4"
      ctx.beginPath()
      ctx.arc(c, c, 40, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = "#c1121f"
      ctx.beginPath()
      ctx.arc(c, c, 18, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    ctx.fillStyle = "#1d4e89"
    ctx.beginPath()
    ctx.arc(c, c, 60, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#f7f7f2"
    ctx.beginPath()
    for (let i = 0; i < 5; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / 5
      const next = angle + Math.PI / 5
      const rOut = 36
      const rIn = 16
      ctx.lineTo(c + Math.cos(angle) * rOut, c + Math.sin(angle) * rOut)
      ctx.lineTo(c + Math.cos(next) * rIn, c + Math.sin(next) * rIn)
    }
    ctx.closePath()
    ctx.fill()
  }, 128, 128)
}

function liveryTexture(def) {
  const fedex = def.brand === "fedex" || def.lockedLivery === "fedex"
  return canvasTexture((ctx, w, h) => {
    const body = fedex ? "#f4f1fa" : (def.body || "#f4f8fb")
    const accent = fedex ? "#4D148C" : (def.accent || "#1d4e89")
    const orange = fedex ? "#FF6600" : (def.accent2 || accent)
    ctx.fillStyle = body
    ctx.fillRect(0, 0, w, h)
    const shade = ctx.createLinearGradient(0, 0, 0, h)
    shade.addColorStop(0, "rgba(255,255,255,0.22)")
    shade.addColorStop(0.45, "rgba(255,255,255,0)")
    shade.addColorStop(1, "rgba(0,0,0,0.12)")
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, w, h)
    if (fedex) {
      // Classic Express freighter: white upper, grey belly, purple/orange titles.
      ctx.fillStyle = "#f7f7f5"
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = "#6a6e74"
      ctx.fillRect(0, h * 0.58, w, h * 0.42)
      const shade = ctx.createLinearGradient(0, 0, 0, h)
      shade.addColorStop(0, "rgba(255,255,255,0.2)")
      shade.addColorStop(0.5, "rgba(255,255,255,0)")
      shade.addColorStop(1, "rgba(0,0,0,0.1)")
      ctx.fillStyle = shade
      ctx.fillRect(0, 0, w, h)
      // Thin purple cheatline
      ctx.fillStyle = accent
      ctx.fillRect(0, h * 0.545, w, h * 0.018)
      ctx.fillStyle = orange
      ctx.fillRect(0, h * 0.562, w, h * 0.01)
      ctx.textAlign = "left"
      ctx.textBaseline = "middle"
      const logoSize = Math.floor(h * 0.12)
      ctx.font = `900 ${logoSize}px Arial Black, Impact, sans-serif`
      const fedW = ctx.measureText("Fed").width
      ctx.fillStyle = accent
      ctx.fillText("Fed", w * 0.22, h * 0.4)
      ctx.fillStyle = orange
      ctx.fillText("Ex", w * 0.22 + fedW, h * 0.4)
      ctx.fillStyle = accent
      ctx.font = `700 ${Math.floor(h * 0.04)}px Arial, sans-serif`
      ctx.fillText("Express", w * 0.22, h * 0.5)
      ctx.font = `bold ${Math.floor(h * 0.045)}px sans-serif`
      ctx.fillText(def.number || "N601FE", w * 0.7, h * 0.78)
      for (let i = 0; i < 4; i += 1) {
        const x = w * 0.1 + i * w * 0.035
        ctx.fillStyle = "rgba(20, 36, 58, 0.88)"
        ctx.fillRect(x, h * 0.3, w * 0.022, h * 0.04)
      }
      return
    }
    ctx.fillStyle = accent
    ctx.globalAlpha = 0.92
    ctx.fillRect(0, h * 0.42, w, h * 0.08)
    ctx.globalAlpha = 0.35
    ctx.fillRect(0, h * 0.5, w, h * 0.035)
    ctx.globalAlpha = 1
    const winH = h * 0.055
    const winW = w * 0.045
    const y = h * 0.34
    for (let i = 0; i < 18; i += 1) {
      const x = w * 0.08 + i * (winW + w * 0.012)
      ctx.fillStyle = "rgba(20, 36, 58, 0.88)"
      ctx.fillRect(x, y, winW, winH)
      ctx.fillStyle = "rgba(170, 210, 240, 0.35)"
      ctx.fillRect(x + 1, y + 1, winW * 0.45, winH * 0.4)
    }
    ctx.fillStyle = accent
    ctx.font = `bold ${Math.floor(h * 0.07)}px sans-serif`
    ctx.fillText(def.number || "TF-001", w * 0.62, h * 0.78)
  }, 512, 512)
}

function makeMaterials(def) {
  const camo = def.camo ? camoTexture(def.camo) : null
  const livery = !camo && ["tube", "jumbo", "biz", "herc", "concorde", "twin"].includes(def.profile)
    ? liveryTexture(def)
    : null
  const map = camo || livery
  const metal = def.metal ?? (def.profile === "fighter" || def.profile === "concorde" ? 0.62 : 0.42)
  const rough = def.rough ?? (camo ? 0.55 : 0.28)
  const paint = new THREE.MeshPhysicalMaterial({
    color: map ? 0xffffff : new THREE.Color(def.body),
    map,
    metalness: metal,
    roughness: rough,
    clearcoat: camo ? 0.18 : 0.72,
    clearcoatRoughness: camo ? 0.4 : 0.16,
    envMapIntensity: 1.35,
    sheen: 0.15,
    sheenRoughness: 0.4,
    sheenColor: new THREE.Color("#dce9f8"),
  })
  const wing = paint.clone()
  wing.side = THREE.DoubleSide
  if (def.checker) {
    wing.map = checkerTexture()
    wing.color.set("#ffffff")
    wing.clearcoat = 0.45
  }
  const accent2Hex = def.accent2 || def.accent
  return {
    paint,
    wing,
    accent: new THREE.MeshPhysicalMaterial({
      color: def.accent,
      metalness: 0.45,
      roughness: 0.32,
      clearcoat: 0.55,
      clearcoatRoughness: 0.22,
      envMapIntensity: 1.2,
      side: THREE.DoubleSide,
    }),
    accent2: new THREE.MeshPhysicalMaterial({
      name: "fedex-orange",
      color: accent2Hex,
      metalness: 0.5,
      roughness: 0.28,
      clearcoat: 0.65,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.35,
      emissive: new THREE.Color(accent2Hex),
      emissiveIntensity: 0,
      side: THREE.DoubleSide,
    }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a1d22, metalness: 0.55, roughness: 0.45, envMapIntensity: 1 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x8eb8d8,
      metalness: 0.1,
      roughness: 0.02,
      transmission: 0.72,
      transparent: true,
      opacity: 0.42,
      thickness: 0.45,
      side: THREE.DoubleSide,
      envMapIntensity: 1.6,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92 }),
    interior: new THREE.MeshStandardMaterial({ color: 0x101216, roughness: 0.85 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9aa3ac, metalness: 0.92, roughness: 0.22, envMapIntensity: 1.4 }),
  }
}

function fuselageGeometry(def, length) {
  const shape = (def.id === "md11" ? PROFILES.md11 : null) || PROFILES[def.profile] || PROFILES.light
  const segs = def.id === "b747" || def.id === "md11" ? 72 : 48
  const points = shape.map(([radius, t]) => new THREE.Vector2(Math.max(0.02, radius * def.radius), t * length))
  const geometry = new THREE.LatheGeometry(points, segs)
  geometry.translate(0, -length / 2, 0)
  geometry.rotateX(Math.PI / 2)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Engine-fire FX streaming aft from the nozzle (−Z), same facing as jet thrust cones.
 * Cone tip → aft; base sits at the exhaust. Layered hot core + cooler envelope + smoke.
 */
function makeEngineFire(r) {
  const group = new THREE.Group()
  group.visible = false
  group.userData.engineFire = true
  const layers = []

  // Point cone tip aft (−Z): rotX(π/2) maps local +Y → −Z (matches thrust flame).
  const aimAft = Math.PI / 2

  const jets = [
    // Cool outer envelope
    { color: 0xff1a00, op: 0.55, rad: 0.95, len: 3.6, y: 0.08, lift: 0.12 },
    // Mid orange
    { color: 0xff6a00, op: 0.78, rad: 0.62, len: 3.1, y: 0.12, lift: 0.18 },
    // Hot yellow
    { color: 0xffc233, op: 0.9, rad: 0.36, len: 2.45, y: 0.16, lift: 0.22 },
    // White-hot core
    { color: 0xfff6c8, op: 0.95, rad: 0.16, len: 1.7, y: 0.18, lift: 0.25 },
  ]
  for (const spec of jets) {
    const mat = new THREE.MeshBasicMaterial({
      color: spec.color,
      transparent: true,
      opacity: spec.op,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    mat.userData.baseOp = spec.op
    const len = r * spec.len
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(r * spec.rad, len, 10, 1, true), mat)
    mesh.rotation.x = aimAft
    // Base at nozzle (z≈0), tip trails aft. Slight lift so flame rides above the nacelle line.
    mesh.position.set(0, r * spec.y, -len * 0.5)
    group.add(mesh)
    layers.push({
      mesh,
      mat,
      baseX: 0,
      baseY: mesh.position.y,
      baseZ: mesh.position.z,
      lift: spec.lift,
      kind: "jet",
    })
  }

  // Side tongues — still mostly aft, with a little yaw so the blaze reads wider.
  for (const side of [-1, 1]) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff3d00,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    mat.userData.baseOp = 0.5
    const len = r * 2.2
    const lick = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32, len, 7, 1, true), mat)
    lick.rotation.x = aimAft
    lick.rotation.z = side * 0.28
    lick.rotation.y = side * 0.22
    lick.position.set(side * r * 0.28, r * 0.22, -len * 0.45)
    group.add(lick)
    layers.push({
      mesh: lick,
      mat,
      baseX: lick.position.x,
      baseY: lick.position.y,
      baseZ: lick.position.z,
      lift: 0.15,
      kind: "lick",
    })
  }

  // Upward lick near the nozzle (buoyancy), still rooted at the exhaust.
  {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
    mat.userData.baseOp = 0.48
    const len = r * 1.8
    const up = new THREE.Mesh(new THREE.ConeGeometry(r * 0.38, len, 7, 1, true), mat)
    // Tip mostly up, slight aft lean.
    up.rotation.x = aimAft * 0.35
    up.position.set(0, r * 0.35 + len * 0.25, -r * 0.35)
    group.add(up)
    layers.push({
      mesh: up,
      mat,
      baseX: 0,
      baseY: up.position.y,
      baseZ: up.position.z,
      lift: 0.35,
      kind: "up",
    })
  }

  // Smoke streaming aft and rising behind the fire.
  for (let i = 0; i < 4; i += 1) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x1a1410,
      transparent: true,
      opacity: 0.32 - i * 0.04,
      depthWrite: false,
    })
    mat.userData.baseOp = 0.32 - i * 0.04
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r * (0.4 + i * 0.18), 8, 8), mat)
    puff.position.set(
      (i % 2 === 0 ? -1 : 1) * r * 0.15 * (i + 1) * 0.35,
      r * (0.55 + i * 0.4),
      -r * (1.6 + i * 0.85)
    )
    group.add(puff)
    layers.push({
      mesh: puff,
      mat,
      baseX: puff.position.x,
      baseY: puff.position.y,
      baseZ: puff.position.z,
      lift: 0.5,
      kind: "smoke",
    })
  }

  const light = new THREE.PointLight(0xff4a18, 0, r * 18, 2)
  light.position.set(0, r * 0.35, -r * 0.9)
  group.add(light)
  return { group, layers, light }
}

/** Realistic FedEx Express titles — purple “Fed” + orange “Ex”, registration, fin mark. */
function addFedexMd11Brand(root, def, mats) {
  const brand = new THREE.Group()
  brand.name = "fedexBrand"
  const purple = mats.accent.clone()
  purple.name = "fedex-purple"
  const orange = (mats.accent2 || mats.accent).clone()
  orange.name = "fedex-orange"
  orange.emissiveIntensity = 0

  const titleTex = canvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    const size = Math.floor(h * 0.55)
    ctx.font = `900 ${size}px Arial Black, Impact, sans-serif`
    const fed = "Fed"
    const ex = "Ex"
    const fedW = ctx.measureText(fed).width
    const total = fedW + ctx.measureText(ex).width
    const x0 = (w - total) / 2
    ctx.fillStyle = "#4D148C"
    ctx.fillText(fed, x0, h * 0.42)
    ctx.fillStyle = "#FF6600"
    ctx.fillText(ex, x0 + fedW, h * 0.42)
    ctx.fillStyle = "#4D148C"
    ctx.font = `700 ${Math.floor(h * 0.16)}px Arial, sans-serif`
    ctx.textAlign = "center"
    ctx.fillText("Express", w * 0.5, h * 0.82)
  }, 1024, 256)
  titleTex.colorSpace = THREE.SRGBColorSpace

  const titleW = def.length * 0.22
  const titleH = def.radius * 0.42
  for (const side of [-1, 1]) {
    const title = new THREE.Mesh(
      new THREE.PlaneGeometry(titleW, titleH),
      new THREE.MeshBasicMaterial({
        map: titleTex,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    )
    title.position.set(side * (def.radius + 0.05), def.radius * 0.08, -def.length * 0.06)
    title.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2
    brand.add(title)
  }

  // Tail registration
  const regTex = labelTexture(def.number || "N601FE", "#4D148C")
  for (const side of [-1, 1]) {
    const reg = new THREE.Mesh(
      new THREE.PlaneGeometry(def.length * 0.08, def.radius * 0.18),
      new THREE.MeshBasicMaterial({ map: regTex, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    )
    reg.position.set(side * (def.radius + 0.04), -def.radius * 0.15, -def.length * 0.32)
    reg.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2
    brand.add(reg)
  }

  // Fin FedEx flash
  const finTex = canvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.font = `900 ${Math.floor(h * 0.42)}px Arial Black, Impact, sans-serif`
    const fedW = ctx.measureText("Fed").width
    const x0 = w * 0.5 - (fedW + ctx.measureText("Ex").width) / 2
    ctx.textAlign = "left"
    ctx.fillStyle = "#4D148C"
    ctx.fillText("Fed", x0, h * 0.52)
    ctx.fillStyle = "#FF6600"
    ctx.fillText("Ex", x0 + fedW, h * 0.52)
  }, 512, 256)
  finTex.colorSpace = THREE.SRGBColorSpace
  const finMark = new THREE.Mesh(
    new THREE.PlaneGeometry(def.length * 0.09, def.length * 0.045),
    new THREE.MeshBasicMaterial({ map: finTex, transparent: true, depthWrite: false, side: THREE.DoubleSide })
  )
  finMark.rotation.y = Math.PI / 2
  finMark.position.set(0.12, def.radius * 0.55 + def.length * 0.12, -def.length * 0.4)
  brand.add(finMark)

  root.add(brand)
  return brand
}

/**
 * MD-11 freighter airframe details: cockpit panes, wing-body fairing, main-deck
 * cargo door, belly holds, #3 inlet trunk into the T-tail, radome, antennas.
 */
function addMd11Airframe(skin, def, mats) {
  const R = def.radius
  const L = def.length

  // Sharper Douglas radome
  const radome = new THREE.Mesh(new THREE.SphereGeometry(R * 0.92, 28, 20), mats.paint)
  radome.scale.set(0.88, 0.82, 1.35)
  radome.position.set(0, R * 0.02, L * 0.44)
  radome.castShadow = true
  skin.add(radome)

  // Multi-pane cockpit windshield (flat-ish MD-11 look)
  const glassY = R * 0.42
  const glassZ = L * 0.34
  const panes = [
    { x: 0, y: glassY + 0.08, z: glassZ + 0.35, w: R * 0.7, h: R * 0.28, yaw: 0, pitch: -0.35 },
    { x: -R * 0.55, y: glassY, z: glassZ + 0.15, w: R * 0.55, h: R * 0.32, yaw: -0.55, pitch: -0.2 },
    { x: R * 0.55, y: glassY, z: glassZ + 0.15, w: R * 0.55, h: R * 0.32, yaw: 0.55, pitch: -0.2 },
    { x: -R * 0.72, y: glassY - 0.05, z: glassZ - 0.05, w: R * 0.38, h: R * 0.28, yaw: -0.95, pitch: -0.08 },
    { x: R * 0.72, y: glassY - 0.05, z: glassZ - 0.05, w: R * 0.38, h: R * 0.28, yaw: 0.95, pitch: -0.08 },
  ]
  for (const p of panes) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.05, p.h, p.w), mats.glass)
    pane.position.set(p.x, p.y, p.z)
    pane.rotation.y = p.yaw
    pane.rotation.x = p.pitch
    skin.add(pane)
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.04, p.h * 1.08, p.w * 1.08), mats.dark)
    frame.position.copy(pane.position)
    frame.rotation.copy(pane.rotation)
    skin.add(frame)
  }
  const brow = new THREE.Mesh(
    new THREE.BoxGeometry(R * 1.65, R * 0.08, R * 0.55),
    mats.dark
  )
  brow.position.set(0, R * 0.62, L * 0.32)
  brow.rotation.x = -0.25
  skin.add(brow)

  // Crew windows only (freighter)
  for (let i = 0; i < 5; i += 1) {
    const z = L * 0.22 - i * 0.55
    for (const side of [-1, 1]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.38, 0.48), mats.dark)
      frame.position.set(side * (R + 0.01), R * 0.28, z)
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.38), mats.glass)
      win.position.set(side * (R + 0.03), R * 0.28, z)
      skin.add(frame, win)
    }
  }

  // Wing–body fairing / keel
  const keel = new THREE.Mesh(new THREE.SphereGeometry(R * 1.05, 24, 16), mats.paint)
  keel.scale.set(0.62, 0.42, 3.1)
  keel.position.set(0, -R * 0.58, def.wing.z + 0.4)
  keel.castShadow = true
  skin.add(keel)

  // Grey belly panel (classic freighter two-tone)
  const bellyMat = mats.dark.clone()
  bellyMat.color.set("#6a6e74")
  bellyMat.metalness = 0.35
  bellyMat.roughness = 0.55
  const belly = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.98, R * 0.98, L * 0.55, 32, 1, true, Math.PI * 0.15, Math.PI * 0.7),
    bellyMat
  )
  belly.rotation.z = Math.PI / 2
  belly.rotation.y = Math.PI / 2
  belly.position.set(0, -R * 0.15, -L * 0.02)
  skin.add(belly)

  // Port main-deck cargo door (forward of wing)
  const doorZ = L * 0.08
  const doorH = R * 1.35
  const doorW = L * 0.11
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.05, doorH, doorW), mats.dark)
  doorFrame.position.set(-(R + 0.02), R * 0.05, doorZ)
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.04, doorH * 0.92, doorW * 0.9), mats.paint)
  doorPanel.position.set(-(R + 0.05), R * 0.05, doorZ)
  // Door hinge rail + latch strip
  const hingeRail = new THREE.Mesh(new THREE.BoxGeometry(0.06, doorH * 0.95, 0.08), mats.metal)
  hingeRail.position.set(-(R + 0.06), R * 0.05, doorZ + doorW * 0.42)
  skin.add(doorFrame, doorPanel, hingeRail)
  for (let i = 0; i < 3; i += 1) {
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.12), mats.metal)
    latch.position.set(-(R + 0.07), -doorH * 0.3 + i * doorH * 0.3, doorZ - doorW * 0.35)
    skin.add(latch)
  }

  // Belly cargo doors
  for (const z of [-L * 0.08, L * 0.12]) {
    const hold = new THREE.Mesh(
      new THREE.BoxGeometry(R * 1.1, 0.06, L * 0.1),
      mats.dark
    )
    hold.position.set(0, -R * 0.95, z)
    skin.add(hold)
  }

  // #3 engine inlet trunk — the MD-11 signature scoop into the fin root
  const trunk = new THREE.Group()
  trunk.position.set(0, R * 0.78, -L * 0.34)
  const scoop = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.38, R * 0.52, R * 2.8, 22),
    mats.paint
  )
  scoop.rotation.x = Math.PI / 2
  scoop.position.set(0, R * 0.12, -R * 0.35)
  scoop.castShadow = true
  const scoopLip = new THREE.Mesh(new THREE.TorusGeometry(R * 0.46, R * 0.055, 10, 24), mats.metal)
  scoopLip.position.set(0, R * 0.12, R * 1.0)
  const scoopDark = new THREE.Mesh(new THREE.CircleGeometry(R * 0.38, 22), mats.dark)
  scoopDark.position.set(0, R * 0.12, R * 0.95)
  // S-duct belly panel under the scoop
  const duct = new THREE.Mesh(new THREE.BoxGeometry(R * 0.85, R * 0.35, R * 1.8), mats.paint)
  duct.position.set(0, -R * 0.05, -R * 0.15)
  duct.castShadow = true
  // Blended cheek fairings into fin
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(R * 0.5, 14, 12), mats.paint)
    cheek.scale.set(0.5, 0.9, 1.55)
    cheek.position.set(side * R * 0.32, R * 0.4, -R * 0.55)
    cheek.castShadow = true
    trunk.add(cheek)
  }
  trunk.add(scoop, scoopLip, scoopDark, duct)
  skin.add(trunk)

  // APU exhaust on tail cone
  const apu = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.1, R * 0.14, R * 0.45, 12), mats.dark)
  apu.rotation.x = Math.PI / 2
  apu.position.set(R * 0.25, -R * 0.05, -L * 0.47)
  skin.add(apu)

  // Satcom / antenna farm
  const sat = new THREE.Mesh(new THREE.SphereGeometry(R * 0.16, 12, 10), mats.paint)
  sat.scale.set(1.2, 0.4, 1.5)
  sat.position.set(0, R * 1.02, L * 0.05)
  skin.add(sat)
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, R * 0.45, 6), mats.dark)
  ant.position.set(0, R * 1.15, -L * 0.05)
  skin.add(ant)

  // Subtle panel seams
  for (let i = 0; i < 7; i += 1) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(R * 1.98, 0.01, 0.018), mats.dark)
    seam.position.set(0, R * 0.15, -L * 0.28 + i * L * 0.09)
    skin.add(seam)
  }
}

/** MD-11 wing turbofan — long high-bypass cowling, thick intake lip, short pylon. */
function makeMd11Turbofan(engine, mats) {
  const mount = new THREE.Group()
  const r = engine.r
  const cowling = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 1.02, r * 0.86, r * 4.0, 28),
    mats.paint
  )
  cowling.rotation.x = Math.PI / 2
  cowling.castShadow = true
  const lip = new THREE.Mesh(new THREE.TorusGeometry(r * 0.94, r * 0.09, 12, 28), mats.metal)
  lip.position.z = r * 1.95
  const intake = new THREE.Mesh(new THREE.CircleGeometry(r * 0.88, 28), mats.dark)
  intake.position.z = r * 1.9
  const fan = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.84, r * 0.84, r * 0.1, 24),
    new THREE.MeshStandardMaterial({ color: 0xb8c0c8, metalness: 0.85, roughness: 0.25 })
  )
  fan.rotation.x = Math.PI / 2
  fan.position.z = r * 1.55
  const spinner = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 12, 10), mats.metal)
  spinner.scale.set(1, 1, 1.4)
  spinner.position.z = r * 1.65
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.4, r * 0.48, r * 1.6, 18),
    mats.metal
  )
  core.rotation.x = Math.PI / 2
  core.position.z = -r * 0.35
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.36, r * 0.5, r * 0.85, 18),
    mats.dark
  )
  nozzle.rotation.x = Math.PI / 2
  nozzle.position.z = -r * 1.85
  const mixer = new THREE.Mesh(new THREE.TorusGeometry(r * 0.42, r * 0.04, 8, 18), mats.metal)
  mixer.position.z = -r * 1.55
  mount.add(cowling, lip, intake, fan, spinner, core, nozzle, mixer)
  if (engine.pylon) {
    const pylonH = Math.max(0.55, Math.abs(engine.y) * 0.42 + r * 0.55)
    const pylon = new THREE.Mesh(
      new THREE.BoxGeometry(r * 0.32, pylonH, r * 2.2),
      mats.paint
    )
    pylon.position.set(0, pylonH * 0.42 + r * 0.15, r * 0.1)
    pylon.castShadow = true
    const fillet = new THREE.Mesh(new THREE.BoxGeometry(r * 0.55, r * 0.22, r * 1.6), mats.paint)
    fillet.position.set(0, Math.abs(engine.y) * 0.08 + r * 0.55, r * 0.15)
    mount.add(pylon, fillet)
  }
  return mount
}

/** #3 T-tail engine — short nacelle nestled in the fin root, aft of the inlet trunk. */
function makeMd11TailEngine(engine, mats) {
  const mount = new THREE.Group()
  const r = engine.r
  const nacelle = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.95, r * 0.78, r * 3.2, 24),
    mats.paint
  )
  nacelle.rotation.x = Math.PI / 2
  nacelle.castShadow = true
  const intake = new THREE.Mesh(new THREE.CircleGeometry(r * 0.7, 22), mats.dark)
  intake.position.z = r * 1.55
  const lip = new THREE.Mesh(new THREE.TorusGeometry(r * 0.75, r * 0.06, 10, 22), mats.metal)
  lip.position.z = r * 1.45
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.32, r * 0.4, r * 0.7, 14),
    mats.metal
  )
  core.rotation.x = Math.PI / 2
  core.position.z = -r * 1.35
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.3, r * 0.42, r * 0.55, 14),
    mats.dark
  )
  nozzle.rotation.x = Math.PI / 2
  nozzle.position.z = -r * 1.75
  // Vertical fin fillet so #3 reads as built into the tail
  const fillet = new THREE.Mesh(new THREE.BoxGeometry(r * 0.35, r * 1.4, r * 2.2), mats.paint)
  fillet.position.set(0, r * 0.55, -r * 0.2)
  fillet.castShadow = true
  mount.add(nacelle, intake, lip, core, nozzle, fillet)
  return mount
}

/** High-bypass turbofan nacelle for the Queen — intake lip, fan face, core, nozzle. */
function makeQueenTurbofan(engine, mats) {
  const mount = new THREE.Group()
  const r = engine.r
  const cowling = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 1.02, r * 0.88, r * 4.2, 28),
    mats.paint
  )
  cowling.rotation.x = Math.PI / 2
  cowling.castShadow = true
  cowling.receiveShadow = true
  const lip = new THREE.Mesh(new THREE.TorusGeometry(r * 0.92, r * 0.1, 12, 28), mats.metal)
  lip.position.z = r * 2.05
  const intake = new THREE.Mesh(new THREE.CircleGeometry(r * 0.86, 28), mats.dark)
  intake.position.z = r * 2.0
  // Spinning fan disk
  const fan = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.82, r * 0.82, r * 0.12, 24),
    new THREE.MeshStandardMaterial({ color: 0xb8c0c8, metalness: 0.85, roughness: 0.25 })
  )
  fan.rotation.x = Math.PI / 2
  fan.position.z = r * 1.55
  fan.castShadow = true
  const spinner = new THREE.Mesh(new THREE.SphereGeometry(r * 0.28, 16, 12), mats.metal)
  spinner.scale.set(1, 1, 1.35)
  spinner.position.z = r * 1.72
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.42, r * 0.48, r * 1.8, 18),
    mats.metal
  )
  core.rotation.x = Math.PI / 2
  core.position.z = -r * 0.35
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.38, r * 0.52, r * 0.9, 18),
    mats.metal
  )
  nozzle.rotation.x = Math.PI / 2
  nozzle.position.z = -r * 1.85
  const mixer = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.55, r * 0.62, r * 0.35, 16),
    mats.dark
  )
  mixer.rotation.x = Math.PI / 2
  mixer.position.z = -r * 1.45
  mount.add(cowling, lip, intake, fan, spinner, core, nozzle, mixer)
  if (engine.pylon) {
    const pylon = new THREE.Mesh(
      new THREE.BoxGeometry(r * 0.28, Math.max(0.55, Math.abs(engine.y) * 0.45 + r * 0.55), r * 2.1),
      mats.paint
    )
    pylon.position.set(0, Math.abs(engine.y) * 0.28 + r * 0.2, r * 0.15)
    pylon.castShadow = true
    const fillet = new THREE.Mesh(
      new THREE.BoxGeometry(r * 0.5, r * 0.22, r * 1.4),
      mats.paint
    )
    fillet.position.set(0, Math.abs(engine.y) * 0.12 + r * 0.55, r * 0.2)
    mount.add(pylon, fillet)
  }
  return mount
}

/**
 * Iconic 747 forward upper deck + fairing + dual window belts.
 * Call after the base fuselage so the Queen never reads as a plain tube or A380.
 */
function addQueen747Airframe(skin, def, mats) {
  const R = def.radius
  const L = def.length
  // Upper deck capsule (classic hump) — longer & flatter than a simple sphere.
  const deckPts = [
    [0.15, 0],
    [0.55, 0.04],
    [0.92, 0.12],
    [1, 0.28],
    [1, 0.72],
    [0.75, 0.9],
    [0.28, 0.98],
    [0.05, 1],
  ].map(([r, t]) => new THREE.Vector2(Math.max(0.04, r * R * 0.72), t * L * 0.34))
  const deckGeo = new THREE.LatheGeometry(deckPts, 56)
  deckGeo.translate(0, -L * 0.17, 0)
  deckGeo.rotateX(Math.PI / 2)
  deckGeo.computeVertexNormals()
  const deck = new THREE.Mesh(deckGeo, mats.paint)
  deck.position.set(0, R * 0.78, L * 0.2)
  deck.castShadow = true
  deck.receiveShadow = true
  skin.add(deck)

  // Smooth blend from hump into main tube
  const blend = new THREE.Mesh(new THREE.SphereGeometry(R * 0.62, 24, 18), mats.paint)
  blend.scale.set(0.95, 0.42, 1.55)
  blend.position.set(0, R * 0.58, L * 0.02)
  blend.castShadow = true
  skin.add(blend)

  // Upper-deck cockpit glass
  const upperGlass = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.55, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.45),
    mats.glass
  )
  upperGlass.scale.set(0.95, 0.55, 1.05)
  upperGlass.position.set(0, R * 1.05, L * 0.32)
  skin.add(upperGlass)

  // Dual window belts (main deck + upper deck)
  const addWindows = (y, z0, z1, count, w, h) => {
    for (let i = 0; i < count; i += 1) {
      const z = z0 + (i / Math.max(1, count - 1)) * (z1 - z0)
      for (const side of [-1, 1]) {
        const pane = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, w), mats.glass)
        pane.position.set(side * (R + 0.02), y, z)
        skin.add(pane)
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.03, h * 1.15, w * 1.2), mats.dark)
        frame.position.set(side * (R + 0.01), y, z)
        skin.add(frame)
      }
    }
  }
  addWindows(R * 0.22, -L * 0.28, L * 0.22, 28, 0.38, 0.42)
  addWindows(R * 0.95, L * 0.06, L * 0.3, 10, 0.32, 0.34)

  // Wing–body belly fairing (747 “keel”)
  const keel = new THREE.Mesh(new THREE.SphereGeometry(R * 0.95, 20, 14), mats.paint)
  keel.scale.set(0.55, 0.38, 2.8)
  keel.position.set(0, -R * 0.55, def.wing.z)
  keel.castShadow = true
  skin.add(keel)

  // Nose radome seam
  const radome = new THREE.Mesh(new THREE.SphereGeometry(R * 0.95, 20, 14), mats.paint)
  radome.scale.set(0.92, 0.88, 1.15)
  radome.position.set(0, R * 0.05, L * 0.42)
  skin.add(radome)

  // APU exhaust at tail cone
  const apu = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.12, R * 0.16, R * 0.5, 12), mats.dark)
  apu.rotation.x = Math.PI / 2
  apu.position.set(0, R * 0.15, -L * 0.48)
  skin.add(apu)

  // Antenna / satcom blister on upper fuselage
  const sat = new THREE.Mesh(new THREE.SphereGeometry(R * 0.18, 12, 10), mats.paint)
  sat.scale.set(1.1, 0.45, 1.4)
  sat.position.set(0, R * 1.05, L * 0.05)
  skin.add(sat)
}

/** Ogival slender-delta — curved LE, long root, sharp tip (Concorde). */
function deltaWingGeometry(side, halfSpan, root, tip, sweep, thickness) {
  const y0 = Math.max(0.1, thickness * 0.5)
  // f = span fraction. LE curves aft; TE stays relatively straight.
  const stations = [
    { f: 0, le: root * 0.48, te: -root * 0.52, y: 1 },
    { f: 0.12, le: root * 0.36, te: -root * 0.5, y: 0.95 },
    { f: 0.28, le: root * 0.12, te: -root * 0.46, y: 0.82 },
    { f: 0.48, le: -sweep * 0.12, te: -root * 0.38 - sweep * 0.15, y: 0.62 },
    { f: 0.7, le: -sweep * 0.42, te: -sweep * 0.55 - tip * 0.2, y: 0.38 },
    { f: 0.88, le: -sweep * 0.68, te: -sweep * 0.78 - tip * 0.35, y: 0.2 },
    { f: 1, le: -sweep * 0.82, te: -sweep * 0.86 - tip * 0.45, y: 0.08 },
  ]
  const verts = []
  for (const s of stations) {
    const x = side * halfSpan * s.f
    const y = y0 * s.y
    verts.push(x, -y, s.te, x, -y, s.le, x, y, s.te, x, y, s.le)
  }
  const idx = []
  for (let i = 0; i < stations.length - 1; i += 1) {
    const a = i * 4
    const b = a + 4
    const quads = [
      [a, a + 1, b + 1, b],
      [a + 2, b + 2, b + 3, a + 3],
      [a, b, b + 2, a + 2],
      [a + 1, a + 3, b + 3, b + 1],
    ]
    for (const [p0, p1, p2, p3] of quads) {
      if (side > 0) idx.push(p0, p1, p2, p0, p2, p3)
      else idx.push(p0, p2, p1, p0, p3, p2)
    }
  }
  const tipBase = (stations.length - 1) * 4
  if (side > 0) {
    idx.push(0, 2, 3, 0, 3, 1)
    idx.push(tipBase, tipBase + 1, tipBase + 3, tipBase, tipBase + 3, tipBase + 2)
  } else {
    idx.push(0, 3, 2, 0, 1, 3)
    idx.push(tipBase, tipBase + 3, tipBase + 1, tipBase, tipBase + 2, tipBase + 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3))
  geometry.setIndex(idx)
  geometry.computeVertexNormals()
  return geometry
}

/** Swept Concorde-style vertical fin. */
function verticalFinGeometry(height, rootChord, tipChord, sweep = 0) {
  const leRoot = rootChord * 0.42
  const teRoot = -rootChord * 0.58
  const leTip = leRoot - sweep
  const teTip = leTip - tipChord
  const t0 = 0.11
  const t1 = 0.045
  const verts = [
    -t0, 0, teRoot,
    t0, 0, teRoot,
    t0, 0, leRoot,
    -t0, 0, leRoot,
    -t1, height, teTip,
    t1, height, teTip,
    t1, height, leTip,
    -t1, height, leTip,
  ]
  const idx = [
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
  ]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3))
  geometry.setIndex(idx)
  geometry.computeVertexNormals()
  return geometry
}

function taperedWingGeometry(side, halfSpan, root, tip, sweep, thickness) {
  const x1 = side * halfSpan
  const stations = [
    { f: 0, yTop: thickness * 0.55, yBot: -thickness * 0.35 },
    { f: 0.18, yTop: thickness * 0.72, yBot: -thickness * 0.42 },
    { f: 0.45, yTop: thickness * 0.48, yBot: -thickness * 0.28 },
    { f: 0.78, yTop: thickness * 0.22, yBot: -thickness * 0.14 },
    { f: 1, yTop: thickness * 0.04, yBot: -thickness * 0.04 },
  ]
  const verts = []
  const push = (x, y, z) => verts.push(x, y, z)
  for (const station of stations) {
    const zRoot = root / 2 - station.f * root
    const zTip = tip / 2 - sweep - station.f * tip
    push(0, station.yBot, zRoot)
    push(x1, station.yBot * 0.72, zTip)
    push(0, station.yTop, zRoot)
    push(x1, station.yTop * 0.72, zTip)
  }
  const idx = []
  for (let i = 0; i < stations.length - 1; i += 1) {
    const a = i * 4
    const b = a + 4
    const quads = [
      [a, a + 1, b + 1, b],
      [a + 2, b + 2, b + 3, a + 3],
      [a, b, b + 2, a + 2],
      [a + 1, a + 3, b + 3, b + 1],
    ]
    for (const [p0, p1, p2, p3] of quads) {
      if (side > 0) idx.push(p0, p1, p2, p0, p2, p3)
      else idx.push(p0, p2, p1, p0, p3, p2)
    }
  }
  const last = (stations.length - 1) * 4
  if (side > 0) {
    idx.push(0, 2, 3, 0, 3, 1)
    idx.push(last, last + 1, last + 3, last, last + 3, last + 2)
  } else {
    idx.push(0, 3, 2, 0, 1, 3)
    idx.push(last, last + 3, last + 1, last, last + 2, last + 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3))
  geometry.setIndex(idx)
  geometry.computeVertexNormals()
  return geometry
}

/** Lowest point near the fuselage centerline — ignores hanging engines/wingtips. */
function measureCenterBelly(root) {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  // Keep this tight — a wide gate pulls in wing engines and reports y≈0.
  const halfBody = Math.max(0.35, Math.min(size.x * 0.06, size.x * 0.5))
  let minY = Infinity
  const point = new THREE.Vector3()
  root.traverse((node) => {
    if (!node.isMesh || !node.geometry?.attributes?.position) return
    const pos = node.geometry.attributes.position
    const step = Math.max(1, Math.floor(pos.count / 2000))
    for (let i = 0; i < pos.count; i += step) {
      point.fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld)
      root.worldToLocal(point)
      if (Math.abs(point.x) > halfBody) continue
      // Mid-body only — skip nose/tail extremes.
      if (point.z > size.z * 0.35 || point.z < -size.z * 0.3) continue
      minY = Math.min(minY, point.y)
    }
  })
  return Number.isFinite(minY) ? minY : 0
}

/**
 * Y where gear struts should meet the airframe, in CRAFT-ROOT local space.
 * Samples the model underside near the centerline and clamps to the outer
 * skin so we never hang gear from cabin-volume percentiles (that left a
 * multi-meter gap under the belly).
 */
function measureGearAttachY(craftRoot, modelRoot) {
  craftRoot.updateMatrixWorld(true)
  modelRoot.updateMatrixWorld(true)
  const worldBox = new THREE.Box3().setFromObject(modelRoot)
  const min = worldBox.min.clone()
  const max = worldBox.max.clone()
  craftRoot.worldToLocal(min)
  craftRoot.worldToLocal(max)
  const loY = Math.min(min.y, max.y)
  const hiY = Math.max(min.y, max.y)
  const loX = Math.min(min.x, max.x)
  const hiX = Math.max(min.x, max.x)
  const loZ = Math.min(min.z, max.z)
  const hiZ = Math.max(min.z, max.z)
  const cx = (loX + hiX) * 0.5
  const cz = (loZ + hiZ) * 0.5
  const halfX = Math.max(0.22, (hiX - loX) * 0.04)
  const halfZ = Math.max(0.8, (hiZ - loZ) * 0.18)

  const samples = []
  const point = new THREE.Vector3()
  modelRoot.traverse((node) => {
    if (!node.isMesh || !node.geometry?.attributes?.position) return
    const pos = node.geometry.attributes.position
    const step = Math.max(1, Math.floor(pos.count / 2000))
    for (let i = 0; i < pos.count; i += step) {
      point.fromBufferAttribute(pos, i).applyMatrix4(node.matrixWorld)
      craftRoot.worldToLocal(point)
      if (Math.abs(point.x - cx) > halfX) continue
      if (Math.abs(point.z - cz) > halfZ) continue
      samples.push(point.y)
    }
  })
  if (samples.length < 6) return loY + 0.04
  samples.sort((a, b) => a - b)
  // ~5th percentile skips antenna crumbs; hard cap keeps us on outer skin.
  const idx = Math.min(samples.length - 1, Math.max(0, Math.floor(samples.length * 0.05)))
  const pct = samples[idx]
  const cap = loY + Math.max(0.08, (hiY - loY) * 0.1)
  return Math.min(pct, cap)
}

function seatPoint(def, real = null) {
  // GLB airframes sit on the ground with the cabin well above y=0 — place the
  // flight deck from the measured mesh so cockpit cam isn't under the belly.
  if (real?.size) {
    const nose = real.size.z * 0.5
    const behindNose = Math.min(6.2, Math.max(3.4, def.length * 0.085))
    const z = nose - behindNose
    const y = THREE.MathUtils.clamp(real.size.y * 0.46, 1.6, real.size.y * 0.62)
    return new THREE.Vector3(0, y, z)
  }
  let z = def.length * 0.06
  let y = def.radius * 0.22
  if (def.profile === "fighter" || def.profile === "aerobat") {
    z = def.length * 0.1
    y = def.radius * 0.18
  } else if (def.openings === "canopy") {
    z = def.length * 0.05
    y = def.radius * 0.2
  } else if (["tube", "jumbo", "biz", "concorde", "herc"].includes(def.profile)) {
    // Nose / flight-deck seat, not mid-cabin.
    z = def.length * 0.34
    y = def.radius * 0.15
  }
  return new THREE.Vector3(0, y, z)
}

function makePanelTexture(size = 320) {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.userData.shared = false
  return { canvas, ctx, texture }
}

function makePfdTexture() {
  return makePanelTexture(320)
}

function drawTape(ctx, x, y, w, h, value, step, format, color) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.fillStyle = "rgba(6, 12, 20, 0.92)"
  ctx.fillRect(x, y, w, h)
  const mid = y + h / 2
  const pxPer = h / (step * 8)
  const base = Math.floor(value / step) * step
  ctx.strokeStyle = "rgba(240, 245, 255, 0.35)"
  ctx.fillStyle = color
  ctx.font = "700 15px monospace"
  ctx.textAlign = "center"
  ctx.lineWidth = 1
  for (let v = base - step * 6; v <= base + step * 6; v += step) {
    const yy = mid - (v - value) * pxPer
    const major = v % (step * 5) === 0
    ctx.beginPath()
    ctx.moveTo(x + (major ? 2 : w * 0.35), yy)
    ctx.lineTo(x + w - 2, yy)
    ctx.stroke()
    if (major) ctx.fillText(format(v), x + w * 0.48, yy + 5)
  }
  ctx.fillStyle = "#0a1018"
  ctx.fillRect(x - 2, mid - 16, w + 4, 32)
  ctx.strokeStyle = "#f6f1e4"
  ctx.lineWidth = 2
  ctx.strokeRect(x - 2, mid - 16, w + 4, 32)
  ctx.fillStyle = "#35ffd2"
  ctx.font = "700 20px monospace"
  ctx.fillText(format(value), x + w * 0.5, mid + 7)
  ctx.restore()
}

function drawPfd(panel, info) {
  const { ctx, canvas, texture } = panel
  const w = canvas.width
  const h = canvas.height
  const bank = info.bank || 0
  const pitch = info.pitch || 0
  const spd = Math.round((info.speed || 0) * 3.6)
  const alt = Math.round(info.alt || 0)
  const hdg = Math.round(((info.heading || 0) + 360) % 360)
  const vsi = Math.round(info.vsi || 0)
  const cx = w * 0.5
  const cy = h * 0.5

  ctx.fillStyle = "#05080e"
  ctx.fillRect(0, 0, w, h)

  // Attitude sphere
  ctx.save()
  ctx.beginPath()
  ctx.rect(58, 36, w - 116, h - 78)
  ctx.clip()
  ctx.translate(cx, cy)
  ctx.rotate(-bank)
  const pitchPx = THREE.MathUtils.clamp(pitch * (180 / Math.PI) * 2.4, -90, 90)
  ctx.translate(0, pitchPx)
  ctx.fillStyle = "#2a78c4"
  ctx.fillRect(-220, -260, 440, 260)
  ctx.fillStyle = "#7a5530"
  ctx.fillRect(-220, 0, 440, 260)
  ctx.fillStyle = "#f0f4f8"
  ctx.fillRect(-220, -2, 440, 4)
  ctx.strokeStyle = "rgba(255,255,255,0.75)"
  ctx.fillStyle = "rgba(255,255,255,0.9)"
  ctx.font = "700 13px monospace"
  ctx.textAlign = "center"
  ctx.lineWidth = 2
  for (let deg = -40; deg <= 40; deg += 5) {
    if (deg === 0) continue
    const y = -deg * 2.4
    const len = Math.abs(deg) % 10 === 0 ? 48 : 22
    ctx.beginPath()
    ctx.moveTo(-len, y)
    ctx.lineTo(len, y)
    ctx.stroke()
    if (Math.abs(deg) % 10 === 0) {
      ctx.fillText(String(Math.abs(deg)), -len - 14, y + 4)
      ctx.fillText(String(Math.abs(deg)), len + 14, y + 4)
    }
  }
  ctx.restore()

  // Bank scale
  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = "#f6f1e4"
  ctx.fillStyle = "#f6f1e4"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 0, 96, -Math.PI * 0.75, -Math.PI * 0.25)
  ctx.stroke()
  for (const deg of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
    const a = (-90 + deg) * (Math.PI / 180)
    const r0 = deg === 0 ? 86 : 90
    const r1 = 96
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1)
    ctx.stroke()
  }
  ctx.rotate(-bank)
  ctx.beginPath()
  ctx.moveTo(0, -96)
  ctx.lineTo(-7, -84)
  ctx.lineTo(7, -84)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // Aircraft symbol
  ctx.strokeStyle = "#ffb703"
  ctx.fillStyle = "#ffb703"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(cx - 42, cy)
  ctx.lineTo(cx - 12, cy)
  ctx.moveTo(cx + 12, cy)
  ctx.lineTo(cx + 42, cy)
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx, cy + 18)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, 5, 0, Math.PI * 2)
  ctx.stroke()

  drawTape(ctx, 8, 40, 46, h - 88, spd, 10, (v) => String(Math.max(0, Math.round(v))), "#9ad8ff")
  drawTape(ctx, w - 54, 40, 46, h - 88, alt, 100, (v) => String(Math.max(0, Math.round(v))), "#9ad8ff")

  // Heading tape
  ctx.fillStyle = "rgba(6,12,20,0.95)"
  ctx.fillRect(58, 8, w - 116, 26)
  ctx.strokeStyle = "rgba(246,241,228,0.35)"
  ctx.strokeRect(58, 8, w - 116, 26)
  ctx.fillStyle = "#ffb703"
  ctx.font = "700 16px monospace"
  ctx.textAlign = "center"
  ctx.fillText(String(hdg).padStart(3, "0"), cx, 26)
  ctx.fillStyle = "#c8d2de"
  ctx.font = "700 11px monospace"
  for (let d = -40; d <= 40; d += 10) {
    if (d === 0) continue
    const hh = ((hdg + d + 360) % 360)
    ctx.fillText(String(Math.round(hh / 10) * 10 % 360).padStart(3, "0"), cx + d * 1.8, 22)
  }

  // VSI stub
  ctx.fillStyle = "#35ffd2"
  ctx.font = "700 12px monospace"
  ctx.textAlign = "right"
  ctx.fillText(`${vsi > 0 ? "+" : ""}${vsi}`, w - 8, h - 10)

  // Mode annunciations
  ctx.fillStyle = "#35ffd2"
  ctx.font = "700 12px monospace"
  ctx.textAlign = "left"
  ctx.fillText(info.ap ? "AP ENG" : "MANUAL", 62, h - 12)
  ctx.fillStyle = "#9ad8ff"
  ctx.fillText(info.gear || "", 140, h - 12)

  if (info.warn) {
    ctx.fillStyle = "#c1121f"
    ctx.fillRect(70, h - 48, w - 140, 22)
    ctx.fillStyle = "#fff"
    ctx.font = "700 14px monospace"
    ctx.textAlign = "center"
    ctx.fillText(String(info.warn).toUpperCase(), cx, h - 33)
  }
  texture.needsUpdate = true
}

function drawNd(panel, info) {
  const { ctx, canvas, texture } = panel
  const w = canvas.width
  const h = canvas.height
  const hdg = ((info.heading || 0) + 360) % 360
  const cx = w / 2
  const cy = h * 0.56
  ctx.fillStyle = "#04120e"
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((-hdg * Math.PI) / 180)
  ctx.strokeStyle = "#1f6b4f"
  ctx.lineWidth = 1.5
  for (const r of [36, 72, 108]) {
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(0, -120)
  ctx.lineTo(0, 120)
  ctx.moveTo(-120, 0)
  ctx.lineTo(120, 0)
  ctx.stroke()
  ctx.fillStyle = "#9ad8ff"
  ctx.font = "700 13px monospace"
  ctx.textAlign = "center"
  const labels = ["N", "3", "6", "E", "12", "15", "S", "21", "24", "W", "30", "33"]
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2
    const x = Math.sin(a) * 118
    const y = -Math.cos(a) * 118
    ctx.fillText(labels[i], x, y + 4)
  }
  ctx.restore()

  ctx.fillStyle = "#35ffd2"
  ctx.beginPath()
  ctx.moveTo(cx, cy - 12)
  ctx.lineTo(cx - 9, cy + 12)
  ctx.lineTo(cx + 9, cy + 12)
  ctx.closePath()
  ctx.fill()

  const thr = Math.round((info.throttle || 0) * 100)
  const vsi = Math.round(info.vsi || 0)
  ctx.fillStyle = "#ffb703"
  ctx.font = "700 15px monospace"
  ctx.textAlign = "left"
  ctx.fillText(`TRK ${String(Math.round(hdg)).padStart(3, "0")}`, 12, 22)
  ctx.fillText(`N1 ${thr}%`, 12, 42)
  ctx.fillText(`VS ${vsi > 0 ? "+" : ""}${vsi}`, 12, 62)
  ctx.fillStyle = "#9ad8ff"
  ctx.fillText(info.gear || "GEAR", 12, h - 16)
  ctx.fillStyle = "#c8d2de"
  ctx.font = "700 12px monospace"
  ctx.textAlign = "right"
  ctx.fillText("40 NM", w - 12, 22)
  texture.needsUpdate = true
}

function drawEicas(panel, info) {
  const { ctx, canvas, texture } = panel
  const w = canvas.width
  const h = canvas.height
  const thr = info.throttle || 0
  const n1 = Math.round(thr * 98 + 18)
  const egt = Math.round(420 + thr * 380)
  const ff = Math.round(800 + thr * 4200)
  const flap = Math.round((info.flap || 0) * 40)
  ctx.fillStyle = "#061018"
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = "#9ad8ff"
  ctx.font = "700 14px monospace"
  ctx.textAlign = "center"
  ctx.fillText("EICAS", w / 2, 20)

  const engines = info.engines || 2
  const gap = w / (engines + 1)
  for (let i = 0; i < engines; i += 1) {
    const x = gap * (i + 1)
    const jitter = ((i % 2) - 0.5) * 1.5
    const val = THREE.MathUtils.clamp(n1 + jitter, 0, 105)
    ctx.strokeStyle = "#1f3d55"
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.arc(x, 78, 28, Math.PI * 0.75, Math.PI * 2.25)
    ctx.stroke()
    ctx.strokeStyle = val > 95 ? "#ff2d2d" : "#35ffd2"
    ctx.beginPath()
    ctx.arc(x, 78, 28, Math.PI * 0.75, Math.PI * 0.75 + (val / 100) * Math.PI * 1.5)
    ctx.stroke()
    ctx.fillStyle = "#f6f1e4"
    ctx.font = "700 16px monospace"
    ctx.fillText(String(Math.round(val)), x, 82)
    ctx.fillStyle = "#9ad8ff"
    ctx.font = "700 11px monospace"
    ctx.fillText(`N1`, x, 118)
    ctx.fillText(`E${i + 1}`, x, 48)
  }

  ctx.textAlign = "left"
  ctx.fillStyle = "#ffb703"
  ctx.font = "700 13px monospace"
  ctx.fillText(`EGT  ${egt}°C`, 16, 150)
  ctx.fillText(`FF   ${ff} PPH`, 16, 170)
  ctx.fillStyle = "#9ad8ff"
  ctx.fillText(`FLAP ${flap}`, 16, 198)
  ctx.fillText(info.gear || "GEAR —", 16, 218)
  ctx.fillText(`SPOIL ${(info.spoiler || 0) > 0.2 ? "ARM" : "RET"}`, 16, 238)
  if (info.warn) {
    ctx.fillStyle = "#c1121f"
    ctx.fillRect(12, h - 36, w - 24, 24)
    ctx.fillStyle = "#fff"
    ctx.textAlign = "center"
    ctx.font = "700 13px monospace"
    ctx.fillText(String(info.warn).toUpperCase(), w / 2, h - 19)
  }
  texture.needsUpdate = true
}

/** Detailed flight-deck cabin around the pilot seat. */
function buildCockpit(def, mats, seat) {
  const office = new THREE.Group()
  office.name = "cockpit"
  const airliner = ["tube", "jumbo", "biz", "concorde", "herc"].includes(def.profile)
  const fighter = def.profile === "fighter" || def.profile === "aerobat"
  const engineCount = Math.max(1, (def.engines || []).filter((e) => e.kind === "jet" || e.kind === "prop" || !e.kind).length || (def.engines || []).length || 2)
  const wide = airliner ? Math.min(2.65, Math.max(1.85, def.radius * 1.45)) : fighter ? 1.1 : 1.4
  const depth = airliner ? 2.45 : fighter ? 1.4 : 1.75
  const seatX = airliner ? -wide * 0.2 : 0
  const liner = new THREE.MeshStandardMaterial({ color: 0x1c2430, roughness: 0.88, metalness: 0.06 })
  const soft = new THREE.MeshStandardMaterial({ color: 0x2c3444, roughness: 0.92 })
  const leather = new THREE.MeshStandardMaterial({ color: 0x1a1f28, roughness: 0.78, metalness: 0.05 })
  const plastic = new THREE.MeshStandardMaterial({ color: 0x0e1218, roughness: 0.48, metalness: 0.28 })
  const bezel = new THREE.MeshStandardMaterial({ color: 0x090c10, roughness: 0.4, metalness: 0.35 })
  const chrome = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.28, metalness: 0.85 })

  // Floor + roof with slight tunnel feel.
  const floor = new THREE.Mesh(new THREE.BoxGeometry(wide, 0.05, depth), soft)
  floor.position.set(0, seat.y - 0.58, seat.z + 0.12)
  const carpet = new THREE.Mesh(
    new THREE.BoxGeometry(wide * 0.55, 0.01, depth * 0.7),
    new THREE.MeshStandardMaterial({ color: 0x243040, roughness: 1 })
  )
  carpet.position.set(0, seat.y - 0.55, seat.z + 0.05)
  // Roof stops short of the windscreen so the forward view stays open.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(wide * 0.96, 0.05, depth * 0.62), liner)
  roof.position.set(0, seat.y + (fighter ? 0.58 : 0.78), seat.z - 0.08)
  office.add(floor, carpet, roof)

  // Nearly clear cabin glass — milky transmission was blocking the outside view.
  const clearView = new THREE.MeshPhysicalMaterial({
    color: 0xb8d4ea,
    metalness: 0,
    roughness: 0.02,
    transparent: true,
    opacity: 0.14,
    transmission: 0.92,
    thickness: 0.15,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 0.8,
  })

  for (const side of [-1, 1]) {
    // Side walls leave a window cutout forward of the seat.
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.06, fighter ? 1.05 : 1.35, depth * 0.72), liner)
    wall.position.set(side * wide * 0.49, seat.y + 0.08, seat.z - 0.12)
    office.add(wall)
    // A-pillar / windshield post
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.09, fighter ? 0.95 : 1.15, 0.1), mats.dark)
    pillar.position.set(side * wide * 0.4, seat.y + 0.28, seat.z + depth * 0.44)
    pillar.rotation.y = side * 0.22
    pillar.rotation.z = side * -0.08
    office.add(pillar)
    // Side window glass
    const sideGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, fighter ? 0.42 : 0.55, 0.7),
      clearView
    )
    sideGlass.position.set(side * wide * 0.485, seat.y + 0.38, seat.z + 0.62)
    sideGlass.renderOrder = 2
    office.add(sideGlass)
  }

  // Center windshield post + multi-pane glass (clear so runway / sky show through).
  const centerPost = new THREE.Mesh(new THREE.BoxGeometry(0.07, fighter ? 0.55 : 0.7, 0.06), mats.dark)
  centerPost.position.set(0, seat.y + 0.48, seat.z + depth * 0.46)
  office.add(centerPost)
  const glassH = fighter ? 0.55 : 0.72
  const paneW = dashWPane(wide, fighter)
  for (const side of [-1, 1]) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(paneW, glassH, 0.03), clearView)
    pane.position.set(side * (paneW * 0.52 + 0.04), seat.y + 0.52, seat.z + depth * 0.475)
    pane.rotation.x = -0.12
    pane.rotation.y = side * 0.08
    pane.renderOrder = 2
    office.add(pane)
  }
  // Slim brow — kept high so it does not fill the forward FOV.
  const brow = new THREE.Mesh(new THREE.BoxGeometry(wide * 0.9, 0.06, 0.14), plastic)
  brow.position.set(0, seat.y + (fighter ? 0.82 : 0.96), seat.z + depth * 0.28)
  brow.rotation.x = 0.28
  office.add(brow)

  const seatW = Math.min(0.58, wide * 0.26)
  const makeSeat = (x) => {
    const group = new THREE.Group()
    const base = new THREE.Mesh(new THREE.BoxGeometry(seatW * 1.05, 0.08, 0.52), plastic)
    base.position.set(0, -0.06, 0.02)
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(seatW, 0.12, 0.5), leather)
    const bolsterL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.42), leather)
    bolsterL.position.set(-seatW * 0.48, 0.04, 0)
    const bolsterR = bolsterL.clone()
    bolsterR.position.x = seatW * 0.48
    const back = new THREE.Mesh(new THREE.BoxGeometry(seatW * 1.02, 0.62, 0.1), leather)
    back.position.set(0, 0.32, -0.24)
    back.rotation.x = -0.12
    const head = new THREE.Mesh(new THREE.BoxGeometry(seatW * 0.62, 0.2, 0.1), leather)
    head.position.set(0, 0.68, -0.2)
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.32), soft)
    armL.position.set(-seatW * 0.58, 0.18, 0.02)
    const armR = armL.clone()
    armR.position.x = seatW * 0.58
    const rails = new THREE.Mesh(new THREE.BoxGeometry(seatW * 0.9, 0.03, 0.7), chrome)
    rails.position.set(0, -0.14, -0.05)
    group.add(base, cushion, bolsterL, bolsterR, back, head, armL, armR, rails)
    group.position.set(x, seat.y - 0.1, seat.z)
    return group
  }
  office.add(makeSeat(seatX))
  if (airliner) office.add(makeSeat(-seatX))

  const dashW = wide * 0.94
  // Lower glare shield so the horizon stays visible above the panel.
  const glare = new THREE.Mesh(new THREE.BoxGeometry(dashW, 0.08, 0.48), plastic)
  glare.position.set(0, seat.y + 0.18, seat.z + 0.78)
  glare.rotation.x = -0.38
  const glareLip = new THREE.Mesh(new THREE.BoxGeometry(dashW * 1.01, 0.03, 0.06), bezel)
  glareLip.position.set(0, seat.y + 0.22, seat.z + 0.98)
  const dash = new THREE.Mesh(new THREE.BoxGeometry(dashW, 0.5, 0.42), plastic)
  dash.position.set(0, seat.y - 0.02, seat.z + 0.74)
  // MCP mode-control strip under the glare
  const mcp = new THREE.Mesh(new THREE.BoxGeometry(dashW * 0.72, 0.06, 0.12), bezel)
  mcp.position.set(0, seat.y + 0.14, seat.z + 0.92)
  office.add(glare, glareLip, dash, mcp)

  const pfd = makePfdTexture()
  const nd = makePfdTexture()
  const eicas = makePanelTexture(320)
  drawPfd(pfd, { bank: 0, pitch: 0, speed: 0, alt: 0, heading: 0 })
  drawNd(nd, { throttle: 0, vsi: 0, gear: "GEAR DN", heading: 0 })
  drawEicas(eicas, { throttle: 0, gear: "GEAR DN", engines: engineCount, flap: 0 })

  const screenSize = fighter ? 0.3 : airliner ? 0.4 : 0.34
  const screenY = seat.y + 0.1
  const screenZ = seat.z + 0.95
  const addScreen = (panel, x, y, z, scale = 1) => {
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(screenSize * scale + 0.04, screenSize * scale + 0.04, 0.03),
      bezel
    )
    frame.position.set(x, y, z - 0.01)
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(screenSize * scale, screenSize * scale),
      new THREE.MeshBasicMaterial({ map: panel.texture })
    )
    mesh.position.set(x, y, z)
    office.add(frame, mesh)
    return mesh
  }
  addScreen(pfd, -dashW * (fighter ? 0.14 : 0.28), screenY, screenZ)
  addScreen(nd, -dashW * (fighter ? -0.14 : 0.1), screenY - (airliner ? 0.02 : 0), screenZ, airliner ? 0.92 : 1)
  if (airliner) {
    addScreen(eicas, dashW * 0.08, screenY - 0.02, screenZ, 0.88)
    addScreen(pfd, dashW * 0.3, screenY, screenZ, 0.95)
  } else {
    addScreen(nd, dashW * 0.22, screenY, screenZ)
  }

  // Standby analog cluster
  if (!fighter) {
    for (let i = 0; i < 3; i += 1) {
      const dial = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.025, 18),
        new THREE.MeshStandardMaterial({ color: 0x0c1016, emissive: 0x334455, emissiveIntensity: 0.4 })
      )
      dial.rotation.x = Math.PI / 2
      dial.position.set(-dashW * 0.02 + i * 0.13, seat.y + 0.22, seat.z + 0.92)
      office.add(dial)
    }
  }

  const warnLights = []
  const warnColors = [0xff2d2d, 0xffb703, 0xff2d2d, 0xff6a00, 0x35ffd2, 0xffb703]
  const warnLabels = ["STALL", "BANK", "OVSPD", "SHEAR", "GEAR", "DOOR"]
  for (let i = 0; i < warnColors.length; i += 1) {
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.038, 0.022),
      new THREE.MeshStandardMaterial({ color: warnColors[i], emissive: warnColors[i], emissiveIntensity: 0.05 })
    )
    lamp.position.set(-dashW * 0.32 + i * 0.12, seat.y + 0.32, seat.z + 0.9)
    lamp.userData.warnLabel = warnLabels[i]
    office.add(lamp)
    warnLights.push(lamp)
  }

  const useYoke = !fighter && def.profile !== "biz"
  const controls = new THREE.Group()
  let yoke = null
  let stick = null
  const makeYoke = (x) => {
    const group = new THREE.Group()
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.48, 10), mats.metal)
    column.rotation.x = Math.PI / 2
    column.position.set(0, -0.12, 0.08)
    const wheel = new THREE.Group()
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 10, 24), leather)
    rim.rotation.x = Math.PI / 2
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.045, 12), mats.dark)
    hub.rotation.x = Math.PI / 2
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.03), mats.dark)
    bar.rotation.x = Math.PI / 2
    wheel.add(rim, hub, bar)
    wheel.position.set(0, 0.02, 0)
    group.add(column, wheel)
    group.position.set(x, seat.y + 0.02, seat.z + 0.42)
    group.userData.wheel = wheel
    return group
  }
  if (useYoke) {
    yoke = makeYoke(seatX)
    controls.add(yoke)
    if (airliner) controls.add(makeYoke(-seatX))
  } else {
    stick = new THREE.Group()
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.34, 10), leather)
    grip.position.y = 0.14
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), mats.dark)
    top.position.y = 0.3
    const base = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), mats.metal)
    stick.add(base, grip, top)
    stick.position.set(fighter ? 0.2 : 0.24, seat.y - 0.18, seat.z + 0.38)
    controls.add(stick)
  }

  // Rudder pedals
  for (const sx of airliner ? [seatX - 0.12, seatX + 0.12, -seatX - 0.12, -seatX + 0.12] : [-0.14, 0.14]) {
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.2), mats.dark)
    pedal.position.set(sx, seat.y - 0.45, seat.z + 0.58)
    pedal.rotation.x = -0.25
    controls.add(pedal)
  }

  // Center pedestal + throttle quadrant
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(airliner ? 0.38 : 0.3, 0.26, 0.7), plastic)
  pedestal.position.set(0, seat.y - 0.3, seat.z + 0.18)
  const pedestalTop = new THREE.Mesh(new THREE.BoxGeometry(airliner ? 0.42 : 0.34, 0.045, 0.72), bezel)
  pedestalTop.position.set(0, seat.y - 0.15, seat.z + 0.2)
  controls.add(pedestal, pedestalTop)

  const throttleLevers = []
  const leverCount = airliner ? Math.min(4, Math.max(2, engineCount)) : 2
  const leverSpan = leverCount <= 2 ? 0.08 : 0.055
  for (let i = 0; i < leverCount; i += 1) {
    const lever = new THREE.Group()
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.16, 0.028), mats.accent)
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), chrome)
    knob.position.y = 0.1
    lever.add(shaft, knob)
    const x = -((leverCount - 1) * leverSpan) / 2 + i * leverSpan
    lever.position.set(x, seat.y - 0.08, seat.z + 0.12)
    controls.add(lever)
    throttleLevers.push(lever)
  }
  const speedBrake = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.03), mats.dark)
  speedBrake.position.set(0.14, seat.y - 0.1, seat.z + 0.28)
  const flapLever = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.14, 0.03), new THREE.MeshStandardMaterial({ color: 0x35ffd2, roughness: 0.4 }))
  flapLever.position.set(-0.14, seat.y - 0.1, seat.z + 0.3)
  controls.add(speedBrake, flapLever)
  office.add(controls)

  const throttleLever = throttleLevers[0]
  const throttleLever2 = throttleLevers[1] || null

  // Overhead + side consoles
  const overhead = new THREE.Mesh(new THREE.BoxGeometry(wide * 0.9, 0.06, 0.82), plastic)
  overhead.position.set(0, seat.y + (fighter ? 0.52 : 0.7), seat.z + 0.08)
  overhead.rotation.x = 0.55
  office.add(overhead)
  for (const side of [-1, 1]) {
    const console = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.78), plastic)
    console.position.set(side * wide * 0.43, seat.y - 0.02, seat.z + 0.22)
    office.add(console)
  }

  const labelCache = new Map()
  const makeBtnLabel = (text) => {
    if (labelCache.has(text)) return labelCache.get(text)
    const tex = canvasTexture((ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = "rgba(8, 12, 18, 0.92)"
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = "rgba(246, 241, 228, 0.35)"
      ctx.strokeRect(1, 1, w - 2, h - 2)
      ctx.fillStyle = "#f6f1e4"
      ctx.font = "bold 20px sans-serif"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(String(text).slice(0, 10), w / 2, h / 2 + 1)
    }, 128, 36)
    tex.colorSpace = THREE.SRGBColorSpace
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    labelCache.set(text, mat)
    return mat
  }

  const switches = []
  const placeSwitch = (btn, x, y, z, face) => {
    let color = 0xe8e8e8
    let emissive = 0x555555
    if (btn.danger) {
      color = 0xff2d2d
      emissive = 0xaa1515
    } else if (btn.warn) {
      color = 0xffb703
      emissive = 0xaa7700
    } else if (btn.start) {
      color = 0x35ffd2
      emissive = 0x1a6b55
    }
    const sw = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.016, 0.028),
      new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.35 })
    )
    sw.position.set(x, y, z)
    sw.userData.sys = btn.id
    sw.userData.baseY = y
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.072, 0.02), makeBtnLabel(btn.label))
    if (face === "down") {
      label.rotation.x = Math.PI / 2 - 0.65
      label.rotation.z = Math.PI
      label.position.set(0, -0.014, 0.022)
    } else if (face === "up") {
      label.rotation.x = -Math.PI / 2 + 0.35
      label.rotation.z = Math.PI
      label.position.set(0, 0.014, -0.01)
    } else if (face === "left") {
      label.rotation.y = Math.PI / 2
      label.position.set(0.022, 0.012, 0)
    } else if (face === "right") {
      label.rotation.y = -Math.PI / 2
      label.position.set(-0.022, 0.012, 0)
    } else {
      label.rotation.y = Math.PI
      label.position.set(0, 0.02, -0.02)
    }
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.04, 0.04),
      new THREE.MeshBasicMaterial({ visible: false })
    )
    hit.userData.sys = btn.id
    sw.add(hit)
    sw.add(label)
    office.add(sw)
    switches.push(sw)
  }

  const buttons = COCKPIT_BUTTONS
  let bi = 0
  const glareCols = fighter ? 9 : 12
  const glareRows = fighter ? 2 : 3
  for (let row = 0; row < glareRows && bi < buttons.length; row += 1) {
    for (let col = 0; col < glareCols && bi < buttons.length; col += 1) {
      const x = -dashW * 0.44 + (col + 0.5) * ((dashW * 0.88) / glareCols)
      const y = seat.y + 0.3 - row * 0.055
      const z = seat.z + 0.9 - row * 0.02
      placeSwitch(buttons[bi], x, y, z, "pilot")
      bi += 1
    }
  }
  const dashCols = fighter ? 8 : 11
  const dashRows = fighter ? 3 : 4
  for (let row = 0; row < dashRows && bi < buttons.length; row += 1) {
    for (let col = 0; col < dashCols && bi < buttons.length; col += 1) {
      const x = -dashW * 0.42 + (col + 0.5) * ((dashW * 0.84) / dashCols)
      const y = seat.y + 0.08 - row * 0.048
      placeSwitch(buttons[bi], x, y, seat.z + 0.93, "pilot")
      bi += 1
    }
  }
  const ohCols = fighter ? 8 : 10
  const ohRows = fighter ? 4 : 5
  const ohY = seat.y + (fighter ? 0.5 : 0.66)
  const ohSpan = wide * 0.8
  for (let row = 0; row < ohRows && bi < buttons.length; row += 1) {
    for (let col = 0; col < ohCols && bi < buttons.length; col += 1) {
      const x = -ohSpan * 0.5 + (col + 0.5) * (ohSpan / ohCols)
      const y = ohY - row * 0.05
      const z = seat.z + 0.38 - row * 0.065
      placeSwitch(buttons[bi], x, y, z, "down")
      bi += 1
    }
  }
  const sideRows = fighter ? 5 : 7
  const sideCols = 2
  for (const side of [-1, 1]) {
    for (let row = 0; row < sideRows && bi < buttons.length; row += 1) {
      for (let col = 0; col < sideCols && bi < buttons.length; col += 1) {
        const x = side * (wide * 0.37 + col * 0.07)
        const y = seat.y + 0.24 - row * 0.07
        const z = seat.z + 0.52 - col * 0.08
        placeSwitch(buttons[bi], x, y, z, side < 0 ? "left" : "right")
        bi += 1
      }
    }
  }
  const pedCols = 4
  const pedRows = 5
  for (let row = 0; row < pedRows && bi < buttons.length; row += 1) {
    for (let col = 0; col < pedCols && bi < buttons.length; col += 1) {
      const x = -0.14 + col * 0.09
      const y = seat.y - 0.12
      const z = seat.z + 0.45 - row * 0.085
      placeSwitch(buttons[bi], x, y, z, "up")
      bi += 1
    }
  }
  let dashExtra = 0
  while (bi < buttons.length) {
    const col = dashExtra % dashCols
    const row = Math.floor(dashExtra / dashCols)
    const x = -dashW * 0.42 + (col + 0.5) * ((dashW * 0.84) / dashCols)
    placeSwitch(buttons[bi], x, seat.y - 0.1 - row * 0.045, seat.z + 0.92, "pilot")
    bi += 1
    dashExtra += 1
  }

  const dashLight = new THREE.PointLight(0x88b4d8, 0.7, 5)
  dashLight.position.set(seatX, seat.y + 0.4, seat.z + 0.45)
  const screenGlow = new THREE.PointLight(0x35ffd2, 0.35, 3.5)
  screenGlow.position.set(0, seat.y + 0.12, seat.z + 0.7)
  const overheadLight = new THREE.PointLight(0xffe6c8, 0.25, 4)
  overheadLight.position.set(0, seat.y + 0.55, seat.z)
  office.add(dashLight, screenGlow, overheadLight)

  return {
    office,
    warnLights,
    yoke: yoke?.userData?.wheel || yoke,
    stick,
    throttleLever,
    throttleLever2,
    throttleLevers,
    flapLever,
    speedBrake,
    pfd,
    nd,
    eicas,
    screens: { pfd, nd, eicas },
    switches,
    // Sit the eye up and forward so the clear windscreen frames the outside world.
    eyeOffset: new THREE.Vector3(seatX, 0.56, 0.34),
    engineCount,
  }
}

function dashWPane(wide, fighter) {
  return fighter ? wide * 0.38 : wide * 0.42
}

function addStrut(root, material, a, b) {
  const dir = new THREE.Vector3().subVectors(b, a)
  const length = dir.length()
  if (length < 0.2) return
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, length, 6), material)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  mesh.castShadow = true
  root.add(mesh)
}

function addSwingDoor(root, parts, mats, { x, y, z, w, h, delay, subtle = false }) {
  const hinge = new THREE.Group()
  hinge.position.set(x, y, z + w * 0.5)
  hinge.userData.group = "doors"
  // Flush body-colored doors — accent blue slabs read as broken geometry.
  const doorMat = mats.paint.clone()
  if (subtle) {
    doorMat.transparent = true
    doorMat.opacity = 0.08
    doorMat.depthWrite = false
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(subtle ? 0.03 : 0.045, h, w), doorMat)
  door.position.set(Math.sign(x) * 0.04, 0, -w * 0.5)
  door.castShadow = !subtle
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.03, h * 1.02, w * 1.02), mats.dark)
  frame.position.set(Math.sign(x) * 0.02, 0, -w * 0.5)
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.02, h * 0.28, w * 0.32), mats.glass)
  win.position.set(Math.sign(x) * 0.06, h * 0.18, -w * 0.5)
  hinge.add(frame, door, win)
  root.add(hinge)
  const cavity = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 0.84, w * 0.84), mats.interior)
  cavity.position.set(Math.sign(x) * (Math.abs(x) - 0.01), y, z)
  cavity.visible = false
  root.add(cavity)
  const angle = -Math.sign(x) * 1.45
  parts.push(makePart("doors", (t) => {
    hinge.rotation.y = angle * t
    cavity.visible = t > 0.12
    if (subtle) doorMat.opacity = 0.08 + t * 0.75
  }, { delay, lambda: 5 }))
}

function addDropPanel(root, parts, material, { x, y, z, width, depth, angle, delay }) {
  const hinge = new THREE.Group()
  hinge.position.set(x, y, z)
  hinge.userData.group = "cargo"
  const door = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, depth), material)
  door.position.set(0, -0.02, -depth / 2)
  door.castShadow = true
  hinge.add(door)
  root.add(hinge)
  const cavity = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.86, depth * 0.45, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x101216 })
  )
  cavity.position.set(x, y + 0.05, z - depth * 0.35)
  root.add(cavity)
  parts.push(makePart("cargo", (t) => {
    hinge.rotation.x = angle * t
  }, { delay, lambda: 2.6 }))
}

export function createAircraft(rawDef) {
  // Clone + type silhouette so C-130 ≠ A380 and Cub ≠ jet.
  const def = applyTypeLook({
    ...rawDef,
    wing: { ...rawDef.wing },
    gear: { ...rawDef.gear },
    tail: { ...(rawDef.tail || {}) },
    engines: (rawDef.engines || []).map((engine) => ({ ...engine })),
  })
  const mats = makeMaterials(def)
  const root = new THREE.Group()
  const skin = new THREE.Group()
  root.add(skin)
  const parts = []
  const gearDoors = []
  const wheels = []
  const props = []
  const jets = []
  const engineFires = []
  const ailerons = []
  const elevators = []
  root.name = def.id

  const real = hasRealModel(def.id) ? prepareRealModel(def) : null
  const useReal = Boolean(real)
  if (useReal) {
    skin.add(real.root)
    for (const node of real.spinNodes) props.push({ spin: node, disc: { material: { opacity: 0 } } })
  }

  const fuseLength = def.droop ? def.length * (def.profile === "concorde" ? 0.78 : 0.84) : def.length
  let rudder = new THREE.Group()
  if (!useReal) {
  const fuselage = new THREE.Mesh(fuselageGeometry(def, fuseLength), mats.paint)
  fuselage.castShadow = true
  fuselage.receiveShadow = true
  skin.add(fuselage)

  // Cockpit windshield — the silhouette cue that reads “airplane.”
  // MD-11 gets a multi-pane Douglas windshield in addMd11Airframe.
  if (def.id !== "md11" && ["tube", "jumbo", "biz", "herc", "twin", "light", "warbird"].includes(def.profile)) {
    const screen = new THREE.Mesh(
      new THREE.SphereGeometry(def.radius * 0.92, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
      mats.glass
    )
    screen.scale.set(0.95, 0.72, 1.15)
    screen.position.set(0, def.radius * 0.42, def.length * (def.profile === "light" || def.profile === "warbird" ? 0.22 : 0.32))
    screen.castShadow = true
    skin.add(screen)
    const brow = new THREE.Mesh(
      new THREE.TorusGeometry(def.radius * 0.55, def.radius * 0.04, 6, 18, Math.PI),
      mats.dark
    )
    brow.rotation.x = Math.PI / 2
    brow.rotation.z = Math.PI
    brow.position.set(0, def.radius * 0.55, def.length * (def.profile === "light" || def.profile === "warbird" ? 0.18 : 0.28))
    skin.add(brow)
  } else if (def.profile === "fighter" || def.profile === "aerobat") {
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(def.radius * 0.85, 12, 10), mats.glass)
    bubble.scale.set(0.85, 0.7, 1.35)
    bubble.position.set(0, def.radius * 0.55, def.length * 0.08)
    bubble.castShadow = true
    skin.add(bubble)
  }

  if (def.id === "b747") {
    addQueen747Airframe(skin, def, mats)
  } else if (def.id === "md11") {
    addMd11Airframe(skin, def, mats)
  } else if (def.hump === "front") {
    const hump = new THREE.Mesh(new THREE.SphereGeometry(def.radius * 0.78, 20, 14), mats.paint)
    hump.scale.set(0.92, 0.78, 2.35)
    hump.position.set(0, def.radius * 0.7, def.length * 0.16)
    hump.castShadow = true
    skin.add(hump)
  } else if (def.hump === "full") {
    const hump = new THREE.Mesh(new THREE.SphereGeometry(def.radius * 0.78, 18, 12), mats.paint)
    hump.scale.set(0.9, 0.62, 2.35)
    hump.position.set(0, def.radius * 0.72, def.length * 0.02)
    hump.castShadow = true
    skin.add(hump)
  }

  const skipGenericLivery = def.id === "b747" || def.id === "md11"
  const isFedex = def.brand === "fedex" || def.lockedLivery === "fedex"
  if (!skipGenericLivery) {
  for (const side of [-1, 1]) {
    const stripeLen = def.profile === "concorde" ? fuseLength * 0.48 : fuseLength * 0.62
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.04,
        Math.min(0.22, def.radius * 0.16),
        stripeLen
      ),
      mats.accent
    )
    stripe.position.set(
      side * (def.radius + 0.02),
      def.radius * 0.18,
      def.profile === "concorde" ? -fuseLength * 0.02 : fuseLength * 0.02
    )
    skin.add(stripe)
    if (def.profile !== "concorde") {
      const belly = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, Math.min(0.18, def.radius * 0.14), fuseLength * 0.55),
        mats.dark
      )
      belly.position.set(side * (def.radius * 0.55), -def.radius * 0.72, fuseLength * 0.02)
      skin.add(belly)
    }
  }
  }

  if (def.profile !== "concorde" && !skipGenericLivery) {
    for (let i = 0; i < 5; i += 1) {
      const seam = new THREE.Mesh(
        new THREE.BoxGeometry(def.radius * 1.95, 0.012, 0.02),
        mats.dark
      )
      seam.position.set(0, def.radius * (0.35 - i * 0.12), -fuseLength * 0.08 + i * fuseLength * 0.12)
      skin.add(seam)
    }
  }

  if (!skipGenericLivery && ["tube", "jumbo", "biz", "herc", "concorde"].includes(def.profile)) {
    const freighter = def.freighter || isFedex
    const count = freighter
      ? 4
      : Math.max(8, Math.floor(def.length / (def.profile === "concorde" ? 2.6 : 2.1)))
    for (let i = 0; i < count; i += 1) {
      // Keep cabin windows off the droop-nose / cockpit area.
      const z0 = freighter
        ? def.length * 0.18
        : def.profile === "concorde" ? -def.length * 0.2 : -def.length * 0.22
      const zSpan = freighter
        ? def.length * 0.08
        : def.profile === "concorde" ? def.length * 0.32 : def.length * 0.42
      const z = z0 + (count === 1 ? 0 : (i / (count - 1)) * zSpan)
      for (const side of [-1, 1]) {
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(
            0.05,
            Math.min(def.profile === "concorde" ? 0.32 : 0.48, def.radius * 0.22),
            Math.min(def.profile === "concorde" ? 0.38 : 0.62, def.radius * 0.28)
          ),
          mats.dark
        )
        frame.position.set(side * (def.radius + 0.01), def.radius * 0.22, z)
        const win = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, Math.min(0.38, def.radius * 0.2), Math.min(0.48, def.radius * 0.24)),
          mats.glass
        )
        win.position.set(side * (def.radius + 0.035), def.radius * 0.22, z)
        skin.add(frame, win)
      }
    }
  } else if (!skipGenericLivery) {
    for (const side of [-1, 1]) {
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, Math.min(0.36, def.radius * 0.38), Math.min(0.7, def.radius * 0.7)),
        mats.glass
      )
      win.position.set(side * (def.radius + 0.03), def.radius * 0.28, fuseLength * 0.08)
      skin.add(win)
    }
  }

  const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, Math.max(0.35, def.radius * 0.45), 6), mats.metal)
  pitot.rotation.x = Math.PI / 2
  pitot.position.set(def.radius * 0.35, def.wing.y * 0.15, def.length * 0.28)
  skin.add(pitot)

  if (def.intake === "belly" || def.intake === "scoop") {
    const scoop = new THREE.Mesh(
      new THREE.BoxGeometry(def.radius * (def.intake === "belly" ? 0.85 : 0.45), def.radius * 0.32, def.length * (def.intake === "belly" ? 0.16 : 0.1)),
      mats.dark
    )
    scoop.position.set(0, -def.radius * 0.78, def.length * (def.intake === "belly" ? 0.02 : -0.05))
    skin.add(scoop)
  }

  if (["light", "aerobat", "twin"].includes(def.profile)) {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.42, 4), mats.dark)
    antenna.position.set(0, def.radius + 0.22, -def.length * 0.02)
    skin.add(antenna)
  }

  const isDelta = def.profile === "concorde" || def.delta
  const wingThickness = Math.max(0.05, Math.min(isDelta ? 1.25 : 0.85, def.wing.root * (isDelta ? 0.048 : 0.07)))
  for (const side of [1, -1]) {
    const halfSpan = def.wing.span / 2
    const pivot = new THREE.Group()
    pivot.position.set(0, def.wing.y, def.wing.z)
    pivot.rotation.z = side * (def.wing.dihedral || 0)
    const wing = new THREE.Mesh(
      (isDelta ? deltaWingGeometry : taperedWingGeometry)(
        side,
        halfSpan,
        def.wing.root,
        def.wing.tip,
        def.wing.sweep,
        wingThickness
      ),
      mats.wing
    )
    wing.castShadow = true
    wing.receiveShadow = true
    pivot.add(wing)

    if (isDelta) {
      // Root fairing blends the ogive into the tube.
      const fairing = new THREE.Mesh(
        new THREE.SphereGeometry(def.radius * 0.95, 12, 10),
        mats.paint
      )
      fairing.scale.set(0.55, 0.35, def.wing.root * 0.22)
      fairing.position.set(side * def.radius * 0.35, 0.05, def.wing.root * 0.05)
      fairing.castShadow = true
      pivot.add(fairing)
    } else {
      const fairing = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(0.18, def.wing.root * 0.18), 10, 8),
        mats.paint
      )
      fairing.scale.set(0.55, 0.42, 1.1)
      fairing.position.set(side * Math.min(halfSpan * 0.08, def.radius * 0.9), 0, 0)
      fairing.castShadow = true
      pivot.add(fairing)
    }

    if (def.wingtips) {
      // Sharklet: angled plate, not a vertical stick.
      const tipH = Math.max(0.85, def.radius * 0.65)
      const tip = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, tipH, Math.max(0.55, def.wing.tip * 1.1)),
        mats.paint
      )
      tip.position.set(side * halfSpan * 0.98, tipH * 0.28, -def.wing.sweep * 0.75)
      tip.rotation.z = side * -0.45
      tip.rotation.y = side * 0.12
      tip.castShadow = true
      pivot.add(tip)
    }

    if (def.decal) {
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.max(0.7, def.wing.span * 0.08), Math.max(0.7, def.wing.span * 0.08)),
        new THREE.MeshBasicMaterial({ map: decalTexture(def.decal), transparent: true, depthWrite: false, side: THREE.DoubleSide })
      )
      decal.material.map.userData.shared = false
      decal.rotation.x = -Math.PI / 2
      decal.position.set(side * halfSpan * 0.55, wingThickness * 0.7, -def.wing.sweep * 0.25)
      pivot.add(decal)
    }

    const trailAt = (fraction) => {
      const teRoot = -def.wing.root / 2
      const teTip = -def.wing.tip / 2 - def.wing.sweep
      return THREE.MathUtils.lerp(teRoot, teTip, fraction)
    }

    if (def.flaps) {
      const flapSpan = def.wing.span * 0.2
      const flapChord = Math.max(0.22, def.wing.root * 0.2)
      const hinge = new THREE.Group()
      hinge.userData.group = "flaps"
      const flap = new THREE.Mesh(new THREE.BoxGeometry(flapSpan, 0.05, flapChord), mats.accent)
      flap.position.set(0, 0, -flapChord / 2)
      hinge.add(flap)
      hinge.position.set(side * halfSpan * 0.42, 0, trailAt(0.42))
      pivot.add(hinge)
      parts.push(makePart("flaps", (t) => {
        hinge.rotation.x = 0.72 * t
      }, { lambda: 3.4 }))
    }

    const aileronSpan = def.wing.span * (isDelta ? 0.16 : 0.13)
    const aileronChord = Math.max(0.18, def.wing.root * (isDelta ? 0.055 : 0.16))
    const aileron = new THREE.Group()
    // Elevons match wing paint — accent blue read as broken geometry on Concorde.
    const aileronMesh = new THREE.Mesh(
      new THREE.BoxGeometry(aileronSpan, isDelta ? 0.035 : 0.045, aileronChord),
      isDelta ? mats.wing : mats.accent
    )
    aileronMesh.position.set(0, 0, -aileronChord / 2)
    aileron.add(aileronMesh)
    if (isDelta) aileron.position.set(side * halfSpan * 0.62, 0.01, -def.wing.root * 0.42)
    else aileron.position.set(side * halfSpan * 0.78, 0, trailAt(0.78))
    pivot.add(aileron)
    ailerons.push({ hinge: aileron, side })
    if (isDelta) elevators.push(aileron)

    if (def.spoilers && def.profile !== "fighter") {
      const spoilerSpan = def.wing.span * 0.16
      const spoilerChord = Math.max(0.25, def.wing.root * 0.18)
      const hinge = new THREE.Group()
      hinge.userData.group = "spoilers"
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(spoilerSpan, 0.04, spoilerChord), mats.dark)
      spoiler.position.set(0, 0.02, -spoilerChord / 2)
      hinge.add(spoiler)
      hinge.position.set(side * halfSpan * 0.38, wingThickness * 0.55, trailAt(0.38) + spoilerChord + def.wing.root * 0.15)
      pivot.add(hinge)
      parts.push(makePart("spoilers", (t) => {
        hinge.rotation.x = -1.05 * t
      }, { lambda: 6 }))
    }

    root.add(pivot)
  }

  if (def.struts) {
    for (const side of [-1, 1]) {
      addStrut(
        root,
        mats.dark,
        new THREE.Vector3(side * def.wing.span * 0.28, def.wing.y - 0.05, def.wing.z),
        new THREE.Vector3(side * def.radius * 0.35, -def.radius * 0.45, def.wing.z + 0.4)
      )
    }
  }

  // Biplane upper wing (Pitts).
  if (def.biplane) {
    for (const side of [1, -1]) {
      const upper = new THREE.Mesh(
        taperedWingGeometry(side, def.wing.span * 0.48, def.wing.root * 0.85, def.wing.tip, def.wing.sweep * 0.5, 0.06),
        mats.wing
      )
      upper.position.set(0, def.radius * 1.1, def.wing.z + 0.15)
      upper.castShadow = true
      root.add(upper)
      addStrut(
        root,
        mats.dark,
        new THREE.Vector3(side * def.wing.span * 0.28, def.wing.y, def.wing.z),
        new THREE.Vector3(side * def.wing.span * 0.28, def.radius * 1.05, def.wing.z + 0.15)
      )
    }
  }

  // Canards (Rafale / Typhoon).
  if (def.canards) {
    for (const side of [1, -1]) {
      const canard = new THREE.Mesh(
        taperedWingGeometry(side, def.wing.span * 0.14, def.wing.root * 0.35, def.wing.tip * 0.6, 0.15, 0.05),
        mats.wing
      )
      canard.position.set(0, def.radius * 0.15, def.length * 0.28)
      canard.castShadow = true
      root.add(canard)
    }
  }

  // Flying-boat hull keel.
  if (def.flyingBoat) {
    const keel = new THREE.Mesh(
      new THREE.BoxGeometry(def.radius * 1.35, def.radius * 0.55, def.length * 0.72),
      mats.paint
    )
    keel.position.set(0, -def.radius * 0.55, -def.length * 0.02)
    keel.castShadow = true
    root.add(keel)
    for (const side of [-1, 1]) {
      const sponson = new THREE.Mesh(new THREE.SphereGeometry(def.radius * 0.35, 10, 8), mats.paint)
      sponson.scale.set(1.2, 0.55, 2.2)
      sponson.position.set(side * def.wing.span * 0.32, -def.radius * 0.15, def.wing.z)
      root.add(sponson)
    }
  }

  // SR-71 chines / gun hog nose.
  if (def.chines) {
    for (const side of [-1, 1]) {
      const chine = new THREE.Mesh(
        new THREE.BoxGeometry(def.radius * 1.4, 0.08, def.length * 0.55),
        mats.paint
      )
      chine.position.set(side * def.radius * 0.85, -def.radius * 0.15, def.length * 0.05)
      chine.rotation.z = side * 0.12
      root.add(chine)
    }
  }
  if (def.gunNose) {
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, def.length * 0.18, 8), mats.dark)
    snout.rotation.x = Math.PI / 2
    snout.position.set(0, -def.radius * 0.15, def.length * 0.42)
    root.add(snout)
  }

  const finH = isDelta
    ? def.length * 0.145
    : def.id === "md11"
      ? def.length * 0.195
      : ["jumbo"].includes(def.profile)
        ? def.length * 0.18
        : Math.max(def.radius * 1.65, def.length * 0.14)
  const finChord = isDelta
    ? def.length * 0.145
    : def.id === "md11"
      ? Math.max(def.radius * 1.25, def.length * 0.1)
      : Math.max(def.radius * 1.1, def.length * 0.085)
  const finZ = -def.length * (isDelta ? 0.38 : def.id === "md11" ? 0.42 : 0.4)
  const finXs = def.tripleTail
    ? [-def.radius * 1.1, 0, def.radius * 1.1]
    : def.twinFin
      ? [-def.radius * 0.85, def.radius * 0.85]
      : [0]
  finXs.forEach((fx, fi) => {
    const fin = new THREE.Mesh(
      verticalFinGeometry(finH * (fx === 0 && def.tripleTail ? 1.05 : 1), finChord, finChord * 0.38, finChord * 0.42),
      mats.paint
    )
    fin.position.set(fx, def.radius * 0.55, finZ)
    fin.castShadow = true
    root.add(fin)
    const finFlash = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, finH * 0.16, finChord * 0.2),
      mats.accent
    )
    finFlash.position.set(fx, def.radius * 0.55 + finH * 0.8, finZ - finChord * 0.05)
    root.add(finFlash)
    if (fi === 0) {
      const rudderMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, finH * (isDelta ? 0.5 : 0.55), finChord * (isDelta ? 0.16 : 0.2)),
        mats.paint
      )
      rudderMesh.position.z = -finChord * (isDelta ? 0.22 : 0.18)
      rudder.add(rudderMesh)
      rudder.position.set(
        fx,
        def.radius * 0.55 + finH * 0.35,
        finZ - finChord * (isDelta ? 0.18 : 0.28)
      )
      root.add(rudder)
    }
  })

  const skipStab = def.tail?.type === "none" || isDelta || def.tail?.type === "v"
  const tailSpan = def.tail?.span || def.wing.span * 0.34
  const tailChord = def.tail?.chord || Math.max(0.8, def.length * 0.075)
  const stabY = def.tail?.type === "t" ? def.radius * 0.55 + finH * 0.88 : Math.max(0.25, def.radius * 0.2)
  if (def.tail?.type === "v") {
    for (const side of [-1, 1]) {
      const vPanel = new THREE.Mesh(
        taperedWingGeometry(side, tailSpan * 0.42, tailChord, tailChord * 0.4, tailChord * 0.15, 0.07),
        mats.paint
      )
      vPanel.position.set(0, def.radius * 0.35, -def.length * 0.4)
      vPanel.rotation.z = side * 0.55
      vPanel.castShadow = true
      root.add(vPanel)
    }
  } else if (!skipStab) {
    const stabZ = def.id === "md11" ? finZ : -def.length * 0.4
    for (const side of [-1, 1]) {
      const stab = new THREE.Mesh(
        taperedWingGeometry(side, tailSpan * 0.5, tailChord, tailChord * 0.45, tailChord * 0.2, 0.08),
        mats.paint
      )
      stab.position.set(0, stabY, stabZ)
      stab.castShadow = true
      root.add(stab)
    }
    for (const side of [-1, 1]) {
      const elevator = new THREE.Group()
      const elevatorMesh = new THREE.Mesh(new THREE.BoxGeometry(tailSpan * 0.38, 0.05, tailChord * 0.24), mats.paint)
      elevatorMesh.position.z = -tailChord * 0.12
      elevator.add(elevatorMesh)
      elevator.position.set(side * tailSpan * 0.22, stabY, stabZ - tailChord * 0.28)
      root.add(elevator)
      elevators.push(elevator)
    }
  }

  if (def.id !== "md11") {
    const numberTex = labelTexture(def.number, def.ink || "#171717")
    const number = new THREE.Mesh(
      new THREE.PlaneGeometry(finH * 0.55, finH * 0.2),
      new THREE.MeshBasicMaterial({ map: numberTex, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    )
    number.rotation.y = Math.PI / 2
    number.position.set(0.1, def.radius * 0.55 + finH * 0.48, finZ)
    root.add(number)
  }

  for (let engIndex = 0; engIndex < def.engines.length; engIndex += 1) {
    const engine = def.engines[engIndex]
    const mount = new THREE.Group()
    mount.position.set(engine.x, engine.y, engine.z)
    if (engine.kind === "jet") {
      if (engine.buried) {
        // Paired underwing nacelle pack (Concorde-style).
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(engine.r * 2.2, engine.r * 1.35, engine.r * 6.2),
          mats.paint
        )
        box.position.set(0, engine.r * 0.1, -engine.r * 0.2)
        box.castShadow = true
        const fair = new THREE.Mesh(
          new THREE.CylinderGeometry(engine.r * 1.05, engine.r * 0.9, engine.r * 5.8, 14),
          mats.paint
        )
        fair.rotation.x = Math.PI / 2
        fair.position.y = -engine.r * 0.05
        fair.castShadow = true
        const intake = new THREE.Mesh(new THREE.BoxGeometry(engine.r * 1.85, engine.r * 1.05, 0.1), mats.dark)
        intake.position.z = engine.r * 2.7
        const nozzle = new THREE.Mesh(
          new THREE.CylinderGeometry(engine.r * 0.72, engine.r * 0.85, engine.r * 0.8, 12),
          mats.metal
        )
        nozzle.rotation.x = Math.PI / 2
        nozzle.position.z = -engine.r * 3.1
        mount.add(box, fair, intake, nozzle)
      } else if (def.id === "md11" && Math.abs(engine.x) < 0.5) {
        const tail = makeMd11TailEngine(engine, mats)
        while (tail.children.length) mount.add(tail.children[0])
      } else if (def.id === "md11") {
        const fan = makeMd11Turbofan(engine, mats)
        while (fan.children.length) mount.add(fan.children[0])
      } else if (def.id === "b747") {
        const queen = makeQueenTurbofan(engine, mats)
        while (queen.children.length) mount.add(queen.children[0])
      } else if (!engine.buried) {
        const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(engine.r, engine.r * 0.78, engine.r * 3.4, 18), mats.paint)
        nacelle.rotation.x = Math.PI / 2
        nacelle.castShadow = true
        const intake = new THREE.Mesh(new THREE.CircleGeometry(engine.r * 0.72, 18), mats.dark)
        intake.position.z = engine.r * 1.72
        const lip = new THREE.Mesh(new THREE.TorusGeometry(engine.r * 0.78, engine.r * 0.08, 8, 18), mats.metal)
        lip.position.z = engine.r * 1.55
        const core = new THREE.Mesh(new THREE.CylinderGeometry(engine.r * 0.35, engine.r * 0.42, engine.r * 0.5, 12), mats.metal)
        core.rotation.x = Math.PI / 2
        core.position.z = -engine.r * 1.55
        mount.add(nacelle, intake, lip, core)
        if (engine.pylon) {
          const pylon = new THREE.Mesh(
            new THREE.BoxGeometry(engine.r * 0.35, Math.max(0.35, Math.abs(engine.y) * 0.55 + engine.r * 0.4), engine.r * 1.6),
            mats.paint
          )
          pylon.position.set(0, Math.abs(engine.y) * 0.35 + engine.r * 0.15, engine.r * 0.1)
          pylon.castShadow = true
          mount.add(pylon)
        }
      }
      const hot = new THREE.MeshBasicMaterial({ color: 0xff6a00, transparent: true, opacity: 0.9 })
      const flame = new THREE.Mesh(new THREE.ConeGeometry(engine.r * 0.45, engine.r * 1.5, 12), hot)
      flame.rotation.x = Math.PI / 2
      flame.position.z = engine.buried
        ? -engine.r * 2.8
        : def.id === "b747" || def.id === "md11"
          ? -engine.r * 2.55
          : -engine.r * 2.1
      const light = new THREE.PointLight(0xff7a2a, 0, engine.r * 8)
      light.position.copy(flame.position)
      mount.add(flame, light)
      jets.push({ flame, mat: hot, light, engIndex })
    } else {
      if (Math.abs(engine.x) > 0.2) {
        const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(engine.r * 0.28, engine.r * 0.24, engine.r * 1.5, 12), mats.paint)
        nacelle.rotation.x = Math.PI / 2
        nacelle.castShadow = true
        mount.add(nacelle)
      }
      const spinner = new THREE.Mesh(new THREE.ConeGeometry(engine.r * 0.16, engine.r * 0.42, 12), mats.accent)
      spinner.rotation.x = Math.PI / 2
      spinner.position.z = engine.r * 0.15
      const spin = new THREE.Group()
      // Airfoil-ish tapered blades read more like a real prop than flat boxes.
      const bladeShape = new THREE.Shape()
      bladeShape.moveTo(0, 0)
      bladeShape.quadraticCurveTo(engine.r * 0.045, engine.r * 0.18, engine.r * 0.03, engine.r * 0.55)
      bladeShape.lineTo(-engine.r * 0.012, engine.r * 0.92)
      bladeShape.quadraticCurveTo(-engine.r * 0.05, engine.r * 0.5, -engine.r * 0.02, 0)
      bladeShape.closePath()
      const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.03, bevelEnabled: false })
      bladeGeo.translate(0, 0, -0.015)
      for (let i = 0; i < 3; i += 1) {
        const pivot = new THREE.Group()
        pivot.rotation.z = (i / 3) * Math.PI * 2
        const blade = new THREE.Mesh(bladeGeo, mats.dark)
        blade.rotation.y = 0.18
        pivot.add(blade)
        spin.add(pivot)
      }
      spin.add(spinner)
      spin.position.z = engine.r * 0.55
      const discMat = new THREE.MeshBasicMaterial({
        color: 0xd5d8dc,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const disc = new THREE.Mesh(new THREE.CircleGeometry(engine.r * 0.92, 18), discMat)
      disc.position.z = engine.r * 0.5
      mount.add(spin, disc)
      props.push({ spin, disc })
      const exhaust = new THREE.Mesh(
        new THREE.CylinderGeometry(engine.r * 0.05, engine.r * 0.06, engine.r * 0.55, 8),
        mats.metal
      )
      exhaust.rotation.x = Math.PI / 2
      exhaust.position.set(engine.r * 0.12, -engine.r * 0.08, engine.r * 0.05)
      mount.add(exhaust)
    }
    root.add(mount)
    if (engine.pylon) {
      const height = Math.abs(engine.y - def.wing.y)
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.14, Math.max(0.4, height), engine.r * 1.5), mats.paint)
      pylon.position.set(engine.x, (engine.y + def.wing.y) / 2, engine.z)
      pylon.castShadow = true
      root.add(pylon)
    }
  }
  } else {
    // Real GLBs already include engines and surfaces; gear may be a FG kit.
    root.add(rudder)
    if (real.hasBakedGear && real.gearMeshes.length > 0 && def.gear.mode === "retract") {
      // Separate gear meshes (when named) tuck away; fused meshes stay visible.
      for (const mesh of real.gearMeshes) {
        mesh.userData.gearHome = {
          pos: mesh.position.clone(),
          rot: mesh.rotation.clone(),
          visible: mesh.visible,
        }
      }
      parts.push(makePart("gear", (t) => {
        for (const mesh of real.gearMeshes) {
          const show = t > 0.18
          mesh.visible = show
          // Slight tuck so retract reads even on coarse named parts.
          if (mesh.userData.gearHome) {
            mesh.position.y = mesh.userData.gearHome.pos.y + (1 - t) * Math.min(1.2, def.radius * 0.35)
          }
        }
      }, { lambda: 2.3, start: 1 }))
    }
  }

  // Prefer FlightGear gear kits on hangar GLBs that lack real legs.
  // If a kit is missing/failed, fall back to procedural stilts so planes aren't bare.
  const bakedGear = useReal && real.hasBakedGear
  let fittedGearHeight = useReal ? (real.restClearance ?? 0.04) : def.gear.height
  let usedGearKit = false
  if (useReal && real.needsGearKit) {
    // Measure belly + floor in craft-root space after the GLB is parented.
    // Drop must match belly→floor (not catalog gear.height) or stilts lift the jet.
    root.updateMatrixWorld(true)
    const floorBox = new THREE.Box3().setFromObject(real.root)
    const floorMin = floorBox.min.clone()
    const floorMax = floorBox.max.clone()
    root.worldToLocal(floorMin)
    root.worldToLocal(floorMax)
    const floorY = Math.min(floorMin.y, floorMax.y)
    const bellyY = measureGearAttachY(root, real.root)
    const kit = buildGearKitGroup(def, bellyY, { floorY })
    if (kit) {
      usedGearKit = true
      root.add(kit.group)
      for (const wheel of kit.wheels) wheels.push(wheel)
      if (def.gear.mode === "retract" && !kit.skids) {
        parts.push(makePart("gear", (t) => {
          for (const leg of kit.retractRoots) {
            const home = leg.userData.gearHome
            if (!home) continue
            const show = t > 0.18
            leg.visible = show
            leg.position.y = home.pos.y + (1 - t) * Math.min(1.6, def.radius * 0.45)
            // Fold mains slightly inward for a readable retract.
            const side = Math.sign(home.pos.x) || 0
            leg.rotation.z = home.rot.z + (1 - t) * side * -1.15
            if (Math.abs(side) < 0.1) leg.rotation.x = home.rot.x + (1 - t) * -1.35
          }
        }, { lambda: 2.3, start: 1 }))
      }
      root.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(root)
      // Sit on tire bottoms; keep a small pad so engines aren't buried.
      fittedGearHeight = Math.max(0.35, -box.min.y + 0.02)
    }
  }
  if (!bakedGear && !usedGearKit) {
    const wheelR = THREE.MathUtils.clamp(
      def.radius * (useReal ? 0.1 : 0.18),
      useReal ? 0.22 : 0.16,
      useReal ? 0.42 : 0.65
    )
    // Real airliner mains sit close under the wing root — keep track tight.
    const track = def.wing.span * (def.gear.track || (useReal ? 0.08 : 0.16))
    // Attach at belly/wing; tire bottoms define sit height.
    // Convention: tire bottoms at local y = -fittedGearHeight; strutLen = pivotY + fittedGearHeight - wheelR.
    let attachY = -def.radius * 0.98
    const maxStrut = def.profile === "concorde" ? 2.4 : Math.min(1.15, def.radius * 0.55)
    let strutLen = THREE.MathUtils.clamp(attachY - (-def.gear.height + wheelR), 0.28, maxStrut)
    if (useReal) {
      // measureCenterBelly is in GLB local space; gear pivots live on craft root — convert.
      const bellyLocal = new THREE.Vector3(0, measureCenterBelly(real.root), 0)
      real.root.updateMatrixWorld(true)
      real.root.localToWorld(bellyLocal)
      root.updateMatrixWorld(true)
      root.worldToLocal(bellyLocal)
      // Nudge slightly into the belly so struts read attached, not floating.
      attachY = bellyLocal.y + Math.min(0.08, def.radius * 0.04)
      const jumbo = def.radius >= 2.6 || def.length >= 55
      strutLen = THREE.MathUtils.clamp(
        jumbo ? def.radius * 0.28 : def.radius * 0.2,
        jumbo ? 0.55 : 0.38,
        jumbo ? 1.05 : 0.72
      )
      fittedGearHeight = Math.max(0.35, -(attachY - strutLen - wheelR))
    } else if (def.profile === "concorde") {
      // Tall mains from wing/belly line so struts read as attached to the airframe.
      const wingT = Math.max(0.08, Math.min(1.25, def.wing.root * 0.048))
      const wingBot = def.wing.y - wingT * 0.5
      const belly = -def.radius * 0.98
      attachY = Math.min(wingBot, belly + 0.08)
      strutLen = THREE.MathUtils.clamp(def.gear.height + attachY - wheelR, 1.8, maxStrut)
      fittedGearHeight = -(attachY - strutLen - wheelR)
    } else {
      attachY = -def.radius * 0.98
      strutLen = THREE.MathUtils.clamp(
        def.gear.height - def.radius * 0.98 - wheelR,
        0.28,
        maxStrut
      )
      fittedGearHeight = -(attachY - strutLen - wheelR)
    }
    const mainZ = def.profile === "concorde" ? -def.length * 0.1 : useReal ? -def.length * 0.04 : -def.length * 0.02
    const noseZ = def.profile === "concorde" ? def.length * 0.18 : def.length * (useReal ? 0.22 : 0.3)
    const gearLegs = def.gear.style === "taildragger"
      ? [
          { x: -track / 2, z: def.length * 0.08, nose: false, tail: false, radius: wheelR, y: attachY },
          { x: track / 2, z: def.length * 0.08, nose: false, tail: false, radius: wheelR, y: attachY },
          { x: 0, z: -def.length * 0.42, nose: false, tail: true, radius: wheelR * 0.45, y: attachY },
        ]
      : [
          {
            x: 0,
            z: noseZ,
            nose: true,
            tail: false,
            radius: wheelR * (def.profile === "concorde" ? 0.85 : 0.72),
            y: attachY,
            bogie: def.profile === "concorde" ? 2 : 1,
          },
          {
            x: -track / 2,
            z: mainZ,
            nose: false,
            tail: false,
            radius: wheelR * (def.profile === "concorde" ? 1.05 : 1),
            y: attachY,
            bogie: def.profile === "concorde" ? 4 : 1,
          },
          {
            x: track / 2,
            z: mainZ,
            nose: false,
            tail: false,
            radius: wheelR * (def.profile === "concorde" ? 1.05 : 1),
            y: attachY,
            bogie: def.profile === "concorde" ? 4 : 1,
          },
        ]

    const tireMat = mats.rubber.clone()
    tireMat.color.set(0x1a1a1a)
    tireMat.roughness = 0.95

    for (const leg of gearLegs) {
      const pivotY = leg.y ?? attachY
      // Keep strut length = designed oleo; never invent a second offset from fittedGearHeight.
      const legStrut = Math.max(0.22, strutLen * (leg.nose ? 0.85 : 1))
      const pivot = new THREE.Group()
      pivot.position.set(leg.x, pivotY, leg.z)
      const strutR = useReal ? 0.055 : def.profile === "concorde" ? 0.2 : 0.08
      const strutMat = def.profile === "concorde"
        ? new THREE.MeshStandardMaterial({ color: 0x2a2e33, metalness: 0.55, roughness: 0.45 })
        : mats.metal
      const strut = new THREE.Mesh(
        new THREE.CylinderGeometry(strutR * 0.75, strutR, legStrut, 10),
        strutMat
      )
      strut.position.y = -legStrut / 2
      strut.castShadow = true
      const spin = new THREE.Group()
      const tireW = Math.max(0.2, leg.radius * 0.55)
      const bogie = leg.bogie || 1
      if (bogie >= 4) {
        // Twin-axle main bogie.
        for (const dz of [-leg.radius * 1.15, leg.radius * 1.15]) {
          for (const dx of [-tireW * 0.85, tireW * 0.85]) {
            const tire = new THREE.Mesh(
              new THREE.CylinderGeometry(leg.radius, leg.radius, tireW * 0.85, 14),
              tireMat
            )
            tire.rotation.z = Math.PI / 2
            tire.position.set(dx, 0, dz)
            tire.castShadow = true
            spin.add(tire)
          }
        }
      } else if (bogie === 2) {
        for (const dx of [-tireW * 0.7, tireW * 0.7]) {
          const tire = new THREE.Mesh(
            new THREE.CylinderGeometry(leg.radius, leg.radius, tireW * 0.85, 14),
            tireMat
          )
          tire.rotation.z = Math.PI / 2
          tire.position.x = dx
          tire.castShadow = true
          spin.add(tire)
        }
      } else {
        const tire = new THREE.Mesh(
          new THREE.CylinderGeometry(leg.radius, leg.radius, Math.max(0.22, leg.radius * 0.7), 16),
          tireMat
        )
        tire.rotation.z = Math.PI / 2
        tire.castShadow = true
        const hub = new THREE.Mesh(
          new THREE.CylinderGeometry(leg.radius * 0.35, leg.radius * 0.35, tireW * 1.15, 12),
          mats.metal
        )
        hub.rotation.z = Math.PI / 2
        spin.add(tire, hub)
      }
      spin.position.y = -legStrut
      pivot.add(strut, spin)
      root.add(pivot)
      wheels.push({ spin, radius: leg.radius })

      if (def.gear.mode === "retract") {
        pivot.userData.group = "gear"
        let axis = "z"
        let retracted = 0
        if (leg.nose) {
          axis = "x"
          retracted = -1.5
        } else if (leg.tail) {
          axis = "x"
          retracted = 1.35
        } else {
          const inward = def.gear.fold !== "out"
          const sign = leg.x >= 0 ? 1 : -1
          retracted = (inward ? -1 : 1) * sign * 1.4
        }
        parts.push(makePart("gear", (t) => {
          pivot.rotation[axis] = retracted * (1 - t)
        }, { lambda: 2.3, start: 1 }))

        // Skip gear-door panels on real models and Concorde — they read as floating stilts.
        if (!useReal && def.profile !== "concorde") {
          const door = new THREE.Group()
          const panelW = Math.max(0.35, leg.radius * 1.3)
          const panel = new THREE.Mesh(
            new THREE.BoxGeometry(panelW, 0.05, Math.max(0.45, leg.radius * 2.1)),
            mats.dark
          )
          panel.position.y = -0.03
          door.add(panel)
          door.position.set(leg.x, -def.radius - 0.04, leg.z)
          root.add(door)
          const swing = leg.x === 0 ? 1.2 : Math.sign(leg.x) * 1.15
          gearDoors.push({ obj: door, axis: leg.x === 0 ? "x" : "z", swing })
        }
      }
    }
  }

  if (!useReal && def.openings === "doors") {
    const doorMats = mats
    const h = THREE.MathUtils.clamp(def.radius * (def.profile === "concorde" ? 1.35 : 1.7), 1.0, 2.4)
    const w = THREE.MathUtils.clamp(def.radius * (def.profile === "concorde" ? 0.7 : 0.95), 0.7, 1.35)
    const rows = def.doorCount >= 6 ? 3 : def.doorCount >= 4 ? 2 : 1
    const zs = def.profile === "concorde"
      ? [def.length * 0.2, -def.length * 0.05]
      : rows === 1
        ? [def.length * 0.08]
        : rows === 2
          ? [def.length * 0.16, -def.length * 0.06]
          : [def.length * 0.22, def.length * 0.04, -def.length * 0.14]
    const sides = def.doorCount === 1 ? [-1] : [-1, 1]
    let delay = 0
    for (const z of zs) {
      for (const side of sides) {
        addSwingDoor(root, parts, doorMats, {
          subtle: def.profile === "concorde",
          x: side * (def.radius + 0.02),
          y: def.radius * 0.02,
          z,
          w,
          h,
          delay,
        })
        delay += 0.07
      }
    }
    if (def.hump) {
      addSwingDoor(root, parts, doorMats, {
        subtle: false,
        x: -(def.radius + 0.02),
        y: def.radius * 1.05,
        z: def.length * (def.hump === "front" ? 0.2 : 0.08),
        w: w * 0.9,
        h: h * 0.85,
        delay,
      })
    }
  } else if (useReal && def.openings === "doors") {
    parts.push(makePart("doors", () => {}, { lambda: 3.5 }))
  }

  if (!useReal && def.cargo === "belly") {
    addDropPanel(root, parts, mats.accent, {
      x: 0,
      y: -def.radius * 0.9,
      z: -def.length * 0.02,
      width: def.radius * 1.1,
      depth: Math.min(3.2, def.length * 0.12),
      angle: 1.25,
      delay: 0,
    })
  } else if (!useReal && def.cargo === "ramp") {
    addDropPanel(root, parts, mats.accent, {
      x: 0,
      y: -def.radius * 0.35,
      z: -def.length * 0.46,
      width: def.radius * 1.55,
      depth: def.length * 0.16,
      angle: 1.15,
      delay: 0,
    })
  }

  if (!useReal && def.droop) {
    const pivot = new THREE.Group()
    const noseLen = Math.max(2.5, def.length - fuseLength)
    pivot.userData.group = "nose"
    if (def.profile === "concorde") {
      // Lathe tip continuing the fuse taper — seamless when raised.
      const baseR = def.radius * 0.7
      const tipPoints = [
        new THREE.Vector2(0.02, 0),
        new THREE.Vector2(baseR * 0.25, noseLen * 0.22),
        new THREE.Vector2(baseR * 0.55, noseLen * 0.48),
        new THREE.Vector2(baseR * 0.85, noseLen * 0.75),
        new THREE.Vector2(baseR, noseLen),
      ]
      const tipGeo = new THREE.LatheGeometry(tipPoints, 24)
      tipGeo.rotateX(-Math.PI / 2)
      tipGeo.translate(0, 0, 0)
      const embed = noseLen * 0.12
      pivot.position.set(0, 0, fuseLength / 2 - embed)
      const tip = new THREE.Mesh(tipGeo, mats.paint)
      tip.position.z = embed
      tip.castShadow = true
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(baseR * 1.35, baseR * 0.55, noseLen * 0.28),
        mats.glass
      )
      visor.position.set(0, baseR * 0.55, embed + noseLen * 0.55)
      visor.rotation.x = -0.18
      pivot.add(tip, visor)
    } else {
      const tipR = def.radius * 0.9
      const embed = Math.min(noseLen * 0.38, def.radius * 1.6)
      pivot.position.set(0, 0, fuseLength / 2 - embed)
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(tipR * 1.02, tipR * 0.92, embed * 0.9, 22),
        mats.paint
      )
      collar.rotation.x = Math.PI / 2
      collar.position.z = embed * 0.35
      collar.castShadow = true
      const nose = new THREE.Mesh(
        new THREE.ConeGeometry(tipR * 0.92, noseLen * 0.92, 22),
        mats.paint
      )
      nose.rotation.x = Math.PI / 2
      nose.position.z = embed * 0.55 + noseLen * 0.42
      nose.castShadow = true
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(tipR * 1.15, tipR * 0.42, noseLen * 0.32),
        mats.glass
      )
      visor.position.set(0, tipR * 0.22, embed * 0.7 + noseLen * 0.12)
      pivot.add(collar, nose, visor)
    }
    root.add(pivot)
    parts.push(makePart("nose", (t) => {
      pivot.rotation.x = 0.55 * t
    }, { lambda: 2.2 }))
  }

  const seat = seatPoint(def, real)
  if (!useReal && def.openings === "canopy") {
    const bubbleR = Math.max(0.32, def.radius * 0.55)
    if (def.canopy === "slide") {
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(bubbleR, 16, 12), mats.glass)
      bubble.scale.set(0.85, 0.55, 1.2)
      bubble.position.set(0, def.radius + bubbleR * 0.22, seat.z)
      bubble.userData.group = "doors"
      root.add(bubble)
      const baseZ = bubble.position.z
      parts.push(makePart("doors", (t) => {
        bubble.position.z = baseZ - t * Math.max(0.7, def.radius * 1.5)
      }, { lambda: 4 }))
    } else {
      const hinge = new THREE.Group()
      hinge.position.set(0, def.radius + 0.02, seat.z + bubbleR * 0.15)
      hinge.userData.group = "doors"
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(bubbleR, 16, 12), mats.glass)
      bubble.scale.set(0.9, 0.48, 1.15)
      bubble.position.set(0, bubbleR * 0.28, -bubbleR * 0.15)
      hinge.add(bubble)
      root.add(hinge)
      parts.push(makePart("doors", (t) => {
        hinge.rotation.x = 1.2 * t
      }, { lambda: 4 }))
    }
  }

  const cockpit = buildCockpit(def, mats, seat)
  const office = cockpit.office
  const warnLights = cockpit.warnLights
  // Always build a usable flight deck. GLB exteriors hide it until cockpit cam
  // so the cabin doesn't poke through the mesh in chase/hangar views.
  office.visible = !useReal
  office.traverse((node) => {
    if (node.isMesh) node.frustumCulled = false
  })
  root.add(office)

  if (!useReal && def.spoilers && def.profile === "fighter") {
    const hinge = new THREE.Group()
    hinge.position.set(0, def.radius * 0.72, -def.length * 0.18)
    hinge.userData.group = "spoilers"
    const panel = new THREE.Mesh(new THREE.BoxGeometry(def.radius * 0.9, 0.05, def.length * 0.07), mats.accent)
    panel.position.z = -def.length * 0.035
    hinge.add(panel)
    root.add(hinge)
    parts.push(makePart("spoilers", (t) => {
      hinge.rotation.x = -0.95 * t
    }, { lambda: 6 }))
  }

  const bulbs = []
  const spots = []
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff2d2d, emissive: 0xff1d1d, emissiveIntensity: 0.2 })
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.06, def.radius * 0.06), 8, 8), beaconMat)
  if (useReal) {
    // Sit the beacon on the fin tip (top-aft). Using full height at mid-fuselage
    // left it floating far above the cabin roof.
    real.root.updateMatrixWorld(true)
    const airBox = new THREE.Box3().setFromObject(real.root)
    const finZ = THREE.MathUtils.lerp(airBox.min.z, airBox.max.z, 0.08)
    beacon.position.set(0, airBox.max.y + 0.06, finZ)
    skin.add(beacon)
    const wingY = Math.min(def.radius * 0.4, airBox.max.y * 0.25)
    const spot = new THREE.SpotLight(0xfff3cf, 0, Math.max(40, def.length * 3), 0.55, 0.45, 1)
    spot.position.set(0, wingY, def.length * 0.42)
    spot.target.position.set(0, -2, def.length * 0.42 + 30)
    spot.castShadow = false
    root.add(spot, spot.target)
    spots.push(spot)
  } else {
    for (const side of [-1, 1]) {
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(0.08, Math.min(0.28, def.radius * 0.08)), 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xfff4d2, emissive: 0xfff1c4, emissiveIntensity: 0 })
      )
      bulb.position.set(side * Math.min(def.wing.span * 0.18, def.radius * 1.4), def.wing.y - 0.05, def.wing.z + def.wing.root * 0.2)
      bulb.userData.group = "lights"
      root.add(bulb)
      bulbs.push(bulb)
    }
    const spot = new THREE.SpotLight(0xfff3cf, 0, Math.max(40, def.length * 3), 0.55, 0.45, 1)
    spot.position.set(0, -def.radius * 0.2, def.length * 0.35)
    spot.target.position.set(0, -2, def.length * 0.35 + 30)
    spot.castShadow = false
    root.add(spot, spot.target)
    spots.push(spot)

    beacon.position.set(0, def.radius + 0.08, -def.length * 0.05)
    skin.add(beacon)

    const navSize = Math.max(0.07, Math.min(0.3, def.radius * 0.07))
    const tipX = def.wing.span / 2
    const leftNav = new THREE.Mesh(
      new THREE.SphereGeometry(navSize, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0xff2020, emissiveIntensity: 2 })
    )
    leftNav.position.set(-tipX, def.wing.y, def.wing.z)
    const rightNav = new THREE.Mesh(
      new THREE.SphereGeometry(navSize, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x39e06d, emissive: 0x20c85a, emissiveIntensity: 2 })
    )
    rightNav.position.set(tipX, def.wing.y, def.wing.z)
    root.add(leftNav, rightNav)
  }

  // Engine-fire FX at each nacelle / prop (procedural + real GLB layouts).
  for (const engine of def.engines || []) {
    const r = Math.max(0.18, engine.r || def.radius * 0.35)
    const fx = makeEngineFire(r)
    const aft = engine.kind === "jet"
      ? (engine.buried ? r * 2.8 : def.id === "b747" ? r * 2.5 : r * 2.05)
      : r * 0.5
    fx.group.position.set(engine.x, engine.y + r * 0.15, engine.z - aft)
    root.add(fx.group)
    engineFires.push(fx)
  }

  let fedexBrand = null
  if (!useReal && (def.brand === "fedex" || def.lockedLivery === "fedex" || def.id === "md11")) {
    fedexBrand = addFedexMd11Brand(root, def, mats)
  }

  const api = {
    def,
    root,
    skin,
    mats,
    fedexBrand,
    parts,
    gearDoors,
    wheels,
    props,
    jets,
    engineFires,
    ailerons,
    elevators,
    rudder,
    beacon,
    bulbs,
    spots,
    warnLights,
    seat,
    cockpit,
    useReal,
    // Real GLB + kit: tire bottoms set fittedGearHeight; gear-up sits on airframe
    // (engines/belly near y≈0 after settle), not on the belly's mesh Y coordinate.
    modelClearance: bakedGear
      ? (real.restClearance ?? 0.04)
      : fittedGearHeight,
    modelBellyClearance: bakedGear
      ? (real.bellyClearance ?? Math.max(0.45, def.radius * 0.55))
      : usedGearKit
        ? Math.max(0.4, real.restClearance ?? 0.04, def.radius * 0.2)
        : useReal
          ? Math.max(fittedGearHeight, def.radius * 0.35)
          : def.radius * 0.98,
    gearT: 1,
    flapT: 0,
    doorT: 0,
    spoilerT: 0,
    cargoT: 0,
    noseT: 0,
    controls: { gear: 1, flapStep: 0, spoilers: 0, doors: 0, cargo: 0, nose: 0, lights: 0 },
    setCockpit(on) {
      // Show the flight deck; hide only the near fuselage shell that would plug
      // the windshield. Keep wings / engines / gear so you still read the plane
      // against the outside world.
      office.visible = on || !useReal
      skin.visible = !on
      for (const child of root.children) {
        if (child === office || child === skin) continue
        if (child.userData?.engineFire) continue
        if (child.isLight) {
          child.visible = true
          continue
        }
        // Keep external bits (wings, gear, engines) visible in cockpit cam.
        child.visible = true
      }
      for (const prop of props) {
        if (prop.spin) prop.spin.visible = true
        if (prop.disc) prop.disc.visible = true
      }
      for (const jet of jets) {
        if (jet.flame) jet.flame.visible = true
      }
      if (!on) {
        skin.visible = true
        for (const child of root.children) {
          if (child === office) continue
          if (child.userData?.engineFire) continue
          child.visible = true
        }
        office.visible = !useReal
        for (const part of parts) part.apply(part.t)
      }
    },
    setLights(on) {
      for (const bulb of bulbs) bulb.material.emissiveIntensity = on ? 4 : 0
      for (const lamp of spots) lamp.intensity = on ? 8 : 0
    },
  }
  root.traverse((node) => {
    if (node.userData.group) node.userData.craft = api
  })
  applyDemiAirline(api)
  return api
}

function groupValue(craft, group, fallback) {
  const items = craft.parts.filter((part) => part.group === group)
  if (!items.length) return fallback
  return items.reduce((sum, part) => sum + part.t, 0) / items.length
}

export function updateAircraft(craft, dt, input) {
  for (const part of craft.parts) {
    const next = input.targets[part.group] ?? 0
    if (part.dest !== next) {
      part.dest = next
      part.wait = part.delay || 0
    }
    if (part.wait > 0) part.wait -= dt
    else part.t = THREE.MathUtils.damp(part.t, part.dest, part.lambda, dt)
    part.apply(part.t)
  }
  craft.gearT = groupValue(craft, "gear", 1)
  craft.flapT = groupValue(craft, "flaps", 0)
  craft.doorT = groupValue(craft, "doors", 0)
  craft.spoilerT = groupValue(craft, "spoilers", 0)
  craft.cargoT = groupValue(craft, "cargo", 0)
  craft.noseT = groupValue(craft, "nose", 0)
  for (const door of craft.gearDoors) {
    door.obj.rotation[door.axis] = door.swing * craft.gearT
  }
  const rpm = input.throttle * 95 + Math.min(40, input.speed * 0.15)
  for (const prop of craft.props) {
    prop.spin.rotation.z += rpm * dt
    prop.disc.material.opacity = Math.min(0.45, rpm / 160)
  }
  const fireMask = input.engineFire || []
  for (let i = 0; i < craft.jets.length; i += 1) {
    const jet = craft.jets[i]
    const engKey = jet.engIndex ?? i
    const burning = !!fireMask[engKey]
    if (burning) {
      jet.mat.color.setHex(0xff2200)
      jet.mat.opacity = 0.95
      const pulse = 1.6 + 0.55 * Math.sin(performance.now() * 0.028 + i)
      jet.flame.scale.set(pulse, pulse, 2.8 + 1.2 * Math.sin(performance.now() * 0.04 + i))
      jet.light.intensity = 5.5 + 2.5 * Math.sin(performance.now() * 0.035 + i)
    } else {
      jet.mat.color.setHex(0xff6a00)
      jet.mat.opacity = 0.25 + input.throttle * 0.7
      const scale = 0.45 + input.throttle * 1.8
      jet.flame.scale.set(scale, scale, 0.4 + input.throttle * 2)
      jet.light.intensity = input.throttle * 4
    }
  }
  for (let i = 0; i < (craft.engineFires || []).length; i += 1) {
    const fx = craft.engineFires[i]
    const on = !!fireMask[i]
    fx.group.visible = on
    if (!on) {
      fx.light.intensity = 0
      continue
    }
    const t = performance.now() * 0.022
    for (let j = 0; j < fx.layers.length; j += 1) {
      const layer = fx.layers[j]
      const phase = t * (2.1 + j * 0.55) + i * 1.9 + j * 0.7
      const flicker = 0.72 + 0.38 * Math.sin(phase)
      const lengthen = 0.88 + 0.42 * Math.sin(t * (1.7 + j * 0.35) + j)
      if (layer.kind === "smoke") {
        const swell = 0.95 + 0.55 * Math.sin(t * 1.15 + j)
        layer.mesh.scale.set(swell, swell * (0.9 + 0.3 * flicker), swell * lengthen)
        layer.mesh.position.x = layer.baseX + Math.sin(t * 0.9 + j) * 0.06
        layer.mesh.position.y = layer.baseY + Math.sin(t * 1.4 + j) * 0.12 * layer.lift
        layer.mesh.position.z = layer.baseZ - (0.05 + 0.12 * Math.sin(t * 1.1 + j))
      } else {
        // Cone local Y is the length axis (faces aft after rotX), so stretch Y for plume length.
        const width = flicker * (layer.kind === "lick" ? 0.95 : 1)
        layer.mesh.scale.set(width, lengthen * (layer.kind === "up" ? 1.05 : 1.15), width)
        layer.mesh.position.x = layer.baseX + Math.sin(t * 2.6 + j) * 0.03
        layer.mesh.position.y = layer.baseY + Math.sin(t * 3.1 + j + i) * 0.05 * (layer.lift || 0.1)
        layer.mesh.position.z = layer.baseZ - Math.sin(t * 2.2 + j) * 0.04
      }
      layer.mat.opacity = (layer.mat.userData.baseOp || 0.7) * (0.62 + 0.48 * flicker)
    }
    fx.light.intensity = 5 + 3.5 * Math.sin(t * 3.6 + i)
  }
  const blink = Math.sin(performance.now() * 0.012) > 0.15
  craft.beacon.material.emissiveIntensity = blink ? 3.2 : 0.04
  const pedal = input.stick.yaw + (input.grounded ? input.stick.roll : 0)
  craft.rudder.rotation.y = THREE.MathUtils.clamp(pedal, -1, 1) * 0.4
  for (const elevator of craft.elevators) elevator.rotation.x = -input.stick.pitch * 0.4
  for (const aileron of craft.ailerons) aileron.hinge.rotation.x = -aileron.side * input.stick.roll * 0.45
  if (input.grounded) {
    for (const wheel of craft.wheels) wheel.spin.rotation.x -= (input.speed * dt) / wheel.radius
  }
  craft.setLights(input.lights > 0.5)
  if (craft.warnLights) {
    const active = input.warnings || []
    const map = ["stall", "bank", "overspeed", "windshear", "gear", "door"]
    for (let i = 0; i < craft.warnLights.length; i += 1) {
      const key = map[i]
      const lit = key ? active.includes(key) : false
      const blink = lit && Math.sin(performance.now() * 0.025 + i) > 0
      craft.warnLights[i].material.emissiveIntensity = lit ? (blink ? 2.8 : 0.55) : 0.05
    }
  }
  const pit = craft.cockpit
  if (pit) {
    if (pit.yoke) {
      pit.yoke.rotation.z = -input.stick.roll * 0.45
      pit.yoke.rotation.x = -input.stick.pitch * 0.35
    }
    if (pit.stick) {
      pit.stick.rotation.z = -input.stick.roll * 0.4
      pit.stick.rotation.x = -input.stick.pitch * 0.45
    }
    const thrZ = craft.seat.z + 0.05 + input.throttle * 0.22
    if (pit.throttleLevers?.length) {
      for (const lever of pit.throttleLevers) lever.position.z = thrZ
    } else if (pit.throttleLever) {
      pit.throttleLever.position.z = thrZ
      if (pit.throttleLever2) pit.throttleLever2.position.z = thrZ
    }
    if (pit.flapLever) {
      pit.flapLever.rotation.x = -craft.flapT * 0.7
    }
    if (pit.speedBrake) {
      pit.speedBrake.rotation.x = -craft.spoilerT * 0.9
    }
    if (pit.pfd && input.instruments) {
      drawPfd(pit.pfd, input.instruments)
      drawNd(pit.nd, input.instruments)
      if (pit.eicas) drawEicas(pit.eicas, input.instruments)
    }
  }
}

export function disposeCraft(craft) {
  const geometries = new Set()
  const materials = new Set()
  const textures = new Set()
  craft.root.traverse((node) => {
    if (node.geometry && !geometries.has(node.geometry)) {
      geometries.add(node.geometry)
      node.geometry.dispose()
    }
    const list = node.material ? [].concat(node.material) : []
    for (const material of list) {
      if (!material || materials.has(material)) continue
      materials.add(material)
      for (const key of ["map", "alphaMap", "emissiveMap"]) {
        const texture = material[key]
        if (texture && texture.isTexture && !texture.userData.shared && !textures.has(texture)) {
          textures.add(texture)
          texture.dispose()
        }
      }
      material.dispose()
    }
  })
}
