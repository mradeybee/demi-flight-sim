import * as THREE from "three"
import { RoomEnvironment } from "../node_modules/three/examples/jsm/environments/RoomEnvironment.js"
import { PLANES, partButtons, partSummary } from "./catalog.js"
import { createAircraft, disposeCraft, updateAircraft } from "./aircraft.js"
import { preloadAircraftModels } from "./models.js"
import { PAD, createWorld, WORLD_RADIUS } from "./world.js"
import { COCKPIT_BUTTONS } from "./cockpitButtons.js"
import { createWeatherController } from "./weather.js"
import { createNet } from "./net.js"
import { sanitizeName, airportLabel, padForSlot } from "./airportSlots.js"
import {
  AIRLINE_NAME,
  LIVERIES,
  applyLivery,
  applyDemiAirline,
  isAirliner,
  loadAirlineColors,
  loadLiveryId,
  liveryById,
  saveAirlineColors,
} from "./airline.js"

const canvas = document.getElementById("view")
const boot = document.getElementById("boot")
const menu = document.getElementById("menu")
const hud = document.getElementById("hud")
const list = document.getElementById("menu-list")
const toastEl = document.getElementById("toast")

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0xc5e4f8, 2500, WORLD_RADIUS * 0.85)
scene.background = new THREE.Color(0x8ecfff)
{
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
}

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.08, WORLD_RADIUS * 1.6)
const hemi = new THREE.HemisphereLight(0xd7ecff, 0x5d8f45, 1.05)
const sun = new THREE.DirectionalLight(0xfff2d6, 2.35)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.bias = -0.0004
sun.shadow.normalBias = 0.05
sun.shadow.camera.near = 10
sun.shadow.camera.far = 700
scene.add(hemi, sun, sun.target)
const fill = new THREE.DirectionalLight(0xc5d7ff, 0.28)
fill.position.set(-180, 90, -120)
scene.add(fill)

const world = createWorld(scene)
const weather = createWeatherController({ scene, hemi, sun, fill, world })
const keys = new Set()
const held = { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: 0, run: 0 }
const stick = { pitch: 0, roll: 0, yaw: 0 }
const velocity = new THREE.Vector3()
const forward = new THREE.Vector3()
const up = new THREE.Vector3()
const right = new THREE.Vector3()
const desiredCam = new THREE.Vector3()
const look = new THREE.Vector3()
const nose = new THREE.Vector3()
const camUp = new THREE.Vector3()

let mode = "menu"
let selected = -1
let player = null
let throttle = 0
let braking = false
let grounded = true
let wasAirborne = false
let snapCam = true
let cameraMode = 0
let orbitYaw = 0.62
let orbitPitch = 0.28
let orbitDist = 24
let flyOrbitDist = 28
let orbitAuto = true
const ORBIT_CAM = 9
const COCKPIT_CAM = 1
let cockLookYaw = 0
let cockLookPitch = 0
let walkLookYaw = 0
let walkLookPitch = 0
const ap = {
  on: false,
  hdg: true,
  alt: true,
  spd: true,
  targetHdg: 0,
  targetAlt: 100,
  targetSpd: 55,
}
const SYS_BUTTONS = COCKPIT_BUTTONS
const systems = Object.fromEntries(SYS_BUTTONS.map((btn) => [btn.id, !!btn.start]))
let dragging = false
let moved = 0
let lastX = 0
let lastY = 0
let muted = false
let coachOn = true
let toldRotate = false
let distance = 0
let recovering = false
let outside = false
let chuteOpen = false
let pilot = null
const pilotVel = new THREE.Vector3()
let playerName = "Pilot"
let localOrigin = { x: 0, z: 0 }
const remotes = new Map()
let netSyncAcc = 0
let trafficUiAcc = 0
const tmpQuat = new THREE.Quaternion()

function refreshAirportUi() {
  const banner = document.getElementById("airport-banner")
  const eyebrow = document.getElementById("hangar-eyebrow")
  const label = world.airportName || airportLabel(playerName)
  if (banner) banner.textContent = `You are at ${label}`
  if (eyebrow) eyebrow.textContent = label
  const rename = document.getElementById("rename-input")
  if (rename && !rename.matches(":focus")) rename.value = playerName
  const box = document.getElementById("players-online")
  if (!box) return
  box.innerHTML = ""
  const addPill = (name, yours = false) => {
    const pill = document.createElement("span")
    pill.className = yours ? "pill you" : "pill"
    pill.textContent = yours ? `${name} (you)` : name
    box.appendChild(pill)
  }
  addPill(playerName, true)
  for (const peer of remotes.keys()) {
    const remote = remotes.get(peer)
    if (remote?.name) addPill(remote.name)
  }
  if (net?.peers) {
    for (const peer of net.peers.values()) {
      if (!remotes.has(peer.id)) addPill(peer.name)
    }
  }
}

function makeNameplate(text) {
  const canvas = document.createElement("canvas")
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = "rgba(8,14,22,0.85)"
  ctx.fillRect(0, 0, 256, 64)
  ctx.fillStyle = "#f6f1e4"
  ctx.font = "bold 28px sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(String(text).slice(0, 16), 128, 34)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.5), mat)
  mesh.position.y = 14
  mesh.renderOrder = 5
  return mesh
}

function placeRemoteAtPad(remote, slot) {
  if (slot == null || !remote?.craft) return
  const pad = padForSlot(slot)
  const y = clearanceOf(remote.craft)
  remote.craft.root.position.set(pad.x, y, pad.z)
  remote.craft.root.rotation.set(0, 0.4, 0)
  remote.targetPos.set(pad.x, y, pad.z)
  remote.targetQuat.setFromEuler(remote.craft.root.rotation)
  remote.hasPose = true
  remote.craft.root.visible = true
}

function upsertRemote(peer) {
  if (!peer?.id) return
  let remote = remotes.get(peer.id)
  const planeId = peer.state?.planeId || peer.planeId || "b737"
  const def = PLANES.find((p) => p.id === planeId) || PLANES[0]
  if (!remote) {
    const craft = createAircraft(def)
    craft.root.visible = true
    const plate = makeNameplate(peer.name || "Pilot")
    craft.root.add(plate)
    scene.add(craft.root)
    remote = {
      id: peer.id,
      name: peer.name,
      slot: peer.slot,
      craft,
      plate,
      planeId: def.id,
      targetPos: new THREE.Vector3(),
      targetQuat: new THREE.Quaternion(),
      hasPose: false,
    }
    remotes.set(peer.id, remote)
    if (peer.slot != null) {
      world.ensureAirport(peer.slot, peer.name)
      placeRemoteAtPad(remote, peer.slot)
    }
  } else if (remote.planeId !== def.id) {
    scene.remove(remote.craft.root)
    disposeCraft(remote.craft)
    const craft = createAircraft(def)
    craft.root.visible = true
    const plate = makeNameplate(peer.name || remote.name || "Pilot")
    craft.root.add(plate)
    scene.add(craft.root)
    remote.craft = craft
    remote.plate = plate
    remote.planeId = def.id
    if (remote.hasPose) {
      craft.root.position.copy(remote.targetPos)
      craft.root.quaternion.copy(remote.targetQuat)
    } else if (peer.slot != null) {
      placeRemoteAtPad(remote, peer.slot)
    }
  }
  if (peer.slot != null) remote.slot = peer.slot
  if (peer.name && peer.name !== remote.name) {
    remote.name = peer.name
    if (remote.plate) {
      remote.craft.root.remove(remote.plate)
      remote.plate.material.map?.dispose()
      remote.plate.material.dispose()
      remote.plate = makeNameplate(peer.name)
      remote.craft.root.add(remote.plate)
    }
    if (peer.slot != null) world.ensureAirport(peer.slot, peer.name)
  }
  refreshAirportUi()
  return remote
}

function removeRemote(id) {
  const remote = remotes.get(id)
  if (!remote) return
  scene.remove(remote.craft.root)
  disposeCraft(remote.craft)
  remotes.delete(id)
  refreshAirportUi()
}

function applyRemoteState(msg) {
  const remote = upsertRemote(msg)
  if (!remote || !msg) return
  const craft = remote.craft
  const x = Number(msg.x)
  const y = Number(msg.y)
  const z = Number(msg.z)
  if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
    remote.targetPos.set(x, y, z)
    remote.hasPose = true
    // Snap if first pose or teleport (slot jump / join).
    if (!craft.root.visible || craft.root.position.distanceToSquared(remote.targetPos) > 40000) {
      craft.root.position.copy(remote.targetPos)
    }
  } else if (remote.slot != null && !remote.hasPose) {
    placeRemoteAtPad(remote, remote.slot)
  }
  tmpQuat.set(msg.qx || 0, msg.qy || 0, msg.qz || 0, msg.qw ?? 1)
  if (tmpQuat.lengthSq() > 0.0001) {
    tmpQuat.normalize()
    remote.targetQuat.copy(tmpQuat)
    if (craft.root.position.distanceToSquared(remote.targetPos) > 40000) {
      craft.root.quaternion.copy(remote.targetQuat)
    }
  }
  craft.root.visible = true
  if (craft.controls) {
    craft.controls.gear = msg.gear ?? 1
    craft.controls.flapStep = msg.flaps || 0
    craft.controls.doors = msg.doors || 0
    craft.controls.lights = msg.lights || 0
    craft.controls.spoilers = msg.spoilers || 0
  }
  remote.mode = msg.mode || "menu"
  remote.throttle = Number(msg.throttle) || 0
}

function compassLabel(dx, dz) {
  const deg = (Math.atan2(dx, dz) * 180) / Math.PI
  const headings = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
  const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8
  return headings[idx]
}

function refreshTrafficUi() {
  const hangarEl = document.getElementById("traffic-hangar")
  const hudEl = document.getElementById("hud-traffic")
  if (!player) {
    if (hangarEl) hangarEl.textContent = ""
    if (hudEl) hudEl.textContent = ""
    return
  }
  const origin = player.root.position
  const lines = []
  for (const remote of remotes.values()) {
    if (!remote.craft?.root.visible) continue
    const pos = remote.craft.root.position
    const dx = pos.x - origin.x
    const dz = pos.z - origin.z
    const dist = Math.hypot(dx, dz, pos.y - origin.y)
    const km = dist / 1000
    const label = km < 1 ? `${Math.round(dist)} m` : `${km.toFixed(1)} km`
    lines.push(`${remote.name || "Pilot"} · ${label} ${compassLabel(dx, dz)}`)
  }
  const text = lines.length ? lines.join(" · ") : "No other aircraft nearby"
  if (hangarEl) hangarEl.textContent = lines.length ? `Traffic: ${lines.join(" · ")}` : "Traffic: waiting for friends…"
  if (hudEl) hudEl.textContent = lines.length ? lines.slice(0, 3).join(" · ") : ""
}

const net = createNet({
  onWelcome(msg) {
    if (msg.offline || !msg.you) {
      world.setLocalAirport(0, playerName)
      localOrigin = { ...world.localOrigin }
      refreshAirportUi()
      toast("Flying offline — start with Play Turbo Flight Sim to host multiplayer.")
      return
    }
    playerName = msg.you.name
    try { localStorage.setItem("tfs-player-name", playerName) } catch { /* ignore */ }
    world.setLocalAirport(msg.you.slot, playerName)
    localOrigin = { ...world.localOrigin }
    if (player) place(player, PAD.x, PAD.z, 0.4)
    if (parked[0]) place(parked[0], PAD.x - 80, PAD.z + 250, 0.8)
    if (parked[1]) place(parked[1], PAD.x - 80, PAD.z + 340, -0.4)
    for (const peer of msg.peers || []) {
      world.ensureAirport(peer.slot, peer.name)
      const remote = upsertRemote(peer)
      if (peer.state) applyRemoteState({ id: peer.id, name: peer.name, slot: peer.slot, ...peer.state })
      else if (remote) placeRemoteAtPad(remote, peer.slot)
    }
    refreshAirportUi()
    refreshTrafficUi()
    const hint = document.getElementById("join-hint")
    if (hint && msg.joinUrlHint?.length) {
      hint.textContent = `Friends join: ${msg.joinUrlHint[0]}`
    }
    toast(`${world.airportName} is ready`)
    snapCam = true
    netSyncAcc = 99
    pushNetState(1)
  },
  onPeerJoin(player) {
    world.ensureAirport(player.slot, player.name)
    const remote = upsertRemote(player)
    if (remote && !remote.hasPose) placeRemoteAtPad(remote, player.slot)
    toast(`${player.name} joined · ${airportLabel(player.name)}`)
    netSyncAcc = 99
    pushNetState(1)
    refreshTrafficUi()
  },
  onPeerLeave(id) {
    const name = remotes.get(id)?.name || "Pilot"
    removeRemote(id)
    toast(`${name} left`)
    refreshTrafficUi()
  },
  onPeerUpdate(player) {
    world.ensureAirport(player.slot, player.name)
    upsertRemote(player)
    refreshAirportUi()
  },
  onPeerState(msg) {
    applyRemoteState(msg)
  },
  onStatus(text) {
    const el = document.getElementById("join-hint")
    if (el) el.textContent = text
  },
})

function pushNetState(dt) {
  if (!net.online || !player) return
  netSyncAcc += dt
  const interval = mode === "fly" ? 1 / 20 : 1 / 8
  if (netSyncAcc < interval) return
  netSyncAcc = 0
  const q = player.root.quaternion
  net.sendState({
    planeId: player.def.id,
    x: player.root.position.x,
    y: player.root.position.y,
    z: player.root.position.z,
    qx: q.x,
    qy: q.y,
    qz: q.z,
    qw: q.w,
    throttle,
    gear: player.controls.gear,
    flaps: player.controls.flapStep,
    doors: player.controls.doors,
    lights: player.controls.lights,
    spoilers: player.controls.spoilers,
    outside,
    mode,
  })
}
let jTapAt = 0
let jTapArmed = false
let takeoffBoost = 0
let rotateWait = 0
let warnTimer = 0
let toastTimer = 0
let stallTimer = 0
let bankTimer = 0
let terrainTimer = 0
let overspeedTimer = 0
let windshearTimer = 0
let lastCallout = ""
let lastCalloutAt = 0
const wind = new THREE.Vector3()
const windSample = new THREE.Vector3()
const flightInfo = { bank: 0, aoa: 0, stallSpeed: 0, warnings: [], windshear: false, windStrength: 0 }
const parked = []

/** Windshear / gust cells around Turbo Field (approach paths and coast). */
const SHEAR_ZONES = [
  { x: 40, z: 900, r: 220, y0: 12, y1: 95, top: { x: 18, y: -14, z: 6 }, bot: { x: -22, y: 9, z: -4 } },
  { x: -120, z: 1500, r: 260, y0: 25, y1: 140, top: { x: -16, y: -18, z: 10 }, bot: { x: 20, y: 12, z: -8 } },
  { x: 280, z: 1700, r: 200, y0: 40, y1: 180, top: { x: 12, y: -12, z: -14 }, bot: { x: -10, y: 8, z: 16 } },
  { x: 520, z: 400, r: 180, y0: 8, y1: 70, top: { x: 24, y: -10, z: 2 }, bot: { x: -18, y: 7, z: 4 } },
]

function sampleWind(position, out = windSample) {
  const w = weather.windMul
  out.set(
    (4.5 + Math.sin(position.z * 0.0007) * 2.2) * w,
    Math.sin(performance.now() * 0.0004) * 0.35 * w,
    1.2 * w
  )
  let shear = 0
  const shearBoost = weather.id === "storm" ? 1.55 : weather.id === "rain" ? 1.2 : 1
  for (const zone of SHEAR_ZONES) {
    const dx = position.x - zone.x
    const dz = position.z - zone.z
    const dist = Math.hypot(dx, dz)
    if (dist > zone.r || position.y < zone.y0 || position.y > zone.y1) continue
    const radial = 1 - dist / zone.r
    const mid = (zone.y0 + zone.y1) * 0.5
    const layer = THREE.MathUtils.clamp((position.y - mid) / ((zone.y1 - zone.y0) * 0.5), -1, 1)
    const blend = radial * radial * shearBoost
    const from = layer > 0 ? zone.top : zone.bot
    out.x += from.x * blend * Math.abs(layer) * w
    out.y += from.y * blend * Math.abs(layer) * w
    out.z += from.z * blend * Math.abs(layer) * w
    // Crossing the shear layer is the dangerous part.
    shear = Math.max(shear, blend * (1 - Math.abs(Math.abs(layer) - 0.35) * 1.6))
  }
  flightInfo.windStrength = out.length()
  flightInfo.windshear = shear > 0.35
  return { wind: out, shear }
}

function wxActiveId() {
  return weather.live ? "live" : weather.id
}

function refreshWxPanel() {
  const status = document.getElementById("wx-status")
  if (status) status.textContent = weather.label
  const hangarStatus = document.getElementById("hangar-wx-status")
  if (hangarStatus) {
    hangarStatus.textContent = weather.live
      ? `${weather.label} (updates every few minutes)`
      : `${weather.label} — tap Live for real weather near you`
  }
  for (const button of document.querySelectorAll(".wx-btn")) {
    button.classList.toggle("on", button.dataset.wx === wxActiveId())
  }
  // Weather picks live in Settings only — never cover flight touch controls.
  const flightPanel = document.getElementById("wx-panel")
  if (flightPanel) flightPanel.hidden = true
  const chip = document.getElementById("hud-wx")
  if (chip) chip.textContent = weather.live ? `WX Live · ${weather.label}` : `WX ${weather.label}`
}

async function setWeather(id) {
  ensureAudio()
  if (id === "live") {
    toast("Fetching live weather…")
    refreshWxPanel()
    try {
      const result = await weather.applyLive()
      try { localStorage.setItem("tfs-weather", "live") } catch { /* ignore */ }
      toast(`${result.label}${result.windKmh != null ? ` · wind ${Math.round(result.windKmh)} km/h` : ""}`)
    } catch {
      toast("Live weather unavailable — try Clear or Rain.")
      weather.apply("cloudy", { label: "Cloudy" })
    }
    refreshWxPanel()
    return
  }
  const result = weather.apply(id)
  try { localStorage.setItem("tfs-weather", id) } catch { /* ignore */ }
  toast(`Weather: ${result.label}`)
  refreshWxPanel()
}

function fillWxGrid(grid) {
  if (!grid) return
  grid.innerHTML = ""
  for (const item of weather.presets) {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "wx-btn"
    button.dataset.wx = item.id
    button.textContent = item.label
    button.addEventListener("click", () => setWeather(item.id))
    grid.appendChild(button)
  }
  const live = document.createElement("button")
  live.type = "button"
  live.className = "wx-btn live"
  live.dataset.wx = "live"
  live.textContent = "Live"
  live.title = "Use real weather near you"
  live.addEventListener("click", () => setWeather("live"))
  grid.appendChild(live)
}

function renderWxPanel() {
  fillWxGrid(document.getElementById("wx-grid"))
  fillWxGrid(document.getElementById("hangar-wx-grid"))
  refreshWxPanel()
}

async function restoreWeather() {
  let saved = "clear"
  try { saved = localStorage.getItem("tfs-weather") || "clear" } catch { /* ignore */ }
  if (saved === "live") {
    try {
      await weather.applyLive()
    } catch {
      weather.apply("clear")
    }
  } else if (weather.presets.some((item) => item.id === saved)) {
    weather.apply(saved)
  } else {
    weather.apply("clear")
  }
  refreshWxPanel()
}

function speakCaution(phrase) {
  if (muted || typeof speechSynthesis === "undefined") return
  const now = performance.now()
  if (phrase === lastCallout && now - lastCalloutAt < 2200) return
  lastCallout = phrase
  lastCalloutAt = now
  try {
    speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(phrase)
    utter.rate = 1.05
    utter.pitch = 0.85
    utter.volume = 0.9
    speechSynthesis.speak(utter)
  } catch (error) {
    /* speech optional */
  }
}

const buttons = []

function toast(text) {
  toastEl.textContent = text
  toastEl.classList.add("show")
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2800)
}

function clearanceOf(craft) {
  if (craft.modelBellyClearance != null || craft.modelClearance != null) {
    const resting = craft.modelClearance ?? craft.def.gear.height
    const belly = craft.modelBellyClearance ?? Math.max(resting, craft.def.radius * 0.35)
    return THREE.MathUtils.lerp(belly, resting, craft.gearT ?? 1)
  }
  return THREE.MathUtils.lerp(craft.def.radius * 0.98, craft.def.gear.height, craft.gearT ?? 1)
}

function place(craft, x, z, yaw = 0) {
  craft.root.position.set(x, clearanceOf(craft), z)
  craft.root.rotation.set(0, yaw, 0)
}

function targetsFrom(craft) {
  const steps = [0, 0.34, 0.67, 1]
  const controls = craft.controls
  // Keep gear down on the ground — retracting on the runway drops the plane to belly height.
  if (craft === player && grounded && craft.def.gear.mode === "retract") controls.gear = 1
  return {
    gear: craft.def.gear.mode === "retract" ? controls.gear : 1,
    flaps: craft.def.flaps ? steps[controls.flapStep] || 0 : 0,
    spoilers: craft.def.spoilers ? controls.spoilers : 0,
    doors: controls.doors,
    cargo: craft.def.cargo ? controls.cargo : 0,
    nose: craft.def.droop ? controls.nose : 0,
  }
}

function toggle(craft, group) {
  const controls = craft.controls
  if (group === "flaps") {
    if (!craft.def.flaps) return
    controls.flapStep = (controls.flapStep + 1) % 4
  } else if (group === "gear") {
    if (craft.def.gear.mode !== "retract") return
    if (craft === player && grounded && controls.gear > 0.5) {
      toast("Raise the gear after you take off.")
      return
    }
    controls.gear = controls.gear > 0.5 ? 0 : 1
  } else if (group === "spoilers") {
    if (!craft.def.spoilers) return
    controls.spoilers = controls.spoilers ? 0 : 1
  } else if (group === "doors") {
    controls.doors = controls.doors ? 0 : 1
  } else if (group === "cargo") {
    if (!craft.def.cargo) return
    controls.cargo = controls.cargo ? 0 : 1
  } else if (group === "nose") {
    if (!craft.def.droop) return
    controls.nose = controls.nose ? 0 : 1
  } else if (group === "lights") {
    controls.lights = controls.lights ? 0 : 1
    if (craft === player) systems.landing = controls.lights > 0.5
  }
  if (craft === player) refreshSysPanel()
}

function tapPart(craft, code) {
  const map = {
    KeyG: "gear",
    KeyO: "doors",
    KeyF: "flaps",
    KeyP: "spoilers",
    KeyU: "cargo",
    KeyN: "nose",
    KeyL: "lights",
  }
  const group = map[code]
  if (group) toggle(craft, group)
}

function partState(craft, group) {
  const controls = craft.controls
  if (group === "gear") return controls.gear > 0.5 ? "Gear down" : "Gear up"
  if (group === "doors") {
    const open = controls.doors > 0.5
    return craft.def.openings === "canopy" ? (open ? "Canopy open" : "Canopy shut") : (open ? "Doors open" : "Doors shut")
  }
  if (group === "flaps") return ["Flaps up", "Flaps 1", "Flaps 2", "Flaps full"][controls.flapStep] || "Flaps up"
  if (group === "spoilers") return controls.spoilers ? "Spoilers out" : "Spoilers in"
  if (group === "cargo") return controls.cargo ? "Cargo open" : "Cargo shut"
  if (group === "nose") return controls.nose ? "Nose drooped" : "Nose up"
  if (group === "lights") return controls.lights ? "Lights on" : "Lights off"
  return group
}

function partOn(craft, group) {
  const controls = craft.controls
  if (group === "gear") return controls.gear < 0.5
  if (group === "flaps") return controls.flapStep > 0
  return controls[group] > 0.5
}

function renderPartButtons() {
  const panel = document.getElementById("parts-panel")
  panel.innerHTML = ""
  for (const item of partButtons(player.def)) {
    const button = document.createElement("button")
    button.type = "button"
    button.dataset.group = item.group
    button.innerHTML = `<b>${partState(player, item.group)}</b><kbd>${item.key}</kbd>`
    button.addEventListener("click", () => {
      toggle(player, item.group)
      button.blur()
    })
    panel.appendChild(button)
  }
}

function refreshPartButtons() {
  const panel = document.getElementById("parts-panel")
  for (const button of panel.children) {
    const group = button.dataset.group
    button.querySelector("b").textContent = partState(player, group)
    button.classList.toggle("on", partOn(player, group))
  }
}

function hintLine(def) {
  const bits = ["Stick or arrows steer", "Slide throttle", "B autopilot", "J J get out / jump", "Shift faster", "Q E rudder", "Space brake"]
  for (const item of partButtons(def)) bits.push(`${item.key} ${item.label.toLowerCase()}`)
  bits.push("C cycle cams", "Cockpit/Orbit: drag to look", "R reset", "Esc hangar")
  return bits.join("  ·  ")
}

function ensurePilot() {
  if (pilot) return pilot
  const root = new THREE.Group()
  const suit = new THREE.MeshStandardMaterial({ color: 0xff7a2a, roughness: 0.65, metalness: 0.1 })
  const skin = new THREE.MeshStandardMaterial({ color: 0xffd7b5, roughness: 0.85 })
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 4, 10), suit)
  body.position.y = 0.9
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skin)
  head.position.y = 1.62
  const chute = new THREE.Group()
  chute.visible = false
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(1.55, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide })
  )
  canopy.position.y = 3.1
  const stripe = new THREE.Mesh(
    new THREE.SphereGeometry(1.56, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0x2a9d8f, roughness: 0.85, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
  )
  stripe.position.y = 3.1
  chute.add(canopy, stripe)
  for (const side of [-0.5, 0.5]) {
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 2.2, 4),
      new THREE.MeshBasicMaterial({ color: 0xdddddd })
    )
    cord.position.set(side, 2.0, 0)
    chute.add(cord)
  }
  root.add(body, head, chute)
  root.visible = false
  scene.add(root)
  pilot = { root, chute, body, head }
  return pilot
}

function boardNearPlane() {
  if (!player || !pilot) return false
  // Generous reach so kids can hop back in from beside a big airliner.
  const reach = Math.max(22, player.def.length * 0.55, player.def.wing?.span * 0.35 || 0)
  const dx = pilot.root.position.x - player.root.position.x
  const dz = pilot.root.position.z - player.root.position.z
  return Math.hypot(dx, dz) <= reach
}

function enterPlane({ quiet = false } = {}) {
  if (!outside) return
  outside = false
  chuteOpen = false
  pilotVel.set(0, 0, 0)
  if (pilot) {
    pilot.chute.visible = false
    pilot.root.visible = false
  }
  if (player) {
    player.setCockpit(cameraMode === COCKPIT_CAM)
    if (player.controls.doors > 0.5) toggle(player, "doors")
  }
  snapCam = true
  refreshFlyActions()
  if (!quiet) {
    toast("Back in the plane! Tap Jump twice to get out.")
    beep(720, 0.08)
    setTimeout(() => beep(880, 0.1), 70)
  }
}

function exitPlane() {
  if (mode !== "fly" || !player || recovering || outside) return
  const clearance = clearanceOf(player)
  const agl = player.root.position.y - clearance
  const jumping = !grounded || agl > 5
  const exitVel = velocity.clone()

  if (ap.on) disengageAp()
  throttle = 0
  velocity.set(0, 0, 0)
  systems.parking = true
  if (player.controls.doors < 0.5) toggle(player, "doors")
  player.setCockpit(false)

  const avatar = ensurePilot()
  const side = new THREE.Vector3(-Math.max(2.8, player.def.radius * 1.35), 0, player.seat?.z ?? 0)
  side.applyQuaternion(player.root.quaternion)
  avatar.root.position.copy(player.root.position).add(side)
  avatar.root.quaternion.copy(player.root.quaternion)
  avatar.root.rotation.x = 0
  avatar.root.rotation.z = 0
  // First-person: hide the body so we look through the eyes.
  avatar.body.visible = false
  avatar.head.visible = false
  avatar.root.visible = true
  outside = true
  snapCam = true
  cameraMode = 0
  forward.set(0, 0, 1).applyQuaternion(player.root.quaternion)
  walkLookYaw = Math.atan2(forward.x, forward.z)
  walkLookPitch = 0
  avatar.root.rotation.y = walkLookYaw

  if (jumping) {
    chuteOpen = true
    avatar.chute.visible = true
    avatar.root.position.y = Math.max(player.root.position.y - 1.2, clearance + 2)
    pilotVel.set(exitVel.x * 0.4, Math.min(exitVel.y, -1.5), exitVel.z * 0.4)
    toast("You jumped out! Drag to look, stick to steer. Tap Board twice by the plane to climb in.")
    beep(320, 0.12, "triangle")
  } else {
    chuteOpen = false
    avatar.chute.visible = false
    avatar.root.position.y = 0
    pilotVel.set(0, 0, 0)
    toast("You stepped out. Drag to look, walk with the stick. Hold Run, then tap Get in twice by the door.")
    beep(480, 0.08)
  }
  refreshFlyActions()
}

function toggleExit() {
  if (mode !== "fly" || recovering) return
  if (outside) {
    if (chuteOpen && pilot && pilot.root.position.y > 4 && !boardNearPlane()) {
      toast("Land first, or float closer to the plane, then press J twice.")
      return
    }
    if (!boardNearPlane()) {
      toast("Walk closer to the plane, then press J twice.")
      beep(220, 0.08, "square")
      return
    }
    enterPlane()
    return
  }
  exitPlane()
}

/** Exit / board only after pressing J twice quickly (H does nothing). */
function onJumpKey() {
  if (mode !== "fly" || recovering) return
  const now = performance.now()
  if (jTapArmed && now - jTapAt < 550) {
    jTapArmed = false
    jTapAt = 0
    clearTimeout(onJumpKey._timer)
    toggleExit()
    return
  }
  jTapArmed = true
  jTapAt = now
  beep(520, 0.04)
  toast(outside ? "Tap again to get back in!" : "Tap Jump again to get out!")
  refreshFlyActions()
  clearTimeout(onJumpKey._timer)
  onJumpKey._timer = setTimeout(() => {
    jTapArmed = false
    refreshFlyActions()
  }, 600)
}

function stepOutside(dt) {
  if (!pilot?.root.visible) return
  readStick()
  let mx = stick.roll + (held.roll || 0)
  let mz = stick.pitch + (held.pitch || 0)
  if (keys.has("KeyA") || keys.has("ArrowLeft")) mx -= 1
  if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1
  if (keys.has("KeyW") || keys.has("ArrowUp")) mz += 1
  if (keys.has("KeyS") || keys.has("ArrowDown")) mz -= 1
  mx = THREE.MathUtils.clamp(mx, -1, 1)
  mz = THREE.MathUtils.clamp(mz, -1, 1)

  // Move relative to where you're looking (first person).
  const fwdX = Math.sin(walkLookYaw)
  const fwdZ = Math.cos(walkLookYaw)
  const rightX = Math.cos(walkLookYaw)
  const rightZ = -Math.sin(walkLookYaw)
  const worldX = fwdX * mz + rightX * mx
  const worldZ = fwdZ * mz + rightZ * mx

  if (chuteOpen) {
    pilotVel.x += worldX * 22 * dt
    pilotVel.z += worldZ * 22 * dt
    pilotVel.x *= Math.max(0, 1 - dt * 0.8)
    pilotVel.z *= Math.max(0, 1 - dt * 0.8)
    pilotVel.y = THREE.MathUtils.lerp(pilotVel.y, -5.2, 1 - Math.exp(-dt * 2.2))
    pilot.root.position.x += pilotVel.x * dt
    pilot.root.position.y += pilotVel.y * dt
    pilot.root.position.z += pilotVel.z * dt
    pilot.root.rotation.y = walkLookYaw
    pilot.root.rotation.z = THREE.MathUtils.clamp(-mx * 0.18, -0.3, 0.3)
    if (pilot.root.position.y <= 1.65) {
      pilot.root.position.y = 0
      pilot.root.rotation.z = 0
      chuteOpen = false
      pilot.chute.visible = false
      pilotVel.set(0, 0, 0)
      toast("You landed! Walk to the plane and press J twice.")
      beep(660, 0.1)
    }
  } else {
    const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") || held.run > 0 ? 11 : 6.5
    const len = Math.hypot(worldX, worldZ)
    if (len > 0.05) {
      pilot.root.position.x += (worldX / len) * speed * dt
      pilot.root.position.z += (worldZ / len) * speed * dt
    }
    pilot.root.position.y = 0
    pilot.root.rotation.y = walkLookYaw
    pilot.root.rotation.z = 0
  }

  // Keep the parked plane still while you're out.
  velocity.set(0, 0, 0)
  throttle = 0
}

function airlineColorsFromInputs() {
  return {
    primary: document.getElementById("airline-primary").value,
    secondary: document.getElementById("airline-secondary").value,
    fuselage: document.getElementById("airline-fuselage").value,
  }
}

function syncAirlinePaintUI(def) {
  const panel = document.getElementById("airline-paint")
  const show = isAirliner(def)
  panel.hidden = !show
  if (!show) return
  const colors = loadAirlineColors()
  document.getElementById("airline-primary").value = colors.primary
  document.getElementById("airline-secondary").value = colors.secondary
  document.getElementById("airline-fuselage").value = colors.fuselage
}

function repaintAirlineFleet(colors) {
  saveAirlineColors(colors)
  if (player) applyDemiAirline(player, colors)
  for (const craft of parked) applyDemiAirline(craft, colors)
  for (const button of buttons) {
    const def = PLANES[Number(button.dataset.index)]
    if (!isAirliner(def)) continue
    button.querySelector(".swatch").style.background =
      `linear-gradient(135deg, ${colors.fuselage}, ${colors.primary})`
  }
}

function selectPlane(index) {
  if (index === selected && player) return
  selected = index
  const def = PLANES[index]
  if (player) {
    scene.remove(player.root)
    disposeCraft(player)
  }
  player = createAircraft(def)
  scene.add(player.root)
  if (typeof window !== "undefined") window.__player = player
  place(player, PAD.x, PAD.z, 0.4)
  orbitDist = Math.max(def.length * 1.15, def.wing.span * 0.72) + 8
  snapCam = true
  document.getElementById("plane-name").textContent =
    isAirliner(def) ? `${def.name} · ${AIRLINE_NAME}` : def.name
  document.getElementById("plane-role").textContent = def.role
  document.getElementById("plane-blurb").textContent = def.blurb
  document.getElementById("plane-parts").textContent = partSummary(def)
  document.getElementById("fly-btn").textContent = `Fly the ${def.name}`
  syncAirlinePaintUI(def)
  for (const button of buttons) button.classList.toggle("active", Number(button.dataset.index) === index)
  const active = buttons.find((button) => Number(button.dataset.index) === index)
  active?.scrollIntoView({ block: "nearest" })
}

function selectRelative(step) {
  const next = (selected + step + PLANES.length) % PLANES.length
  selectPlane(next)
}

function resetControls(craft) {
  craft.controls = { gear: 1, flapStep: 0, spoilers: 0, doors: 0, cargo: 0, nose: 0, lights: 0 }
  for (const part of craft.parts) {
    const open = part.group === "gear" ? 1 : 0
    part.t = open
    part.dest = open
    part.wait = 0
    part.apply(part.t)
  }
  craft.gearT = 1
  craft.flapT = 0
  craft.doorT = 0
  craft.spoilerT = 0
  craft.cargoT = 0
  craft.noseT = 0
  craft.setLights(false)
}

function currentHeadingDeg() {
  return (THREE.MathUtils.radToDeg(Math.atan2(forward.x, forward.z)) + 360) % 360
}

function currentAltM() {
  if (!player) return 0
  return Math.max(0, player.root.position.y - clearanceOf(player))
}

function disengageAp(reason) {
  if (!ap.on) return
  ap.on = false
  refreshApPanel()
  if (reason) toast(reason)
}

function captureApTargets() {
  forward.set(0, 0, 1).applyQuaternion(player.root.quaternion)
  ap.targetHdg = Math.round(currentHeadingDeg())
  ap.targetAlt = Math.max(30, Math.round(currentAltM()))
  ap.targetSpd = Math.max(player.def.flight.stall * 1.2, velocity.length() > 8 ? velocity.length() : player.def.flight.cruise * 0.85)
}

function toggleAutopilot() {
  if (mode !== "fly" || !player) return
  if (ap.on) {
    disengageAp("Autopilot off.")
    return
  }
  if (grounded) {
    toast("Take off first, then turn on autopilot.")
    return
  }
  captureApTargets()
  ap.on = true
  ap.hdg = true
  ap.alt = true
  ap.spd = true
  refreshApPanel()
  toast(`Autopilot on · HDG ${String(ap.targetHdg).padStart(3, "0")} · ALT ${ap.targetAlt} m`)
  beep(740, 0.08)
  setTimeout(() => beep(920, 0.1), 90)
}

function adjustAp(kind, dir) {
  if (kind === "hdg") {
    ap.targetHdg = (ap.targetHdg + dir * 5 + 360) % 360
    ap.hdg = true
  } else if (kind === "alt") {
    ap.targetAlt = THREE.MathUtils.clamp(ap.targetAlt + dir * 50, 30, 4000)
    ap.alt = true
  }
  if (!ap.on && mode === "fly" && !grounded) {
    ap.on = true
    ap.spd = true
    toast("Autopilot on.")
  }
  refreshApPanel()
}

function refreshApPanel() {
  const master = document.getElementById("ap-master")
  const hdg = document.getElementById("ap-hdg")
  const alt = document.getElementById("ap-alt")
  const spd = document.getElementById("ap-spd")
  if (!master) return
  master.classList.toggle("on", ap.on)
  master.textContent = ap.on ? "AP ON" : "AP OFF"
  hdg.classList.toggle("on", ap.on && ap.hdg)
  alt.classList.toggle("on", ap.on && ap.alt)
  spd.classList.toggle("on", ap.on && ap.spd)
  document.getElementById("ap-hdg-read").textContent = `HDG ${String(Math.round(ap.targetHdg) % 360).padStart(3, "0")}`
  document.getElementById("ap-alt-read").textContent = `ALT ${Math.round(ap.targetAlt)} m`
  document.getElementById("ap-spd-read").textContent = `SPD ${Math.round(ap.targetSpd * 3.6)} km/h`
  systems.autopilot = ap.on
  systems.autothrottle = ap.on && ap.spd
  refreshSysPanel()
}

function refreshSysPanel() {
  if (player) {
    systems.landing = player.controls.lights > 0.5
    systems.landingL = systems.landing
    systems.landingR = systems.landing
    systems.gear = player.def.gear.mode === "retract" && player.controls.gear < 0.5
    systems.gearUp = systems.gear
    systems.gearDown = !systems.gear
    systems.doors = player.controls.doors > 0.5
    systems.flaps = player.controls.flapStep > 0
    systems.cargo = player.controls.cargo > 0.5
    systems.nose = player.controls.nose > 0.5
    systems.spoilers = player.controls.spoilers > 0.5
    systems.autopilot = ap.on
    systems.autothrottle = ap.on && ap.spd
    systems.apHdg = ap.on && ap.hdg
    systems.apAlt = ap.on && ap.alt
    systems.mute = muted
  }
  syncCockpitSwitches()
}

function syncCockpitSwitches() {
  if (!player?.cockpit?.switches) return
  for (const sw of player.cockpit.switches) {
    const on = !!systems[sw.userData.sys]
    sw.material.emissiveIntensity = on ? 1.8 : 0.15
    sw.position.y = sw.userData.baseY + (on ? -0.008 : 0.008)
  }
}

function pressSys(id) {
  const def = SYS_BUTTONS.find((btn) => btn.id === id)
  if (!def) return

  if (id === "landing" || id === "landingL" || id === "landingR") {
    if (player) toggle(player, "lights")
    systems.landing = player ? player.controls.lights > 0.5 : !systems.landing
    systems.landingL = systems.landing
    systems.landingR = systems.landing
    toast(systems.landing ? "Landing lights on" : "Landing lights off")
  } else if (id === "flaps" || id === "flapsUp" || id === "flaps1" || id === "flaps2" || id === "flapsFull") {
    if (player?.def.flaps) {
      if (id === "flaps") toggle(player, "flaps")
      else {
        player.controls.flapStep = id === "flapsUp" ? 0 : id === "flaps1" ? 1 : id === "flaps2" ? 2 : 3
        refreshSysPanel()
      }
    }
    toast(player ? partState(player, "flaps") : "Flaps")
  } else if (id === "gear" || id === "gearUp" || id === "gearDown") {
    if (player) {
      if (id === "gear") toggle(player, "gear")
      else if (id === "gearUp" && player.controls.gear > 0.5) toggle(player, "gear")
      else if (id === "gearDown" && player.controls.gear < 0.5) toggle(player, "gear")
    }
    toast(player ? partState(player, "gear") : "Gear")
  } else if (id === "doors") {
    if (player) toggle(player, "doors")
    toast(player ? partState(player, "doors") : "Doors")
  } else if (id === "cargo" || id === "nose" || id === "spoilers") {
    if (player) toggle(player, id)
    toast(player ? partState(player, id) : def.label)
  } else if (id === "autopilot") {
    toggleAutopilot()
    return
  } else if (id === "autothrottle") {
    if (!ap.on) toggleAutopilot()
    else {
      ap.spd = !ap.spd
      refreshApPanel()
      toast(ap.spd ? "Autothrottle on" : "Autothrottle off")
    }
    return
  } else if (id === "apHdg") {
    if (!ap.on) toggleAutopilot()
    else {
      ap.hdg = !ap.hdg
      refreshApPanel()
      toast(ap.hdg ? "Heading hold on" : "Heading hold off")
    }
    return
  } else if (id === "apAlt" || id === "apVs" || id === "apLvl") {
    if (!ap.on) toggleAutopilot()
    else {
      ap.alt = !ap.alt
      refreshApPanel()
      toast(ap.alt ? "Altitude hold on" : "Altitude hold off")
    }
    return
  } else if (id === "camera" || id === "chase") {
    if (mode === "fly") cycleCamera()
    return
  } else if (id === "cockpit") {
    goCockpitView()
    return
  } else if (id === "orbit") {
    goOrbitView()
    return
  } else if (id === "reset") {
    if (mode === "fly") resetToRunway("Back on the runway.")
    return
  } else if (id === "mute") {
    toggleMute()
    systems.mute = muted
    refreshSysPanel()
    return
  } else if (id === "horn") {
    beep(180, 0.25, "square")
    setTimeout(() => beep(140, 0.3, "square"), 120)
    toast("Honk!")
    return
  } else if (id === "fireLeft" || id === "fireRight" || id === "fireApu" || id === "cargoFire" || id === "evac") {
    systems[id] = !systems[id]
    beep(90, 0.4, "sawtooth")
    toast(systems[id] ? `${def.label} pulled!` : `${def.label} stowed`)
  } else if (id === "elvTrimUp" || id === "ptcTrim") {
    if (player && mode === "fly") player.root.rotateX(-0.04)
    toast("Elevator trim nose up")
    beep(660, 0.05)
    return
  } else if (id === "elvTrimDn") {
    if (player && mode === "fly") player.root.rotateX(0.04)
    toast("Elevator trim nose down")
    beep(520, 0.05)
    return
  } else if (id === "ailTrimL") {
    if (player && mode === "fly") player.root.rotateZ(0.04)
    toast("Aileron trim left")
    beep(600, 0.04)
    return
  } else if (id === "ailTrimR") {
    if (player && mode === "fly") player.root.rotateZ(-0.04)
    toast("Aileron trim right")
    beep(600, 0.04)
    return
  } else if (id === "rudTrimL") {
    if (player && mode === "fly") player.root.rotateY(0.04)
    toast("Rudder trim left")
    beep(560, 0.04)
    return
  } else if (id === "rudTrimR") {
    if (player && mode === "fly") player.root.rotateY(-0.04)
    toast("Rudder trim right")
    beep(560, 0.04)
    return
  } else if (id === "parking") {
    systems.parking = !systems.parking
    toast(systems.parking ? "Parking brake set" : "Parking brake released")
  } else if (id === "radio1" || id === "radio2" || id === "radio3") {
    systems[id] = !systems[id]
    toast(systems[id] ? `${def.label} open` : `${def.label} closed`)
    beep(880, 0.04)
    setTimeout(() => beep(990, 0.04), 60)
  } else {
    systems[id] = !systems[id]
    const on = systems[id]
    toast(`${def.label} ${on ? "ON" : "OFF"}`)
    beep(on ? 700 : 420, 0.06)
  }

  if ((id === "landing" || id === "landingL" || id === "landingR") && player) {
    systems.landing = player.controls.lights > 0.5
  }
  refreshSysPanel()
}

function applyAutopilot(dt, speed) {
  if (!ap.on || grounded || recovering) return
  const flight = player.def.flight
  const pilot = Math.max(Math.abs(held.pitch), Math.abs(held.roll), Math.abs(held.yaw))
  const keysPilot = keys.has("KeyW") || keys.has("KeyS") || keys.has("KeyA") || keys.has("KeyD")
    || keys.has("ArrowUp") || keys.has("ArrowDown") || keys.has("ArrowLeft") || keys.has("ArrowRight")
    || keys.has("KeyQ") || keys.has("KeyE")
  if (pilot > 0.45 || keysPilot) {
    disengageAp("Autopilot kicked off — you took the stick.")
    return
  }

  forward.set(0, 0, 1).applyQuaternion(player.root.quaternion)
  up.set(0, 1, 0).applyQuaternion(player.root.quaternion)
  right.set(1, 0, 0).applyQuaternion(player.root.quaternion)
  const bankRad = Math.atan2(right.y, up.y)
  const pitchNow = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1))
  const hdg = currentHeadingDeg()
  let hdgErr = ((ap.targetHdg - hdg + 540) % 360) - 180
  const alt = currentAltM()
  const altErr = ap.targetAlt - alt

  if (ap.hdg) {
    const wantBank = THREE.MathUtils.clamp(hdgErr * 0.035, -0.55, 0.55)
    const bankErr = wantBank - bankRad
    stick.roll = THREE.MathUtils.clamp(stick.roll + bankErr * 1.8, -1, 1)
    if (Math.abs(hdgErr) > 8) stick.yaw = THREE.MathUtils.clamp(stick.yaw + Math.sign(hdgErr) * 0.25, -1, 1)
  } else {
    stick.roll = THREE.MathUtils.clamp(stick.roll - bankRad * 1.2, -1, 1)
  }

  if (ap.alt) {
    const wantPitch = THREE.MathUtils.clamp(altErr * 0.004, -0.22, 0.28)
    const climbHelp = THREE.MathUtils.clamp(-velocity.y * 0.04, -0.15, 0.15)
    stick.pitch = THREE.MathUtils.clamp(stick.pitch + (wantPitch + climbHelp - pitchNow) * 2.2, -1, 1)
  }

  if (ap.spd) {
    const spdErr = ap.targetSpd - speed
    throttle = THREE.MathUtils.clamp(throttle + spdErr * 0.012 * dt * 60, 0.15, 1)
    // Don't fly into a stall on AP.
    if (speed < flight.stall * 1.15) throttle = Math.max(throttle, 0.7)
  }
}

function resetToRunway(message) {
  if (outside) enterPlane({ quiet: true })
  outside = false
  chuteOpen = false
  pilotVel.set(0, 0, 0)
  if (pilot) {
    pilot.root.visible = false
    pilot.chute.visible = false
  }
  velocity.set(0, 0, 0)
  throttle = 0
  takeoffBoost = 0
  rotateWait = 0
  wasAirborne = false
  grounded = true
  systems.parking = false
  ap.on = false
  clearCautions()
  resetControls(player)
  place(player, localOrigin.x + 0, localOrigin.z + 80, 0)
  player.setCockpit(cameraMode === 1)
  snapCam = true
  refreshApPanel()
  if (message) toast(message)
}

function startFlight() {
  if (!player) return
  world.resetRings()
  distance = 0
  toldRotate = false
  coachOn = true
  cameraMode = 0
  recovering = false
  resetToRunway()
  mode = "fly"
  menu.hidden = true
  const settingsPage = document.getElementById("settings-page")
  if (settingsPage) settingsPage.hidden = true
  hud.hidden = false
  document.getElementById("coach").hidden = false
  document.getElementById("hud-name").textContent = isAirliner(player.def)
    ? `${player.def.name} · ${AIRLINE_NAME}`
    : player.def.name
  document.getElementById("hints").textContent = hintLine(player.def)
  renderPartButtons()
  refreshSysPanel()
  refreshWxPanel()
  refreshFlyActions()
  ensureAudio()
}

function clearCautions() {
  for (const el of document.querySelectorAll("#cautions .caution")) el.classList.remove("on")
  flightInfo.warnings = []
  flightInfo.bank = 0
  flightInfo.aoa = 0
  flightInfo.windshear = false
  lastCallout = ""
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel()
}

function showMenu() {
  if (mode === "fly" && distance > 80) {
    toast(`You flew ${(distance / 1000).toFixed(1)} km in the ${player.def.name}.`)
  }
  if (outside) enterPlane({ quiet: true })
  outside = false
  chuteOpen = false
  if (pilot) {
    pilot.root.visible = false
    pilot.chute.visible = false
  }
  mode = "menu"
  hud.hidden = true
  menu.hidden = false
  const settingsPage = document.getElementById("settings-page")
  if (settingsPage) settingsPage.hidden = true
  velocity.set(0, 0, 0)
  ap.on = false
  clearCautions()
  refreshApPanel()
  refreshWxPanel()
  player.setCockpit(false)
  camera.up.set(0, 1, 0)
  camera.fov = 68
  camera.updateProjectionMatrix()
  place(player, PAD.x, PAD.z, 0.4)
  snapCam = true
  cameraMode = 0
}

/** Exactly 16 cameras — press C to cycle. */
const CAMERA_NAMES = [
  "Chase view",
  "Cockpit view",
  "Tower view",
  "Left wingtip",
  "Right wingtip",
  "Nose cam",
  "Tail cam",
  "Belly cam",
  "Top cam",
  "Orbit cam",
  "Spot view",
  "Far chase",
  "Runway approach",
  "Cabin window",
  "Engine pod",
  "Pad overlook",
]
const LOCKED_CAMS = new Set([1, 3, 4, 5, 6, 7, 8, 13, 14])

function camLabel() {
  if (outside) return chuteOpen ? "On foot · Parachute (FP)" : "On foot · First person"
  return `Cam ${cameraMode + 1}/${CAMERA_NAMES.length} · ${CAMERA_NAMES[cameraMode]}`
}

function isOrbitCam() {
  return mode === "fly" && cameraMode === ORBIT_CAM
}

function isCockpitCam() {
  return mode === "fly" && cameraMode === COCKPIT_CAM
}

function resetFlyOrbit() {
  if (!player) return
  const def = player.def
  flyOrbitDist = Math.max(18, def.length * 1.4, def.wing.span * 0.7)
  orbitYaw = Math.PI * 0.75
  orbitPitch = 0.32
  orbitAuto = true
}

function resetCockpitLook() {
  cockLookYaw = 0
  cockLookPitch = 0.02
}

function cycleCamera() {
  if (outside) return
  cameraMode = (cameraMode + 1) % CAMERA_NAMES.length
  player.setCockpit(cameraMode === COCKPIT_CAM)
  camera.up.set(0, 1, 0)
  camera.fov = cameraMode === COCKPIT_CAM ? 75 : 68
  camera.near = cameraMode === COCKPIT_CAM ? 0.05 : 0.08
  camera.updateProjectionMatrix()
  snapCam = true
  if (cameraMode === ORBIT_CAM) {
    resetFlyOrbit()
    toast("Orbit cam — drag to look around, scroll to zoom")
  } else if (cameraMode === COCKPIT_CAM) {
    resetCockpitLook()
    toast("Cockpit — drag to look left, right, up, and down")
  } else {
    toast(camLabel())
  }
  const camEl = document.getElementById("hud-cam")
  if (camEl) camEl.textContent = camLabel()
  refreshFlyActions()
}

function crash(message) {
  if (recovering || mode !== "fly") return
  recovering = true
  velocity.set(0, 0, 0)
  toast(message)
  beep(90, 0.35, "sawtooth")
  setTimeout(() => {
    if (mode === "fly") resetToRunway()
    recovering = false
  }, 700)
}

let audioCtx
let engineOsc
let engineGain
let engineFilter
let master

function setupAudio() {
  if (audioCtx) return
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return
  audioCtx = new AudioContext()
  master = audioCtx.createGain()
  master.gain.value = 0.8
  master.connect(audioCtx.destination)
  engineOsc = audioCtx.createOscillator()
  engineFilter = audioCtx.createBiquadFilter()
  engineFilter.type = "lowpass"
  engineGain = audioCtx.createGain()
  engineGain.gain.value = 0
  engineOsc.type = "triangle"
  engineOsc.frequency.value = 70
  engineOsc.connect(engineFilter)
  engineFilter.connect(engineGain)
  engineGain.connect(master)
  engineOsc.start()
}

function ensureAudio() {
  setupAudio()
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume()
}

function beep(freq, dur, type = "sine") {
  if (!audioCtx || muted) return
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.value = 0.07
  osc.connect(gain)
  gain.connect(master)
  osc.start()
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur)
  osc.stop(audioCtx.currentTime + dur)
}

function updateAudio(craft, engineThrottle, speed) {
  if (!audioCtx) return
  const jet = craft.def.engines.some((engine) => engine.kind === "jet")
  const now = audioCtx.currentTime
  engineOsc.type = jet ? "sawtooth" : "triangle"
  engineOsc.frequency.setTargetAtTime(jet ? 78 + engineThrottle * 190 + speed * 0.12 : 52 + engineThrottle * 120 + speed * 0.25, now, 0.08)
  engineFilter.frequency.setTargetAtTime(jet ? 380 + engineThrottle * 2400 : 180 + engineThrottle * 760, now, 0.08)
  const volume = muted || mode !== "fly" ? (mode === "menu" && !muted ? 0.012 : 0) : 0.02 + engineThrottle * 0.055
  engineGain.gain.setTargetAtTime(volume, now, 0.08)
}

function toggleMute() {
  muted = !muted
  const muteBtn = document.getElementById("mute-btn")
  if (muteBtn) muteBtn.textContent = muted ? "Sound off" : "Sound on"
}

function goCockpitView() {
  if (mode !== "fly" || !player || outside) return
  cameraMode = COCKPIT_CAM
  player.setCockpit(true)
  camera.fov = 75
  camera.near = 0.05
  camera.updateProjectionMatrix()
  resetCockpitLook()
  snapCam = true
  refreshFlyActions()
  toast("Cockpit — drag to look around")
}

function goOrbitView() {
  if (mode !== "fly" || !player || outside) return
  cameraMode = ORBIT_CAM
  player.setCockpit(false)
  camera.fov = 68
  camera.near = 0.08
  camera.updateProjectionMatrix()
  resetFlyOrbit()
  snapCam = true
  refreshFlyActions()
  toast("Orbit cam — drag and scroll")
}

function refreshFlyActions() {
  const jump = document.getElementById("fly-jump")
  const run = document.getElementById("fly-run")
  const cam = document.getElementById("fly-cam")
  const cockpit = document.querySelector('#fly-actions [data-fly="cockpit"]')
  const orbit = document.querySelector('#fly-actions [data-fly="orbit"]')
  if (jump) {
    jump.textContent = outside ? (chuteOpen ? "Board" : "Get in") : "Jump"
    jump.classList.toggle("armed", jTapArmed)
  }
  if (run) {
    run.hidden = !(mode === "fly" && outside && !chuteOpen)
    if (run.hidden) {
      held.run = 0
      run.classList.remove("held")
    }
  }
  if (cam) cam.textContent = outside ? "Look" : `Cam ${cameraMode + 1}`
  if (cockpit) cockpit.hidden = outside
  if (orbit) orbit.hidden = outside
  const muteBtn = document.getElementById("mute-btn")
  if (muteBtn) muteBtn.textContent = muted ? "Sound off" : "Sound on"
}

function bindFlyActions() {
  const panel = document.getElementById("fly-actions")
  if (!panel) return
  panel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-fly]")
    if (!button || mode !== "fly") return
    ensureAudio()
    const action = button.dataset.fly
    if (action === "hangar") showMenu()
    else if (action === "cam") cycleCamera()
    else if (action === "cockpit") goCockpitView()
    else if (action === "orbit") goOrbitView()
    else if (action === "jump") onJumpKey()
    else if (action === "reset") resetToRunway("Back on the runway.")
    else if (action === "mute") toggleMute()
    button.blur()
  })
  // Top bar cam chip also cycles views.
  const hudCam = document.getElementById("hud-cam")
  if (hudCam) {
    hudCam.tabIndex = 0
    hudCam.setAttribute("role", "button")
    hudCam.title = "Tap to cycle camera"
    hudCam.addEventListener("click", () => {
      if (mode !== "fly" || outside) return
      ensureAudio()
      cycleCamera()
    })
  }
}

function obstacleAt(position) {
  for (const obstacle of world.obstacles) {
    const dx = position.x - obstacle.x
    const dz = position.z - obstacle.z
    const dist = Math.hypot(dx, dz)
    if (obstacle.type === "cylinder" && dist < obstacle.r && position.y < obstacle.h) return obstacle
    if (obstacle.type === "cone" && position.y < obstacle.h && dist < obstacle.r * (1 - Math.max(0, position.y) / obstacle.h)) return obstacle
  }
  return null
}

function crashMessage(obstacle) {
  if (obstacle.name === "tower") return "The tower is in the way. Back to the runway."
  if (obstacle.name === "hangar") return "That hangar is closed. Back to the runway."
  if (obstacle.name === "mountain") return "That hill is solid. Back to the runway."
  return "The city is not a runway. Back to the runway."
}

function readStick() {
  stick.pitch = held.pitch
  stick.roll = held.roll
  stick.yaw = held.yaw
  if (keys.has("KeyW") || keys.has("ArrowUp")) stick.pitch += 1
  if (keys.has("KeyS") || keys.has("ArrowDown")) stick.pitch -= 1
  if (keys.has("KeyA") || keys.has("ArrowLeft")) stick.roll -= 1
  if (keys.has("KeyD") || keys.has("ArrowRight")) stick.roll += 1
  if (keys.has("KeyQ")) stick.yaw -= 1
  if (keys.has("KeyE")) stick.yaw += 1
  stick.pitch = THREE.MathUtils.clamp(stick.pitch, -1, 1)
  stick.roll = THREE.MathUtils.clamp(stick.roll, -1, 1)
  stick.yaw = THREE.MathUtils.clamp(stick.yaw, -1, 1)
  braking = held.brake > 0 || keys.has("Space") || !!systems.parking
}

function stepFlight(dt) {
  const def = player.def
  const flight = def.flight
  readStick()
  if (!ap.on || !ap.spd) {
    if (held.throttle > 0 || keys.has("ShiftLeft") || keys.has("ShiftRight")) throttle += dt * 0.45
    if (held.throttle < 0 || keys.has("ControlLeft") || keys.has("ControlRight")) throttle -= dt * 0.45
    if (keys.has("KeyX")) throttle = 1
    if (keys.has("KeyZ")) throttle = 0
  }
  throttle = THREE.MathUtils.clamp(throttle, 0, 1)

  const speed = velocity.length()
  applyAutopilot(dt, speed)

  const pushingDown = stick.pitch < -0.2
  if (grounded && throttle > 0.55 && speed > flight.rotate * 0.82 && !pushingDown) rotateWait += dt
  else if (!grounded || throttle < 0.4) rotateWait = 0
  const wantsUp = !pushingDown && (stick.pitch > 0.12 || rotateWait > 1.6)
  const rotating = grounded && throttle > 0.35 && speed > flight.rotate * 0.82 && wantsUp && player.gearT > 0.55
  if (rotating && stick.pitch < 0.45) stick.pitch = 0.7

  const authority = grounded ? 0.35 : THREE.MathUtils.clamp(speed / Math.max(12, flight.stall), 0.35, 1)
  const pitchAuth = grounded ? (speed > flight.rotate * 0.55 ? 1 : 0.55) : authority
  player.root.rotateX(-stick.pitch * flight.pitch * pitchAuth * dt)
  player.root.rotateZ(-stick.roll * flight.roll * (grounded ? 0.2 : authority) * dt)
  const steer = stick.yaw + stick.roll * (grounded ? 1 : 0.45)
  player.root.rotateY(steer * flight.yaw * (grounded ? 1 : authority) * dt * (grounded ? Math.min(1, 0.25 + speed / 30) : 1))

  forward.set(0, 0, 1).applyQuaternion(player.root.quaternion)
  if (grounded) {
    const pitchNow = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1))
    const maxPitch = speed > flight.rotate * 0.8 ? 0.32 : 0.1
    if (pitchNow > maxPitch) player.root.rotateX(pitchNow - maxPitch)
  }

  forward.set(0, 0, 1).applyQuaternion(player.root.quaternion)
  up.set(0, 1, 0).applyQuaternion(player.root.quaternion)
  right.set(1, 0, 0).applyQuaternion(player.root.quaternion)

  const bankRad = Math.atan2(right.y, up.y)
  const bankCos = Math.max(0.2, Math.abs(Math.cos(bankRad)))
  let stallSpeed = flight.stall * (1 - player.flapT * 0.28) / Math.sqrt(bankCos)
  if (player.spoilerT > 0.2) stallSpeed *= 1.08

  let aoa = 0
  if (!grounded && speed > 1.5) {
    const pathPitch = Math.asin(THREE.MathUtils.clamp(velocity.y / speed, -1, 1))
    const nosePitch = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1))
    aoa = nosePitch - pathPitch
  }
  flightInfo.bank = bankRad
  flightInfo.aoa = aoa
  flightInfo.stallSpeed = stallSpeed

  if (!grounded && Math.abs(stick.roll) < 0.08) {
    player.root.rotateZ(-bankRad * flight.stability * dt)
  }
  if (!grounded && Math.abs(stick.pitch) < 0.08 && speed > 8) {
    const currentPitch = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1))
    const targetPitch = THREE.MathUtils.clamp((flight.cruise * 0.92 - speed) / flight.cruise, -0.18, 0.22) * 0.35
    player.root.rotateX(-(targetPitch - currentPitch) * flight.stability * 0.8 * dt)
    forward.set(0, 0, 1).applyQuaternion(player.root.quaternion)
    up.set(0, 1, 0).applyQuaternion(player.root.quaternion)
    right.set(1, 0, 0).applyQuaternion(player.root.quaternion)
  }

  const stalling = !grounded && (speed < stallSpeed * 1.05 || aoa > 0.26)
  if (stalling) {
    player.root.rotateX(1.1 * dt * Math.max(0.2, 1 - speed / Math.max(1, stallSpeed)))
    player.root.rotateZ(Math.sin(performance.now() * 0.028) * 0.35 * dt)
    forward.set(0, 0, 1).applyQuaternion(player.root.quaternion)
    up.set(0, 1, 0).applyQuaternion(player.root.quaternion)
    right.set(1, 0, 0).applyQuaternion(player.root.quaternion)
  }

  const flying = THREE.MathUtils.clamp(speed / Math.max(8, stallSpeed), 0, 1)
  const bankLift = THREE.MathUtils.clamp(up.y, 0, 1)
  const aoaLift = stalling ? 0.15 : THREE.MathUtils.clamp(1 - Math.abs(aoa) * 1.4, 0.35, 1)

  let dragK = flight.drag
  dragK *= 1 + player.flapT * 0.75
  if (player.doorT > 0.2) dragK += flight.drag * 0.45
  if (player.cargoT > 0.2) dragK += flight.drag * 0.35
  if (player.spoilerT > 0.2) dragK += flight.drag * 0.9
  if (player.noseT > 0.2) dragK += flight.drag * 0.12
  if (!grounded && def.gear.mode === "retract" && player.gearT > 0.25) dragK += flight.drag * 0.28
  if (braking) dragK += flight.drag * 1.2
  if (stalling) dragK *= 1.35
  if (speed > flight.cruise * 1.4) dragK *= 1.2

  const weather = sampleWind(player.root.position, wind)
  const shearHit = !grounded && weather.shear > 0.35

  velocity.addScaledVector(forward, ((throttle * flight.thrust) / flight.mass) * dt)
  velocity.y -= 9.81 * dt
  if (!grounded || rotating) velocity.y += 9.81 * flying * bankLift * aoaLift * dt
  if (rotating) velocity.y = Math.max(velocity.y, 4)
  if (stalling) velocity.y -= 4.5 * dt
  // Air mass moves the plane; shear layers shove harder when you cross them.
  if (!grounded) {
    const windBlend = 1 - Math.exp(-dt * (shearHit ? 2.4 : 0.55))
    velocity.x = THREE.MathUtils.lerp(velocity.x, velocity.x + wind.x, windBlend * 0.35)
    velocity.y = THREE.MathUtils.lerp(velocity.y, velocity.y + wind.y, windBlend * 0.45)
    velocity.z = THREE.MathUtils.lerp(velocity.z, velocity.z + wind.z, windBlend * 0.35)
    if (shearHit) {
      velocity.y += wind.y * 1.8 * dt
      velocity.addScaledVector(right, Math.sin(performance.now() * 0.01) * weather.shear * 8 * dt)
      player.root.rotateX(Math.sin(performance.now() * 0.02) * 0.22 * weather.shear * dt)
      player.root.rotateZ(Math.cos(performance.now() * 0.018) * 0.28 * weather.shear * dt)
      forward.set(0, 0, 1).applyQuaternion(player.root.quaternion)
      up.set(0, 1, 0).applyQuaternion(player.root.quaternion)
      right.set(1, 0, 0).applyQuaternion(player.root.quaternion)
    }
  }
  if (!grounded && speed > 10) {
    const align = stalling ? 0.35 : shearHit ? 0.7 : 1.5
    const aimed = forward.clone().multiplyScalar(Math.max(8, velocity.length()))
    velocity.lerp(aimed, 1 - Math.exp(-dt * align))
  }
  if (!grounded && Math.abs(bankRad) > 0.2) {
    velocity.addScaledVector(right, Math.sin(bankRad) * speed * 0.35 * dt)
  }
  const spd = velocity.length()
  if (spd > 0.01) {
    const dragAcc = (dragK * spd * spd) / flight.mass
    const dragScale = Math.min(0.85, (dragAcc * dt) / spd)
    velocity.addScaledVector(velocity, -dragScale)
  }
  if (!Number.isFinite(velocity.x) || !Number.isFinite(velocity.y) || !Number.isFinite(velocity.z)) velocity.set(0, 0, 0)

  const maxV = flight.cruise * 1.7
  if (velocity.length() > maxV) velocity.multiplyScalar(maxV / velocity.length())

  const previousY = player.root.position.y
  player.root.position.addScaledVector(velocity, dt)
  distance += velocity.length() * dt

  const clearance = clearanceOf(player)
  const sink = velocity.y
  const hitGround = player.root.position.y <= clearance

  if (hitGround && !rotating && sink <= 0.4) {
    const impact = sink
    const hard = wasAirborne && impact < -12
    const belly = player.gearT < 0.45 && wasAirborne && impact < -7
    if ((hard || belly) && speed > 16) {
      crash(belly ? "The gear was up. Let's try that landing again." : "That landing was too hard. Let's try again.")
      return
    }
    player.root.position.y = clearance
    if (wasAirborne && speed > 18) {
      const level = Math.abs(right.y) < 0.4 && forward.y < 0.5 && forward.y > -0.25
      if (player.gearT > 0.7 && world.onRunway(player.root.position.x, player.root.position.z) && level && impact > -2.4) {
        toast("Butter landing!")
        beep(880, 0.12)
        setTimeout(() => beep(1180, 0.16), 120)
      } else if (impact > -5) toast("Nice landing.")
      else toast("A bit firm, but you are down.")
      if (player.gearT < 0.45) toast("Gear is up. You are sliding on the belly.")
      wasAirborne = false
    }
    grounded = true
    velocity.y = 0
    const heading = new THREE.Vector3(forward.x, 0, forward.z)
    if (heading.lengthSq() > 0.0001) {
      heading.normalize()
      let along = velocity.x * heading.x + velocity.z * heading.z
      along = Math.max(0, along)
      if (braking) along *= Math.max(0, 1 - dt * 2.4)
      if (throttle < 0.04) along *= Math.max(0, 1 - dt * 0.7)
      velocity.x = heading.x * along
      velocity.z = heading.z * along
    }
  } else {
    if (player.root.position.y < clearance) player.root.position.y = clearance
    grounded = false
    if (previousY <= clearance + 0.3) takeoffBoost = 2.4
  }

  if (!grounded && player.root.position.y > clearance + 8) wasAirborne = true
  if (takeoffBoost > 0) takeoffBoost -= dt

  if (mode !== "fly" || recovering) return
  nose.copy(player.root.position).addScaledVector(forward, def.length * 0.32)
  const hit = obstacleAt(player.root.position) || obstacleAt(nose)
  if (hit) {
    if (speed > 15) crash(crashMessage(hit))
    else velocity.multiplyScalar(-0.15)
  }
  const px = player.root.position.x
  const pz = player.root.position.z
  if (
    !world.onRunway(px, pz) &&
    world.overWater(px, pz) &&
    player.root.position.y < clearance + 1.5 &&
    speed > 10
  ) {
    crash("The water is for boats. Back to the runway.")
  }

  let collected = 0
  for (const ring of world.rings) {
    if (ring.got) {
      collected += 1
      continue
    }
    const dx = player.root.position.x - ring.x
    const dy = player.root.position.y - ring.y
    const dz = player.root.position.z - ring.z
    if (dx * dx + dy * dy + dz * dz < (ring.r * 0.72) ** 2) {
      ring.got = true
      ring.mesh.material.color.set(0xf0a202)
      collected += 1
      toast(collected === world.rings.length ? "You flew the whole course!" : `Ring ${collected} of ${world.rings.length}`)
      beep(660, 0.12)
      setTimeout(() => beep(880, 0.14), 90)
    }
  }

  if (!toldRotate && grounded && throttle > 0.75 && speed > flight.rotate) {
    toldRotate = true
    toast("Pull back to take off.")
  }
  updateWarnings(dt, velocity.length(), stallSpeed, bankRad, aoa, player.root.position.y - clearance, weather.shear)
}

function attachLookForward(def, ahead = 50) {
  look.set(0, def.radius * 0.15, ahead)
  player.root.localToWorld(look)
  camUp.set(0, 1, 0).applyQuaternion(player.root.quaternion)
  camera.up.copy(camUp)
}

function updateCamera(dt) {
  const def = player.def
  const pos = player.root.position
  const locked = LOCKED_CAMS.has(cameraMode)
  if (mode === "menu") {
    if (!dragging) orbitYaw += dt * 0.15
    const y = pos.y
    desiredCam.set(
      PAD.x + Math.sin(orbitYaw) * Math.cos(orbitPitch) * orbitDist,
      y + def.radius + Math.sin(orbitPitch) * orbitDist * 0.72,
      PAD.z + Math.cos(orbitYaw) * Math.cos(orbitPitch) * orbitDist
    )
    look.copy(pos)
    camera.up.set(0, 1, 0)
  } else if (outside && pilot?.root.visible) {
    const p = pilot.root.position
    const eyeY = p.y + (chuteOpen ? 1.5 : 1.55)
    desiredCam.set(p.x, Math.max(0.4, eyeY), p.z)
    const lookDir = new THREE.Vector3(
      Math.sin(walkLookYaw) * Math.cos(walkLookPitch),
      Math.sin(walkLookPitch),
      Math.cos(walkLookYaw) * Math.cos(walkLookPitch)
    )
    look.copy(desiredCam).addScaledVector(lookDir, 40)
    camera.up.set(0, 1, 0)
    camera.fov = 75
    camera.updateProjectionMatrix()
    snapCam = true
  } else if (cameraMode === COCKPIT_CAM) {
    const off = player.cockpit?.eyeOffset
    const eye = off
      ? new THREE.Vector3(off.x, player.seat.y + off.y, player.seat.z + off.z)
      : new THREE.Vector3(0, player.seat.y + 0.42, player.seat.z + 0.12)
    player.root.localToWorld(eye)
    desiredCam.copy(eye)
    // Look around from the seat: yaw left/right, pitch up/down.
    const lookLocal = new THREE.Vector3(
      Math.sin(cockLookYaw) * Math.cos(cockLookPitch),
      Math.sin(cockLookPitch),
      Math.cos(cockLookYaw) * Math.cos(cockLookPitch)
    )
    look.copy(eye).add(lookLocal.applyQuaternion(player.root.quaternion).multiplyScalar(40))
    camUp.set(0, 1, 0).applyQuaternion(player.root.quaternion)
    camera.up.copy(camUp)
    camera.fov = 75
    camera.near = 0.05
    camera.updateProjectionMatrix()
  } else if (cameraMode === 2) {
    const tower = world.towerPos || { x: 115, y: 48, z: 160 }
    desiredCam.set(tower.x, tower.y, tower.z)
    look.copy(pos)
    camera.up.set(0, 1, 0)
  } else if (cameraMode === 3) {
    desiredCam.set(-def.wing.span * 0.48, def.wing.y + def.radius * 0.35, def.wing.z)
    desiredCam.applyQuaternion(player.root.quaternion).add(pos)
    look.set(0, def.radius * 0.2, def.length * 0.15)
    player.root.localToWorld(look)
    camUp.set(0, 1, 0).applyQuaternion(player.root.quaternion)
    camera.up.copy(camUp)
  } else if (cameraMode === 4) {
    desiredCam.set(def.wing.span * 0.48, def.wing.y + def.radius * 0.35, def.wing.z)
    desiredCam.applyQuaternion(player.root.quaternion).add(pos)
    look.set(0, def.radius * 0.2, def.length * 0.15)
    player.root.localToWorld(look)
    camUp.set(0, 1, 0).applyQuaternion(player.root.quaternion)
    camera.up.copy(camUp)
  } else if (cameraMode === 5) {
    desiredCam.set(0, def.radius * 0.15, def.length * 0.48)
    desiredCam.applyQuaternion(player.root.quaternion).add(pos)
    attachLookForward(def, def.length * 0.48 + 80)
  } else if (cameraMode === 6) {
    desiredCam.set(0, def.radius * 0.6, -def.length * 0.52)
    desiredCam.applyQuaternion(player.root.quaternion).add(pos)
    look.set(0, def.radius * 0.2, def.length * 0.2)
    player.root.localToWorld(look)
    camUp.set(0, 1, 0).applyQuaternion(player.root.quaternion)
    camera.up.copy(camUp)
  } else if (cameraMode === 7) {
    desiredCam.set(0, -def.radius * 1.4 - 2.5, 0)
    desiredCam.applyQuaternion(player.root.quaternion).add(pos)
    look.set(0, -def.radius, def.length * 0.3)
    player.root.localToWorld(look)
    camUp.set(0, 1, 0).applyQuaternion(player.root.quaternion)
    camera.up.copy(camUp)
  } else if (cameraMode === 8) {
    desiredCam.set(0, def.radius * 2.2 + 4, -def.length * 0.05)
    desiredCam.applyQuaternion(player.root.quaternion).add(pos)
    look.set(0, def.radius, def.length * 0.35)
    player.root.localToWorld(look)
    camUp.set(0, 1, 0).applyQuaternion(player.root.quaternion)
    camera.up.copy(camUp)
  } else if (cameraMode === ORBIT_CAM) {
    if (orbitAuto && !dragging) orbitYaw += dt * 0.28
    const dist = flyOrbitDist
    const cosP = Math.cos(orbitPitch)
    const sinP = Math.sin(orbitPitch)
    desiredCam.set(
      pos.x + Math.sin(orbitYaw) * cosP * dist,
      pos.y + def.radius * 0.4 + Math.max(2.5, sinP * dist),
      pos.z + Math.cos(orbitYaw) * cosP * dist
    )
    if (desiredCam.y < 1.2) desiredCam.y = 1.2
    look.copy(pos)
    look.y += def.radius * 0.35
    camera.up.set(0, 1, 0)
  } else if (cameraMode === 10) {
    desiredCam.set(def.wing.span * 0.85 + 8, def.radius + 4, -def.length * 0.2)
    desiredCam.applyQuaternion(player.root.quaternion).add(pos)
    look.set(0, def.radius * 0.2, def.length * 0.1)
    player.root.localToWorld(look)
    camera.up.set(0, 1, 0)
  } else if (cameraMode === 11) {
    const dist = Math.max(40, def.length * 2.4 + 20, def.wing.span)
    const height = Math.max(def.radius * 2 + 8, dist * 0.22)
    desiredCam.set(0, height, -dist)
    desiredCam.applyQuaternion(player.root.quaternion).add(pos)
    look.set(0, def.radius * 0.2, def.length * 0.1)
    player.root.localToWorld(look)
    camera.up.set(0, 1, 0)
  } else if (cameraMode === 12) {
    desiredCam.set(0, 18, -90)
    look.set(0, 2, 1200)
    camera.up.set(0, 1, 0)
  } else if (cameraMode === 13) {
    desiredCam.set(def.radius * 0.55, def.radius * 0.35, -def.length * 0.05)
    desiredCam.applyQuaternion(player.root.quaternion).add(pos)
    look.set(def.radius * 4, def.radius * 0.2, def.length * 0.2)
    player.root.localToWorld(look)
    camUp.set(0, 1, 0).applyQuaternion(player.root.quaternion)
    camera.up.copy(camUp)
  } else if (cameraMode === 14) {
    const eng = (def.engines && def.engines[0]) || { x: -def.wing.span * 0.2, y: -def.radius * 0.5, z: 0 }
    desiredCam.set(eng.x * 1.15, eng.y - 1.2, eng.z - 4)
    desiredCam.applyQuaternion(player.root.quaternion).add(pos)
    look.set(eng.x, eng.y, eng.z + 30)
    player.root.localToWorld(look)
    camUp.set(0, 1, 0).applyQuaternion(player.root.quaternion)
    camera.up.copy(camUp)
  } else if (cameraMode === 15) {
    desiredCam.set(PAD.x + 90, 55, PAD.z + 140)
    look.copy(pos)
    camera.up.set(0, 1, 0)
  } else {
    const dist = Math.max(14, def.length * 1.05 + 8, def.wing.span * 0.45)
    const height = Math.max(def.radius * 1.25 + 1.8, dist * 0.15)
    desiredCam.set(0, height, -dist)
    desiredCam.applyQuaternion(player.root.quaternion).add(pos)
    look.set(0, def.radius * 0.2, def.length * 0.1)
    player.root.localToWorld(look)
    camera.up.set(0, 1, 0)
  }
  if (snapCam || locked) {
    camera.position.copy(desiredCam)
    snapCam = false
  } else {
    const blend = 1 - Math.exp(-dt * (
      cameraMode === ORBIT_CAM ? 10
        : mode === "fly" && (cameraMode === 0 || cameraMode === 11) ? 3
          : 6
    ))
    camera.position.lerp(desiredCam, blend)
  }
  if (mode === "fly" && (cameraMode === 0 || cameraMode === 11 || cameraMode === ORBIT_CAM) && camera.position.y < 1.4) {
    camera.position.y = 1.4
  }
  camera.lookAt(look)
}

function updateHud(speed) {
  document.getElementById("hud-speed").textContent = `${Math.round(speed * 3.6)}`
  // Height above the ground plane (runway / terrain at y = 0).
  const agl = Math.max(0, player.root.position.y - clearanceOf(player))
  document.getElementById("hud-alt").textContent = `${Math.round(agl)}`
  const climb = Math.round(velocity.y)
  document.getElementById("hud-vsi").textContent = `${climb > 0 ? "+" : ""}${climb}`
  const bankDeg = Math.round(THREE.MathUtils.radToDeg(flightInfo.bank))
  document.getElementById("hud-bank").textContent = `${bankDeg > 0 ? "+" : ""}${bankDeg}`
  document.getElementById("hud-aoa").textContent = `${Math.round(THREE.MathUtils.radToDeg(flightInfo.aoa))}`
  const heading = Math.round((THREE.MathUtils.radToDeg(Math.atan2(forward.x, forward.z)) + 360) % 360)
  document.getElementById("hud-head").textContent = String(heading).padStart(3, "0")
  const got = world.rings.filter((ring) => ring.got).length
  document.getElementById("hud-rings").textContent = `Rings ${got}/${world.rings.length}`
  const camEl = document.getElementById("hud-cam")
  if (camEl) camEl.textContent = camLabel()
  const regionEl = document.getElementById("hud-region")
  if (regionEl && world.nearestRegion) {
    regionEl.textContent = world.nearestRegion(player.root.position.x, player.root.position.z)
  }
  const slider = document.getElementById("throttle-slider")
  const knob = document.getElementById("throttle-knob")
  const fill = document.getElementById("throttle-fill")
  const travel = Math.max(0, slider.clientHeight - knob.offsetHeight)
  knob.style.bottom = `${throttle * travel}px`
  fill.style.height = `${Math.round(throttle * 100)}%`
  refreshPartButtons()
  const pitchDeg = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1)))
  const rollDeg = THREE.MathUtils.radToDeg(Math.atan2(-right.y, up.y))
  document.getElementById("adi-face").style.transform = `translateY(${pitchDeg * 1.6}px) rotate(${rollDeg}deg)`
  const coach = document.getElementById("coach")
  if (!grounded) coachOn = false
  coach.hidden = !coachOn || flightInfo.warnings.length > 0
  if (coachOn && grounded && velocity.length() > player.def.flight.rotate && throttle > 0.5) {
    coach.textContent = "You are fast enough. Pull back to take off."
  }
  refreshApPanel()
}

function craftInput(craft, engineThrottle, speed, isGrounded, flightStick) {
  const instruments = craft === player
    ? {
        bank: flightInfo.bank,
        pitch: Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1)),
        speed,
        alt: Math.max(0, craft.root.position.y - clearanceOf(craft)),
        heading: (THREE.MathUtils.radToDeg(Math.atan2(forward.x, forward.z)) + 360) % 360,
        throttle: engineThrottle,
        vsi: velocity.y,
        gear: craft.gearT > 0.55 ? "GEAR DN" : "GEAR UP",
        warn: flightInfo.warnings[0] || "",
        flap: craft.flapT,
        spoiler: craft.spoilerT,
        engines: craft.cockpit?.engineCount || craft.def.engines?.length || 2,
        ap: ap.on,
      }
    : null
  return {
    throttle: engineThrottle,
    speed,
    grounded: isGrounded,
    stick: flightStick,
    lights: craft.controls.lights,
    targets: targetsFrom(craft),
    warnings: craft === player ? flightInfo.warnings : [],
    instruments,
    systems: craft === player ? systems : null,
  }
}

function setCaution(id, on) {
  const el = document.querySelector(`#cautions [data-warn="${id}"]`)
  if (el) el.classList.toggle("on", !!on)
}

function updateWarnings(dt, speed, stallSpeed, bankRad, aoaRad, alt, shear = 0) {
  const warnings = []
  const bankDeg = Math.abs(THREE.MathUtils.radToDeg(bankRad))
  const aoaDeg = THREE.MathUtils.radToDeg(aoaRad)
  const stalling = !grounded && (speed < stallSpeed * 1.12 || aoaDeg > 14)
  const bankWarn = !grounded && bankDeg > 42
  const overspeed = speed > player.def.flight.cruise * 1.42
  const windshear = !grounded && shear > 0.35
  const terrain = !grounded && alt < 55 && velocity.y < -6
  const pullup = !grounded && alt < 28 && velocity.y < -10
  const gear = !grounded && player.def.gear.mode === "retract" && player.gearT < 0.45 && alt < 90 && throttle < 0.55 && velocity.y < 1
  const door = !grounded && player.doorT > 0.25 && speed > 25
  const flaps = !grounded && player.flapT > 0.55 && speed > player.def.flight.cruise * 1.05

  setCaution("stall", stalling)
  setCaution("bank", bankWarn)
  setCaution("overspeed", overspeed)
  setCaution("windshear", windshear)
  setCaution("terrain", terrain && !pullup)
  setCaution("pullup", pullup)
  setCaution("gear", gear)
  setCaution("door", door)
  setCaution("flaps", flaps)

  if (stalling) warnings.push("stall")
  if (bankWarn) warnings.push("bank")
  if (overspeed) warnings.push("overspeed")
  if (windshear) warnings.push("windshear")
  if (pullup) warnings.push("pullup")
  else if (terrain) warnings.push("terrain")
  if (gear) warnings.push("gear")
  if (door) warnings.push("door")
  if (flaps) warnings.push("flaps")
  flightInfo.warnings = warnings

  // Priority callouts, like a cockpit GPWS / windshear computer.
  if (pullup) speakCaution("Pull up. Pull up.")
  else if (windshear) speakCaution("Windshear. Windshear.")
  else if (stalling) speakCaution("Stall. Stall.")
  else if (terrain) speakCaution("Terrain. Terrain.")
  else if (bankWarn && bankDeg > 55) speakCaution("Bank angle.")
  else if (overspeed) speakCaution("Overspeed.")

  if (stalling) {
    stallTimer -= dt
    if (stallTimer <= 0) {
      beep(920, 0.08, "square")
      setTimeout(() => beep(720, 0.08, "square"), 90)
      stallTimer = 0.28
    }
  } else stallTimer = 0

  if (bankWarn) {
    bankTimer -= dt
    if (bankTimer <= 0) {
      beep(bankDeg > 60 ? 640 : 480, 0.1, "triangle")
      bankTimer = bankDeg > 60 ? 0.35 : 0.55
    }
  } else bankTimer = 0

  if (pullup || terrain) {
    terrainTimer -= dt
    if (terrainTimer <= 0) {
      beep(pullup ? 280 : 360, 0.16, "sawtooth")
      terrainTimer = pullup ? 0.32 : 0.55
    }
  } else terrainTimer = 0

  if (overspeed) {
    overspeedTimer -= dt
    if (overspeedTimer <= 0) {
      beep(1180, 0.06, "sine")
      overspeedTimer = 0.4
    }
  } else overspeedTimer = 0

  if (windshear) {
    windshearTimer -= dt
    if (windshearTimer <= 0) {
      beep(210, 0.14, "sawtooth")
      setTimeout(() => beep(160, 0.18, "sawtooth"), 120)
      windshearTimer = 0.48
    }
  } else windshearTimer = 0

  if (gear) {
    warnTimer -= dt
    if (warnTimer <= 0) {
      beep(520, 0.12, "square")
      warnTimer = 0.7
    }
  }
}

function animate() {
  requestAnimationFrame(animate)
  try {
  const dt = Math.min(0.033, Math.max(0.001, clock.getDelta()))
  if (mode === "fly" && !recovering) {
    if (outside) stepOutside(dt)
    else stepFlight(dt)
  } else if (player) {
    player.root.position.y = clearanceOf(player)
    readStick()
  }

  const showcaseThrottle = mode === "menu" ? 0.28 : (outside ? 0 : throttle)
  if (player) {
    updateAircraft(
      player,
      dt,
      craftInput(
        player,
        showcaseThrottle,
        mode === "fly" && !outside ? velocity.length() : 0,
        grounded || mode === "menu" || outside,
        mode === "fly" && !outside ? stick : { pitch: 0, roll: 0, yaw: 0 }
      )
    )
    if (mode === "menu" || outside) player.root.position.y = clearanceOf(player)
  }
  for (const craft of parked) {
    updateAircraft(craft, dt, craftInput(craft, 0, 0, true, { pitch: 0, roll: 0, yaw: 0 }))
  }
  for (const remote of remotes.values()) {
    if (!remote.craft?.root) continue
    if (remote.hasPose) {
      remote.craft.root.position.lerp(remote.targetPos, 1 - Math.exp(-12 * dt))
      remote.craft.root.quaternion.slerp(remote.targetQuat, 1 - Math.exp(-12 * dt))
    }
    remote.craft.root.visible = true
    const groundedRemote = remote.mode !== "fly" || remote.craft.root.position.y < clearanceOf(remote.craft) + 2
    updateAircraft(
      remote.craft,
      dt,
      craftInput(
        remote.craft,
        remote.throttle ?? 0.15,
        groundedRemote ? 0 : 40,
        groundedRemote,
        { pitch: 0, roll: 0, yaw: 0 }
      )
    )
    if (remote.plate) {
      remote.plate.lookAt(camera.position)
      const dist = camera.position.distanceTo(remote.craft.root.position)
      const scale = THREE.MathUtils.clamp(dist / 180, 1, 8)
      remote.plate.scale.setScalar(scale)
      remote.plate.position.y = 10 + scale * 2
    }
  }
  trafficUiAcc += dt
  if (trafficUiAcc > 0.35) {
    trafficUiAcc = 0
    refreshTrafficUi()
  }
  pushNetState(dt)
  world.update(dt)
  weather.update(dt, camera)
  if (player) {
    updateCamera(dt)
    const focus = player.root.position
    const span = Math.max(50, player.def.wing.span * 0.8)
    weather.sunFollow(focus)
    sun.target.position.set(focus.x, focus.y, focus.z)
    sun.shadow.camera.left = -span
    sun.shadow.camera.right = span
    sun.shadow.camera.top = span
    sun.shadow.camera.bottom = -span
    sun.shadow.camera.updateProjectionMatrix()
    updateAudio(player, showcaseThrottle, mode === "fly" ? velocity.length() : 0)
    if (mode === "fly") updateHud(velocity.length())
  }
  renderer.render(scene, camera)
  } catch (error) {
    console.error(error)
  }
}

const clock = new THREE.Clock()

let hangarReady = false

async function bootMenu() {
  if (hangarReady) return
  if (PLANES.length !== 7) throw new Error(`Expected 7 airliners, found ${PLANES.length}`)
  boot.hidden = false
  boot.textContent = "Loading hangar…"
  await preloadAircraftModels((done, total) => {
    boot.textContent = `Loading aircraft… ${done}/${total}`
  })
  list.innerHTML = ""
  buttons.length = 0
  let lastGroup = ""
  PLANES.forEach((def, index) => {
    if (def.group !== lastGroup) {
      const heading = document.createElement("h3")
      heading.textContent = def.group
      list.appendChild(heading)
      lastGroup = def.group
    }
    const button = document.createElement("button")
    button.type = "button"
    button.className = "plane-btn"
    button.dataset.index = String(index)
    button.innerHTML = `<span class="swatch"></span><span><strong>${def.name}</strong><small>${def.role}</small></span><span class="speed">${Math.round(def.flight.cruise * 3.6)} km/h</span>`
    const colors = loadAirlineColors()
    button.querySelector(".swatch").style.background = isAirliner(def)
      ? `linear-gradient(135deg, ${colors.fuselage}, ${colors.primary})`
      : `linear-gradient(135deg, ${def.body}, ${def.accent})`
    button.addEventListener("click", () => selectPlane(index))
    button.addEventListener("dblclick", () => {
      selectPlane(index)
      startFlight()
    })
    list.appendChild(button)
    buttons.push(button)
  })

  const parkedA = createAircraft(PLANES.find((plane) => plane.id === "a320"))
  const parkedB = createAircraft(PLANES.find((plane) => plane.id === "b737"))
  place(parkedA, PAD.x - 80, PAD.z + 250, 0.8)
  place(parkedB, PAD.x - 80, PAD.z + 340, -0.4)
  scene.add(parkedA.root, parkedB.root)
  parked.push(parkedA, parkedB)

  document.getElementById("fly-btn").addEventListener("click", startFlight)
  const settingsPage = document.getElementById("settings-page")
  document.getElementById("settings-open")?.addEventListener("click", () => {
    ensureAudio()
    menu.hidden = true
    settingsPage.hidden = false
    refreshAirportUi()
  })
  document.getElementById("settings-close")?.addEventListener("click", () => {
    settingsPage.hidden = true
    menu.hidden = false
  })
  document.getElementById("rename-btn")?.addEventListener("click", () => {
    const next = sanitizeName(document.getElementById("rename-input")?.value || playerName)
    playerName = next
    try { localStorage.setItem("tfs-player-name", playerName) } catch { /* ignore */ }
    if (net.online) net.rename(playerName)
    else world.setLocalAirport(world.localSlot || 0, playerName)
    localOrigin = { ...world.localOrigin }
    refreshAirportUi()
    toast(`Airport renamed: ${world.airportName}`)
  })
  bindFlyActions()
  document.getElementById("ap-master").addEventListener("click", () => {
    ensureAudio()
    toggleAutopilot()
  })
  document.getElementById("ap-hdg").addEventListener("click", () => {
    ensureAudio()
    if (!ap.on) toggleAutopilot()
    else {
      ap.hdg = !ap.hdg
      if (ap.hdg) ap.targetHdg = Math.round(currentHeadingDeg())
      refreshApPanel()
    }
  })
  document.getElementById("ap-alt").addEventListener("click", () => {
    ensureAudio()
    if (!ap.on) toggleAutopilot()
    else {
      ap.alt = !ap.alt
      if (ap.alt) ap.targetAlt = Math.max(30, Math.round(currentAltM()))
      refreshApPanel()
    }
  })
  document.getElementById("ap-spd").addEventListener("click", () => {
    ensureAudio()
    if (!ap.on) toggleAutopilot()
    else {
      ap.spd = !ap.spd
      if (ap.spd) ap.targetSpd = Math.max(player.def.flight.stall * 1.2, velocity.length())
      refreshApPanel()
    }
  })
  for (const button of document.querySelectorAll("[data-ap-adj]")) {
    button.addEventListener("click", () => {
      ensureAudio()
      adjustAp(button.dataset.apAdj, Number(button.dataset.dir))
    })
  }
  refreshApPanel()
  renderWxPanel()
  await restoreWeather()
  for (const id of ["airline-primary", "airline-secondary", "airline-fuselage"]) {
    document.getElementById(id).addEventListener("input", () => {
      repaintAirlineFleet(airlineColorsFromInputs())
    })
  }
  bindHoldButtons()
  bindJoystick()
  bindThrottle()

  selectPlane(0)
  boot.hidden = true
  hangarReady = true
  refreshAirportUi()
  animate()
}

function beginWithName(name) {
  playerName = sanitizeName(name)
  try { localStorage.setItem("tfs-player-name", playerName) } catch { /* ignore */ }
  document.getElementById("name-gate").hidden = true
  menu.hidden = false
  world.setLocalAirport(0, playerName)
  localOrigin = { ...world.localOrigin }
  if (player) place(player, PAD.x, PAD.z, 0.4)
  for (const craft of parked) {
    // Keep apron decor near the local pad when offline/before join assigns a slot.
  }
  place(parked[0], PAD.x - 80, PAD.z + 250, 0.8)
  place(parked[1], PAD.x - 80, PAD.z + 340, -0.4)
  refreshAirportUi()
  net.connect(playerName)
  const hint = document.getElementById("join-hint")
  if (hint) {
    const host = location.host || `127.0.0.1:8765`
    hint.textContent = location.hostname === "127.0.0.1" || location.hostname === "localhost"
      ? "Hosting locally — share your Wi‑Fi LAN address with friends (see Terminal)."
      : `Joined via ${host}`
  }
}

async function startApp() {
  menu.hidden = true
  const gate = document.getElementById("name-gate")
  gate.hidden = false
  let saved = ""
  try { saved = localStorage.getItem("tfs-player-name") || "" } catch { /* ignore */ }
  const input = document.getElementById("player-name")
  input.value = saved || "Demi"
  input.focus()
  input.select()
  let submitting = false
  document.getElementById("name-form").addEventListener("submit", async (event) => {
    event.preventDefault()
    if (submitting || hangarReady) return
    submitting = true
    const name = sanitizeName(input.value)
    if (name.length < 2) {
      submitting = false
      toast("Pick a name with at least 2 letters.")
      return
    }
    gate.hidden = true
    boot.hidden = false
    try {
      await bootMenu()
      beginWithName(name)
    } catch (error) {
      submitting = false
      boot.hidden = false
      boot.textContent = error && error.message ? error.message : "The hangar could not open."
      console.error(error)
    }
  })
}

startApp().catch((error) => {
  boot.hidden = false
  boot.textContent = error && error.message ? error.message : "The hangar could not open."
  console.error(error)
})

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

window.addEventListener("keydown", (event) => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault()
  const once = ["KeyG", "KeyF", "KeyO", "KeyP", "KeyU", "KeyN", "KeyL", "KeyC", "KeyR", "KeyM", "KeyB", "KeyJ", "Enter", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]
  if (event.repeat && once.includes(event.code)) return
  keys.add(event.code)
  ensureAudio()
  if (event.repeat) return
  if (mode === "menu") {
    if (event.code === "ArrowDown") selectRelative(1)
    else if (event.code === "ArrowUp") selectRelative(-1)
    else if (event.code === "Enter") startFlight()
    else if (player) tapPart(player, event.code)
    return
  }
  if (event.code === "Escape") showMenu()
  else if (event.code === "KeyR") resetToRunway("Back on the runway.")
  else if (event.code === "KeyC") cycleCamera()
  else if (event.code === "KeyM") toggleMute()
  else if (event.code === "KeyB") toggleAutopilot()
  else if (event.code === "KeyJ") onJumpKey()
  else if (player && !outside) tapPart(player, event.code)
})

window.addEventListener("keyup", (event) => keys.delete(event.code))
window.addEventListener("blur", () => {
  keys.clear()
  releaseTouch()
})

function releaseTouch() {
  held.pitch = 0
  held.roll = 0
  held.yaw = 0
  held.throttle = 0
  held.brake = 0
  held.run = 0
  joyPointer = null
  const knob = document.getElementById("joy-knob")
  if (knob) knob.style.transform = "translate(0px, 0px)"
  for (const button of document.querySelectorAll("#aux-pad button.held, #fly-actions button.held")) {
    button.classList.remove("held")
  }
}

function bindHoldButtons() {
  for (const button of document.querySelectorAll("[data-hold]")) {
    const apply = (value) => {
      const key = button.dataset.hold
      if (key === "brake") held.brake = value
      else held[key] = Number(button.dataset.value) * value
      button.classList.toggle("held", value > 0)
    }
    button.addEventListener("pointerdown", (event) => {
      apply(1)
      try { button.setPointerCapture(event.pointerId) } catch (error) { /* already released */ }
      event.preventDefault()
    })
    const clear = () => apply(0)
    button.addEventListener("pointerup", clear)
    button.addEventListener("pointercancel", clear)
  }
}

let joyPointer = null

function bindJoystick() {
  const joy = document.getElementById("joy")
  const knob = document.getElementById("joy-knob")
  const place = (event) => {
    const rect = joy.getBoundingClientRect()
    const radius = rect.width * 0.34
    let dx = event.clientX - (rect.left + rect.width / 2)
    let dy = event.clientY - (rect.top + rect.height / 2)
    const len = Math.hypot(dx, dy)
    if (len > radius && len > 0) {
      dx = (dx / len) * radius
      dy = (dy / len) * radius
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`
    const nx = radius > 0 ? dx / radius : 0
    const ny = radius > 0 ? -dy / radius : 0
    const dead = 0.14
    held.roll = Math.abs(nx) < dead ? 0 : THREE.MathUtils.clamp(nx, -1, 1)
    held.pitch = Math.abs(ny) < dead ? 0 : THREE.MathUtils.clamp(ny, -1, 1)
  }
  joy.addEventListener("pointerdown", (event) => {
    joyPointer = event.pointerId
    place(event)
    try { joy.setPointerCapture(event.pointerId) } catch (error) { /* already released */ }
    event.preventDefault()
  })
  joy.addEventListener("pointermove", (event) => {
    if (event.pointerId !== joyPointer) return
    place(event)
  })
  const end = (event) => {
    if (event.pointerId !== joyPointer) return
    joyPointer = null
    held.pitch = 0
    held.roll = 0
    knob.style.transform = "translate(0px, 0px)"
  }
  joy.addEventListener("pointerup", end)
  joy.addEventListener("pointercancel", end)
}

function bindThrottle() {
  const slider = document.getElementById("throttle-slider")
  const move = (event) => {
    const rect = slider.getBoundingClientRect()
    const next = 1 - (event.clientY - rect.top) / rect.height
    throttle = THREE.MathUtils.clamp(next, 0, 1)
  }
  slider.addEventListener("pointerdown", (event) => {
    move(event)
    try { slider.setPointerCapture(event.pointerId) } catch (error) { /* already released */ }
    event.preventDefault()
  })
  slider.addEventListener("pointermove", (event) => {
    if (!slider.hasPointerCapture(event.pointerId)) return
    move(event)
  })
}

const pointers = new Map()
let pinchDist = 0

canvas.addEventListener("contextmenu", (event) => event.preventDefault())
canvas.addEventListener("pointerdown", (event) => {
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  canvas.setPointerCapture(event.pointerId)
  event.preventDefault()
  if (pointers.size >= 2 && (mode === "menu" || isOrbitCam())) {
    const [a, b] = [...pointers.values()]
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
    return
  }
  dragging = true
  moved = 0
  lastX = event.clientX
  lastY = event.clientY
  if (isOrbitCam()) orbitAuto = false
})
canvas.addEventListener("pointermove", (event) => {
  const point = pointers.get(event.pointerId)
  if (!point) return
  const dx = event.clientX - point.x
  const dy = event.clientY - point.y
  point.x = event.clientX
  point.y = event.clientY
  moved += Math.abs(dx) + Math.abs(dy)
  if ((mode === "menu" || isOrbitCam()) && pointers.size >= 2) {
    const [a, b] = [...pointers.values()]
    const dist = Math.hypot(a.x - b.x, a.y - b.y)
    if (pinchDist > 0) {
      const delta = (pinchDist - dist) * 0.08
      if (isOrbitCam()) {
        flyOrbitDist = THREE.MathUtils.clamp(flyOrbitDist + delta, 8, 220)
        orbitAuto = false
      } else {
        orbitDist = THREE.MathUtils.clamp(orbitDist + delta, 12, 180)
      }
    }
    pinchDist = dist
    return
  }
  if (dragging && outside) {
    walkLookYaw -= dx * 0.0048
    walkLookPitch = THREE.MathUtils.clamp(walkLookPitch - dy * 0.0038, -1.15, 1.05)
    return
  }
  if (dragging && isCockpitCam()) {
    cockLookYaw -= dx * 0.0045
    cockLookPitch = THREE.MathUtils.clamp(cockLookPitch - dy * 0.0035, -0.85, 0.7)
    cockLookYaw = THREE.MathUtils.clamp(cockLookYaw, -1.35, 1.35)
    return
  }
  if (dragging && (mode === "menu" || isOrbitCam())) {
    orbitYaw -= dx * 0.006
    orbitPitch = THREE.MathUtils.clamp(orbitPitch + dy * 0.004, 0.05, 1.35)
    if (isOrbitCam()) orbitAuto = false
  }
})
canvas.addEventListener("pointerup", (event) => {
  pointers.delete(event.pointerId)
  if (pointers.size < 2) pinchDist = 0
  if (pointers.size > 0) return
  dragging = false
  if (moved > 8) return
  const rect = canvas.getBoundingClientRect()
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  )
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(scene.children, true)
  for (const hit of hits) {
    let node = hit.object
    while (node && !node.userData.group && !node.userData.sys) node = node.parent
    if (node?.userData.sys) {
      pressSys(node.userData.sys)
      break
    }
    if (node && node.userData.craft && node.userData.group) {
      toggle(node.userData.craft, node.userData.group)
      break
    }
  }
})
canvas.addEventListener("pointercancel", (event) => {
  pointers.delete(event.pointerId)
  if (pointers.size === 0) dragging = false
  pinchDist = 0
})
window.addEventListener("gesturestart", (event) => event.preventDefault())
window.addEventListener("touchmove", (event) => {
  const el = event.target
  if (!el || !el.closest) return
  if (el === canvas || el.closest("#controls, #throttle-panel")) event.preventDefault()
}, { passive: false })

canvas.addEventListener("wheel", (event) => {
  if (mode === "menu") {
    orbitDist = THREE.MathUtils.clamp(orbitDist + Math.sign(event.deltaY) * 1.5, 12, 180)
  } else if (isOrbitCam()) {
    flyOrbitDist = THREE.MathUtils.clamp(flyOrbitDist + Math.sign(event.deltaY) * 2.2, 8, 220)
    orbitAuto = false
  } else {
    throttle = THREE.MathUtils.clamp(throttle - Math.sign(event.deltaY) * 0.06, 0, 1)
  }
  event.preventDefault()
}, { passive: false })

