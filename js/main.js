import * as THREE from "three"
import { PLANES, partButtons, partSummary } from "./catalog.js"
import { createAircraft, disposeCraft, updateAircraft } from "./aircraft.js"
import { CARS, createCar, disposeCar, updateCar, isCar } from "./vehicles.js"
import { ensureModel, isModelCached, preloadAircraftModels, warmAircraftModels } from "./models.js"
import { PAD, RUNWAY, createWorld, updateLandingLights, WORLD_RADIUS, CONTINENTS, WORLD_AIRPORTS, START_BOUNDS, describePlace, prettyPlace, spawnBeside } from "./world.js?v=198"
import { COCKPIT_BUTTONS } from "./cockpitButtons.js"
import { createWeatherController } from "./weather.js"
import { createNet } from "./net.js"
import { sanitizeName, airportLabel } from "./airportSlots.js?v=196"
import { createCrashFx } from "./crashFx.js"

const FLEET = [...PLANES, ...CARS]

function findFleetDef(id) {
  return FLEET.find((v) => v.id === id) || PLANES[0]
}

function createVehicle(def) {
  return isCar(def) ? createCar(def) : createAircraft(def)
}

function disposeVehicle(craft) {
  if (!craft) return
  if (isCar(craft.def)) disposeCar(craft)
  else disposeCraft(craft)
}

function updateVehicle(craft, dt, input) {
  if (isCar(craft.def)) {
    updateCar(craft, dt, {
      ...input,
      steer: input.stick?.roll ?? input.stick?.yaw ?? input.steer ?? 0,
    })
  } else {
    updateAircraft(craft, dt, input)
  }
}

function playerIsCar() {
  return isCar(player?.def)
}

function actionVerb(def) {
  return isCar(def) ? "Drive" : "Fly"
}
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

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
  // Huge world + near cockpit camera — without this, ground planes z-fight / flicker.
  logarithmicDepthBuffer: true,
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.92
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0xb7c9d6, 1800, WORLD_RADIUS * 0.62)
scene.background = new THREE.Color(0x6fa8c8)

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.12, WORLD_RADIUS * 1.6)
const hemi = new THREE.HemisphereLight(0xc8dceb, 0x4a5e3a, 0.72)
const sun = new THREE.DirectionalLight(0xfff0d4, 2.05)
sun.castShadow = true
sun.shadow.mapSize.set(1024, 1024)
sun.shadow.bias = -0.0004
sun.shadow.normalBias = 0.05
sun.shadow.camera.near = 10
sun.shadow.camera.far = 700
scene.add(hemi, sun, sun.target)
const fill = new THREE.DirectionalLight(0xa8bdd4, 0.22)
fill.position.set(-180, 90, -120)
scene.add(fill)

// Built during bootMenu so the name gate can appear immediately.
let world = null
let weather = null
const keys = new Set()
const held = { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: 0, run: 0 }
const stick = { pitch: 0, roll: 0, yaw: 0 }
let planeQuery = ""
let swapQuery = ""
const velocity = new THREE.Vector3()
const forward = new THREE.Vector3()
const up = new THREE.Vector3()
const right = new THREE.Vector3()
const desiredCam = new THREE.Vector3()
const look = new THREE.Vector3()
const nose = new THREE.Vector3()
const camUp = new THREE.Vector3()
const trackDir = new THREE.Vector3()
let lastTrackYaw = null

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
  land: false,
  landPhase: null,
  landHdg: 0,
  landFix: null,
  landThresh: null,
  targetHdg: 0,
  targetAlt: 100,
  targetSpd: 55,
  landArm: 0,
  rolloutUntil: 0,
}
const LAND_FIX_DIST = 2800
const LAND_NAV_ALT = 280
const LAND_ALIGN_ALT = 140
const LAND_GLIDE_TAN = Math.tan((3.2 * Math.PI) / 180)
// Line up on the extended centerline while still at least 200 ft from the runway,
// then fly that heading straight. The descent itself is a shallow straight line.
const LAND_LINEUP_MIN = 200 * 0.3048
const LAND_STRAIGHT_TAN = Math.tan((2.5 * Math.PI) / 180)
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
let flyMoreOpen = false
let failOpen = false
let apOpen = false
let partsOpen = false
let chuteOpen = false
let pilot = null
const pilotVel = new THREE.Vector3()
const worldCars = []
let homeCraft = null
let playerName = "Pilot"
let localOrigin = { x: 0, z: 0 }
let startAt = { x: 0, z: 0 }
const remotes = new Map()
let netSyncAcc = 0
let trafficUiAcc = 0
let banUiAcc = 0
const tmpQuat = new THREE.Quaternion()

/** Promo unlocks — book is admin-only; codes still redeem if typed. */
const cheats = {
  admin: false,
  crashPhysics: false,
  turbo: false,
  slowmo: false,
}
/** Named codes shown in the admin book. */
const PROMO_BOOK = [
  { code: "demi", effect: "Admin — unlocks this list, ignores bans, shrugs crashes" },
  { code: "crash", effect: "Toggle cinematic crash physics (roll, fire, parts)" },
  { code: "ban", effect: "Lock yourself out for 10 minutes (admin ignores)" },
  { code: "unban", effect: "Clear an active ban timer" },
  { code: "turbo", effect: "Toggle 2× thrust / top speed" },
  { code: "fix", effect: "Clear every aircraft / car failure" },
  { code: "sky", effect: "Launch ~800 m up with climb speed (fly mode)" },
  { code: "home", effect: "Warp back to the hangar pad" },
  { code: "nofail", effect: "Turn random failures off" },
  { code: "hard", effect: "Turn random failures to hard mode" },
  { code: "storm", effect: "Switch weather to storm" },
  { code: "clear", effect: "Switch weather to clear skies" },
  { code: "slowmo", effect: "Toggle half-speed slow motion" },
]
/** Ninety million numbered codes: p1 … p90000000 (effect picked by number). */
const MEGA_PROMO_COUNT = 90_000_000
const MEGA_PROMO_EFFECTS = [
  { id: "boost", label: "Speed burst" },
  { id: "skyhop", label: "Altitude hop" },
  { id: "home", label: "Warp home" },
  { id: "fix", label: "Clear failures" },
  { id: "turbo", label: "Toggle turbo" },
  { id: "slowmo", label: "Toggle slow-mo" },
  { id: "crash", label: "Toggle crash physics" },
  { id: "nofail", label: "Failures off" },
  { id: "hard", label: "Failures hard" },
  { id: "clear", label: "Clear weather" },
  { id: "dawn", label: "Dawn weather" },
  { id: "windy", label: "Windy weather" },
  { id: "cloudy", label: "Cloudy weather" },
  { id: "rain", label: "Rain weather" },
  { id: "storm", label: "Storm weather" },
  { id: "fog", label: "Fog weather" },
  { id: "spin", label: "Yaw spin" },
  { id: "dive", label: "Nose dive kick" },
  { id: "climb", label: "Climb kick" },
  { id: "brake", label: "Full stop" },
]
let banUntil = 0
let crashTimer = 0
const crashSpin = new THREE.Vector3()
let crashRollAxis = new THREE.Vector3(1, 0, 0)
let crashGroundHits = 0
let crashFx = null
try {
  cheats.admin = localStorage.getItem("tfs-promo-admin") === "1"
  cheats.crashPhysics = localStorage.getItem("tfs-promo-crash") === "1"
  cheats.turbo = localStorage.getItem("tfs-promo-turbo") === "1"
  cheats.slowmo = localStorage.getItem("tfs-promo-slowmo") === "1"
  banUntil = Number(localStorage.getItem("tfs-ban-until") || 0) || 0
  localStorage.removeItem("tfs-promo-ghost")
} catch { /* ignore */ }

function banRemainingMs() {
  return Math.max(0, banUntil - Date.now())
}

function isBanned() {
  if (cheats.admin) return false
  return banRemainingMs() > 0
}

function formatBanClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function refreshBanLock() {
  const lock = document.getElementById("ban-lock")
  const left = document.getElementById("ban-left")
  if (!lock) return
  if (!isBanned()) {
    if (banUntil) {
      banUntil = 0
      try { localStorage.removeItem("tfs-ban-until") } catch { /* ignore */ }
    }
    lock.hidden = true
    return
  }
  lock.hidden = false
  if (left) left.textContent = formatBanClock(banRemainingMs())
}

function persistCheatFlag(key, on) {
  try { localStorage.setItem(key, on ? "1" : "0") } catch { /* ignore */ }
}

function megaPromoEffect(n) {
  // Scramble so nearby numbers feel different.
  const mixed = Math.imul(n, 2654435761) >>> 0
  return MEGA_PROMO_EFFECTS[mixed % MEGA_PROMO_EFFECTS.length]
}

function appendPromoBookRow(list, code, effect) {
  const li = document.createElement("li")
  const kbd = document.createElement("kbd")
  kbd.textContent = code
  const span = document.createElement("span")
  span.className = "promo-effect"
  span.textContent = effect
  li.append(kbd, span)
  list.appendChild(li)
}

function refreshPromoBook() {
  const book = document.getElementById("promo-book")
  const list = document.getElementById("promo-book-list")
  if (!book || !list) return
  // Cheat sheet is owner-only — only after admin (`demi`).
  book.hidden = !cheats.admin
  if (!cheats.admin) {
    list.innerHTML = ""
    return
  }
  list.innerHTML = ""
  for (const entry of PROMO_BOOK) {
    appendPromoBookRow(list, entry.code, entry.effect)
  }
  appendPromoBookRow(
    list,
    `p1…p${MEGA_PROMO_COUNT}`,
    `${MEGA_PROMO_COUNT.toLocaleString("en-US")} numbered codes — each number picks an effect`
  )
  // Sample a few so you can see what they do without listing 90 million rows.
  for (const sample of [1, 7, 42, 100, 9001, 1_000_000, MEGA_PROMO_COUNT]) {
    const effect = megaPromoEffect(sample)
    appendPromoBookRow(list, `p${sample}`, effect.label)
  }
}

const PROMO_COLLAPSE_KEY = "tfs-promo-collapsed"

function promoSectionCollapsed() {
  try {
    const raw = localStorage.getItem(PROMO_COLLAPSE_KEY)
    // Default collapsed so the admin book never covers the plane list.
    if (raw == null) return true
    return raw === "1"
  } catch {
    return true
  }
}

function setPromoSectionCollapsed(collapsed) {
  try {
    localStorage.setItem(PROMO_COLLAPSE_KEY, collapsed ? "1" : "0")
  } catch {
    /* ignore */
  }
  syncPromoSectionUi()
}

function syncPromoSectionUi() {
  const panel = document.getElementById("hangar-promo")
  const body = document.getElementById("promo-body")
  const toggle = document.getElementById("promo-toggle")
  const headTitle = panel?.querySelector(".promo-head-title")
  if (!panel || !body || !toggle) return
  const collapsed = promoSectionCollapsed()
  body.hidden = collapsed
  panel.classList.toggle("is-open", !collapsed)
  toggle.setAttribute("aria-expanded", collapsed ? "false" : "true")
  toggle.textContent = collapsed ? "Show" : "Hide"
  if (headTitle) {
    const bits = ["Promo codes"]
    if (collapsed && cheats.admin) bits.push("Admin on")
    if (collapsed && cheats.crashPhysics) bits.push("Crash on")
    headTitle.textContent = bits.join(" · ")
  }
}

function refreshPromoStatus() {
  const status = document.getElementById("promo-status")
  if (!status) return
  const bits = []
  if (cheats.admin) bits.push("Admin on")
  if (cheats.crashPhysics) bits.push("Crash physics on")
  if (cheats.turbo) bits.push("Turbo on")
  if (cheats.slowmo) bits.push("Slow-mo on")
  if (isBanned()) bits.push(`Banned ${formatBanClock(banRemainingMs())}`)
  status.textContent = bits.length ? bits.join(" · ") : "Enter a code for extras."
  refreshPromoBook()
  syncPromoSectionUi()
}

function promoWarpHome() {
  if (!player) {
    toast("No plane to warp.")
    return false
  }
  if (outside) enterPlane({ quiet: true })
  recovering = false
  crashTimer = 0
  crashPromptOpen = false
  document.getElementById("crash-screen")?.setAttribute("hidden", "")
  place(player, PAD.x, PAD.z, 0.4)
  velocity.set(0, 0, 0)
  throttle = 0
  systems.parking = true
  grounded = true
  snapCam = true
  toast("Warped home to the pad.")
  beep(520, 0.09)
  return true
}

function promoSkyLaunch(height = 800, climb = 42) {
  if (mode !== "fly" || !player || outside || playerIsCar()) {
    toast("Sky works in the air — hop in a plane and Fly first.")
    return false
  }
  player.root.position.y += height
  velocity.y = Math.max(velocity.y, climb)
  grounded = false
  toast("Sky launch — you’re up high.")
  beep(900, 0.1)
  return true
}

function applyMegaPromo(n) {
  const effect = megaPromoEffect(n)
  const tag = `p${n}`
  switch (effect.id) {
    case "boost": {
      if (!player || mode !== "fly") {
        toast(`${tag}: fly first for a speed burst.`)
        return false
      }
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(player.root.quaternion)
      velocity.addScaledVector(forward, 55 + (n % 40))
      throttle = 1
      systems.parking = false
      toast(`${tag}: ${effect.label}!`)
      beep(780, 0.08)
      return true
    }
    case "skyhop":
      return promoSkyLaunch(220 + (n % 900), 28 + (n % 30))
    case "home":
      return promoWarpHome()
    case "fix":
      clearFailures({ quiet: true })
      toast(`${tag}: failures cleared.`)
      beep(640, 0.08)
      refreshPromoStatus()
      return true
    case "turbo":
      cheats.turbo = !cheats.turbo
      persistCheatFlag("tfs-promo-turbo", cheats.turbo)
      refreshPromoStatus()
      toast(`${tag}: turbo ${cheats.turbo ? "on" : "off"}.`)
      beep(720, 0.08)
      return true
    case "slowmo":
      cheats.slowmo = !cheats.slowmo
      persistCheatFlag("tfs-promo-slowmo", cheats.slowmo)
      refreshPromoStatus()
      toast(`${tag}: slow-mo ${cheats.slowmo ? "on" : "off"}.`)
      beep(360, 0.1)
      return true
    case "crash":
      cheats.crashPhysics = !cheats.crashPhysics
      persistCheatFlag("tfs-promo-crash", cheats.crashPhysics)
      refreshPromoStatus()
      toast(`${tag}: crash physics ${cheats.crashPhysics ? "on" : "off"}.`)
      beep(520, 0.08)
      return true
    case "nofail":
      setFailMode("off")
      clearFailures({ quiet: true })
      toast(`${tag}: failures off.`)
      beep(500, 0.08)
      refreshPromoStatus()
      return true
    case "hard":
      setFailMode("hard")
      toast(`${tag}: failures hard.`)
      beep(200, 0.12, "square")
      refreshPromoStatus()
      return true
    case "clear":
    case "dawn":
    case "windy":
    case "cloudy":
    case "rain":
    case "storm":
    case "fog":
      setWeather(effect.id)
      toast(`${tag}: ${effect.label}.`)
      refreshPromoStatus()
      return true
    case "spin":
      if (!player || mode !== "fly") {
        toast(`${tag}: fly first to spin.`)
        return false
      }
      player.root.rotateY((n % 2 === 0 ? 1 : -1) * 1.2)
      toast(`${tag}: ${effect.label}!`)
      beep(440, 0.07)
      return true
    case "dive":
      if (!player || mode !== "fly" || outside || playerIsCar()) {
        toast(`${tag}: fly a plane for a dive kick.`)
        return false
      }
      velocity.y = Math.min(velocity.y, -35 - (n % 25))
      grounded = false
      toast(`${tag}: ${effect.label}!`)
      beep(180, 0.1, "sawtooth")
      return true
    case "climb":
      return promoSkyLaunch(120 + (n % 400), 50 + (n % 40))
    case "brake":
      if (!player || mode !== "fly") {
        toast(`${tag}: fly first to stop.`)
        return false
      }
      velocity.set(0, 0, 0)
      throttle = 0
      systems.parking = true
      toast(`${tag}: full stop.`)
      beep(220, 0.08)
      return true
    default:
      toast(`${tag}: unknown effect.`)
      return false
  }
}

function redeemPromo(raw) {
  const code = String(raw || "").trim().toLowerCase()
  if (!code) {
    toast("Type a promo code first.")
    return false
  }
  const mega = /^p(\d{1,8})$/.exec(code)
  if (mega) {
    const n = Number(mega[1])
    if (n >= 1 && n <= MEGA_PROMO_COUNT) return applyMegaPromo(n)
  }
  if (code === "demi") {
    cheats.admin = true
    banUntil = 0
    try {
      localStorage.setItem("tfs-promo-admin", "1")
      localStorage.removeItem("tfs-ban-until")
    } catch { /* ignore */ }
    refreshBanLock()
    refreshPromoStatus()
    refreshAirportUi()
    toast("Admin unlocked — your promo book is open.")
    beep(880, 0.1)
    return true
  }
  if (code === "crash") {
    cheats.crashPhysics = !cheats.crashPhysics
    persistCheatFlag("tfs-promo-crash", cheats.crashPhysics)
    refreshPromoStatus()
    toast(cheats.crashPhysics ? "Crash physics on — roll, fire, parts fly, ground scars." : "Crash physics off.")
    beep(520, 0.08)
    return true
  }
  if (code === "ban") {
    if (cheats.admin) {
      toast("Admin ignores bans.")
      return false
    }
    banUntil = Date.now() + 10 * 60 * 1000
    try { localStorage.setItem("tfs-ban-until", String(banUntil)) } catch { /* ignore */ }
    if (mode === "fly") showMenu()
    refreshBanLock()
    refreshPromoStatus()
    toast("Banned for 10 minutes.")
    beep(90, 0.35, "sawtooth")
    return true
  }
  if (code === "unban") {
    banUntil = 0
    try { localStorage.removeItem("tfs-ban-until") } catch { /* ignore */ }
    refreshBanLock()
    refreshPromoStatus()
    toast("Ban cleared.")
    beep(660, 0.08)
    return true
  }
  if (code === "turbo") {
    cheats.turbo = !cheats.turbo
    persistCheatFlag("tfs-promo-turbo", cheats.turbo)
    refreshPromoStatus()
    toast(cheats.turbo ? "Turbo on — 2× thrust and top speed." : "Turbo off.")
    beep(720, 0.08)
    return true
  }
  if (code === "fix") {
    clearFailures({ quiet: true })
    toast("All failures cleared.")
    beep(640, 0.08)
    refreshPromoStatus()
    return true
  }
  if (code === "sky") return promoSkyLaunch()
  if (code === "home") return promoWarpHome()
  if (code === "nofail") {
    setFailMode("off")
    clearFailures({ quiet: true })
    toast("Failures off.")
    beep(500, 0.08)
    refreshPromoStatus()
    return true
  }
  if (code === "hard") {
    setFailMode("hard")
    toast("Failures set to hard.")
    beep(200, 0.12, "square")
    refreshPromoStatus()
    return true
  }
  if (code === "storm") {
    setWeather("storm")
    refreshPromoStatus()
    return true
  }
  if (code === "clear") {
    setWeather("clear")
    refreshPromoStatus()
    return true
  }
  if (code === "slowmo") {
    cheats.slowmo = !cheats.slowmo
    persistCheatFlag("tfs-promo-slowmo", cheats.slowmo)
    refreshPromoStatus()
    toast(cheats.slowmo ? "Slow-mo on — half speed." : "Slow-mo off.")
    beep(360, 0.1)
    return true
  }
  toast("Unknown promo code.")
  return false
}

function refreshAirportUi() {
  const banner = document.getElementById("airport-banner")
  const eyebrow = document.getElementById("hangar-eyebrow")
  const label = world?.airportName || airportLabel(playerName)
  const where = world?.placeName
  if (banner) banner.textContent = where ? `You are at ${label} · ${where}` : `You are at ${label}`
  if (eyebrow) eyebrow.textContent = cheats.admin ? `ADMIN · ${label}` : label
  const rename = document.getElementById("rename-input")
  if (rename && !rename.matches(":focus")) rename.value = playerName
  refreshPromoStatus()
  refreshBanLock()
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

function wrapChatBubbleLines(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean)
  const lines = []
  let line = ""
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 3)
}

function makeChatBubbleSprite(text) {
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = 192
  const ctx = canvas.getContext("2d")
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.font = "bold 36px sans-serif"
  const lines = wrapChatBubbleLines(ctx, text, 440)
  const padX = 28
  const padY = 22
  const lineH = 44
  const boxH = padY * 2 + Math.max(1, lines.length) * lineH
  const boxY = canvas.height - boxH - 28
  // Bubble body
  ctx.fillStyle = "rgba(8,14,22,0.92)"
  ctx.strokeStyle = "rgba(255,183,3,0.85)"
  ctx.lineWidth = 6
  const r = 28
  const x = 16
  const w = canvas.width - 32
  ctx.beginPath()
  ctx.moveTo(x + r, boxY)
  ctx.arcTo(x + w, boxY, x + w, boxY + boxH, r)
  ctx.arcTo(x + w, boxY + boxH, x, boxY + boxH, r)
  ctx.lineTo(x + w * 0.42, boxY + boxH)
  ctx.lineTo(x + w * 0.5, canvas.height - 8)
  ctx.lineTo(x + w * 0.58, boxY + boxH)
  ctx.arcTo(x, boxY + boxH, x, boxY, r)
  ctx.arcTo(x, boxY, x + w, boxY, r)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = "#f6f1e4"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const startY = boxY + padY + lineH * 0.5
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], canvas.width / 2, startY + i * lineH)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    fog: false,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(28, 10.5), mat)
  mesh.name = "chatBubble"
  mesh.renderOrder = 8
  mesh.userData.chatBubble = true
  return mesh
}

function craftForChatSender(senderId) {
  if (net.you && senderId === net.you.id && player?.root) return player
  const remote = remotes.get(senderId)
  return remote?.craft || null
}

function showWorldChatBubble(senderId, text) {
  const craft = craftForChatSender(senderId)
  if (!craft?.root || !text) return
  // Replace any existing bubble on this craft.
  const old = craft.root.children.find((c) => c.userData?.chatBubble)
  if (old) {
    craft.root.remove(old)
    old.material.map?.dispose()
    old.material.dispose()
    old.geometry?.dispose?.()
    clearTimeout(old.userData?.chatBubbleTimer)
  }
  const bubble = makeChatBubbleSprite(text)
  const span = Math.max(12, craft.def?.wing?.span || craft.def?.width || 20)
  bubble.position.y = Math.max(16, span * 0.55)
  craft.root.add(bubble)
  const timer = setTimeout(() => {
    if (bubble.parent) bubble.parent.remove(bubble)
    bubble.material.map?.dispose()
    bubble.material.dispose()
    bubble.geometry?.dispose?.()
  }, 5200)
  bubble.userData.chatBubbleTimer = timer
}

function placeRemoteAtPad(remote, slot) {
  if (slot == null || !remote?.craft) return
  const pad = world.padFor(slot)
  const y = clearanceOf(remote.craft)
  remote.craft.root.position.set(pad.x, y, pad.z)
  remote.craft.root.rotation.set(0, 0.4, 0)
  remote.targetPos.set(pad.x, y, pad.z)
  remote.targetQuat.setFromEuler(remote.craft.root.rotation)
  remote.hasPose = true
  remote.craft.root.visible = true
}

function refreshRemoteMesh(remote, def) {
  if (!remote || !def) return
  const pos = remote.craft.root.position.clone()
  const quat = remote.craft.root.quaternion.clone()
  const visible = remote.craft.root.visible
  scene.remove(remote.craft.root)
  disposeVehicle(remote.craft)
  const craft = createVehicle(def)
  craft.root.visible = visible
  craft.root.position.copy(pos)
  craft.root.quaternion.copy(quat)
  const plate = makeNameplate(remote.name || "Pilot")
  craft.root.add(plate)
  if (isCar(def)) plate.position.y = 3.2
  scene.add(craft.root)
  remote.craft = craft
  remote.plate = plate
  remote.planeId = def.id
  remote.kind = def.kind || "aircraft"
}

function upsertRemote(peer) {
  if (!peer?.id) return
  let remote = remotes.get(peer.id)
  const vehicleId = peer.state?.vehicleId || peer.state?.planeId || peer.planeId || "b737"
  const def = findFleetDef(vehicleId)
  if (!remote) {
    const craft = createVehicle(def)
    craft.root.visible = true
    const plate = makeNameplate(peer.name || "Pilot")
    craft.root.add(plate)
    if (isCar(def)) plate.position.y = 3.2
    scene.add(craft.root)
    remote = {
      id: peer.id,
      name: peer.name,
      slot: peer.slot,
      craft,
      plate,
      planeId: def.id,
      kind: def.kind || "aircraft",
      targetPos: new THREE.Vector3(),
      targetQuat: new THREE.Quaternion(),
      hasPose: false,
    }
    remotes.set(peer.id, remote)
    if (peer.slot != null) {
      world.ensureAirport(peer.slot, peer.name, peer.origin)
      placeRemoteAtPad(remote, peer.slot)
    }
    if (!isModelCached(def.id)) {
      ensureModel(def.id).then((ok) => {
        const cur = remotes.get(peer.id)
        if (ok && cur && cur.planeId === def.id) refreshRemoteMesh(cur, def)
      })
    }
  } else if (remote.planeId !== def.id) {
    scene.remove(remote.craft.root)
    disposeVehicle(remote.craft)
    const craft = createVehicle(def)
    craft.root.visible = true
    const plate = makeNameplate(peer.name || remote.name || "Pilot")
    craft.root.add(plate)
    if (isCar(def)) plate.position.y = 3.2
    scene.add(craft.root)
    remote.craft = craft
    remote.plate = plate
    remote.planeId = def.id
    remote.kind = def.kind || "aircraft"
    if (!isModelCached(def.id)) {
      ensureModel(def.id).then((ok) => {
        const cur = remotes.get(peer.id)
        if (ok && cur && cur.planeId === def.id) refreshRemoteMesh(cur, def)
      })
    }
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
    if (peer.slot != null) world.ensureAirport(peer.slot, peer.name, peer.origin)
  }
  refreshAirportUi()
  return remote
}

function removeRemote(id) {
  const remote = remotes.get(id)
  if (!remote) return
  scene.remove(remote.craft.root)
  disposeVehicle(remote.craft)
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
    if (isCar(craft.def)) {
      craft.controls.lights = msg.lights || 0
    } else {
      craft.controls.gear = msg.gear ?? 1
      craft.controls.flapStep = msg.flaps || 0
      craft.controls.doors = msg.doors || 0
      craft.controls.lights = msg.lights || 0
      craft.controls.spoilers = msg.spoilers || 0
    }
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
      world.setLocalAirport(0, playerName, startAt)
      localOrigin = { ...world.localOrigin }
      refreshAirportUi()
      const hangarEl = document.getElementById("traffic-hangar")
      if (hangarEl) hangarEl.textContent = "Playing alone — Wi‑Fi multiplayer is offline, but you can still fly."
      toast("You can still fly. Multiplayer is offline.")
      return
    }
    playerName = msg.you.name
    try { localStorage.setItem("tfs-player-name", playerName) } catch { /* ignore */ }
    world.setLocalAirport(msg.you.slot, playerName, msg.you.origin || startAt)
    localOrigin = { ...world.localOrigin }
    if (player) place(player, PAD.x, PAD.z, 0.4)
    if (parked[0]) place(parked[0], PAD.x - 80, PAD.z + 250, 0.8)
    if (parked[1]) place(parked[1], PAD.x - 80, PAD.z + 340, -0.4)
    for (const peer of msg.peers || []) {
      world.ensureAirport(peer.slot, peer.name, peer.origin)
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
    toast(`${world.airportName} · ${world.placeName}`)
    snapCam = true
    netSyncAcc = 99
    pushNetState(1)
  },
  onPeerJoin(player) {
    world.ensureAirport(player.slot, player.name, player.origin)
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
    world.ensureAirport(player.slot, player.name, player.origin)
    upsertRemote(player)
    refreshAirportUi()
  },
  onPeerState(msg) {
    applyRemoteState(msg)
  },
  onChat(msg) {
    pushChatMessage(msg)
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
    vehicleId: player.def.id,
    kind: player.def.kind || "aircraft",
    x: player.root.position.x,
    y: player.root.position.y,
    z: player.root.position.z,
    qx: q.x,
    qy: q.y,
    qz: q.z,
    qw: q.w,
    throttle,
    gear: player.controls.gear ?? 1,
    flaps: player.controls.flapStep ?? 0,
    doors: player.controls.doors ?? 0,
    lights: player.controls.lights ?? 0,
    spoilers: player.controls.spoilers ?? 0,
    outside,
    mode,
  })
}
let jTapAt = 0
let jTapArmed = false
let takeoffBoost = 0
let rotateWait = 0
// Attitude the pilot last set. A tap banks or pitches once, then this holds
// until the next pitch or roll input. Wings no longer level themselves on release.
let holdBank = 0
let holdPitch = 0
let rollLatch = 0
let pitchLatch = 0
let pitchTouched = false
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

/** Active system failures — planes and cars. */
const failures = {
  eng1: false,
  eng2: false,
  fire: false,
  fireIndex: -1,
  hyd: false,
  elec: false,
  gearJam: false,
  carEng: false,
  tire: false,
  tireSide: 1,
  brakes: false,
}
let failMode = "on" // off | on | hard
let failAcc = 0
let failCooldown = 18
try {
  const savedFail = localStorage.getItem("tfs-fail-mode")
  if (savedFail === "off" || savedFail === "on" || savedFail === "hard") failMode = savedFail
} catch { /* ignore */ }

const AIR_FAIL_KINDS = ["eng1", "eng2", "fire", "hyd", "elec", "gearJam"]
const CAR_FAIL_KINDS = ["carEng", "tire", "brakes"]

function anyFailure() {
  return failures.eng1 || failures.eng2 || failures.fire || failures.hyd || failures.elec
    || failures.gearJam || failures.carEng || failures.tire || failures.brakes
}

function clearFailures({ quiet = false } = {}) {
  failures.eng1 = false
  failures.eng2 = false
  failures.fire = false
  failures.fireIndex = -1
  failures.hyd = false
  failures.elec = false
  failures.gearJam = false
  failures.carEng = false
  failures.tire = false
  failures.brakes = false
  setCaution("eng1", false)
  setCaution("eng2", false)
  setCaution("fire", false)
  setCaution("hyd", false)
  setCaution("elec", false)
  setCaution("gearjam", false)
  setCaution("careng", false)
  setCaution("tire", false)
  setCaution("brakes", false)
  refreshFailPanel()
  if (!quiet) toast("Systems reset — all failures cleared.")
}

function failLabel(kind) {
  if (kind === "eng1") return "Engine 1 failed!"
  if (kind === "eng2") return "Engine 2 failed!"
  if (kind === "fire") return "Engine fire! Tap Put out fire next to the throttle."
  if (kind === "hyd") return "Hydraulic failure — controls feel heavy."
  if (kind === "elec") return "Electrical failure — autopilot and lights cut."
  if (kind === "gearJam") return "Landing gear jammed!"
  if (kind === "carEng") return "Car engine sputter — power is down."
  if (kind === "tire") return "Flat tire — the car pulls sideways."
  if (kind === "brakes") return "Brake failure — use space carefully / coast."
  return "System failure!"
}

function triggerFailure(kind, { practice = false } = {}) {
  if (!kind || failMode === "off" && !practice) return false
  if (kind === "eng1" || kind === "eng2") {
    if (failures[kind]) return false
    failures[kind] = true
  } else if (kind === "fire") {
    failures.fire = true
    const n = Math.max(1, player?.def?.engines?.length || 2)
    failures.fireIndex = Math.floor(Math.random() * n)
    if (failures.fireIndex % 2 === 0) failures.eng1 = true
    else failures.eng2 = true
  } else if (kind === "hyd") failures.hyd = true
  else if (kind === "elec") {
    failures.elec = true
    if (ap.on) disengageAp("Electrical failure — autopilot offline.")
    if (player?.controls) {
      player.controls.lights = 0
      player.setLights?.(false)
    }
  } else if (kind === "gearJam") failures.gearJam = true
  else if (kind === "carEng") failures.carEng = true
  else if (kind === "tire") {
    failures.tire = true
    failures.tireSide = Math.random() < 0.5 ? -1 : 1
  } else if (kind === "brakes") failures.brakes = true
  else return false

  failCooldown = failMode === "hard" ? 12 : 22
  beep(140, 0.2, "sawtooth")
  setTimeout(() => beep(110, 0.25, "square"), 140)
  toast((practice ? "Practice: " : "") + failLabel(kind))
  refreshFailCautions()
  return true
}

function refreshFailCautions() {
  setCaution("eng1", failures.eng1)
  setCaution("eng2", failures.eng2)
  setCaution("fire", failures.fire)
  setCaution("hyd", failures.hyd)
  setCaution("elec", failures.elec)
  setCaution("gearjam", failures.gearJam)
  setCaution("careng", failures.carEng)
  setCaution("tire", failures.tire)
  setCaution("brakes", failures.brakes)
  refreshFailPanel()
}

function pickRandomFailure() {
  const pool = playerIsCar() ? CAR_FAIL_KINDS : AIR_FAIL_KINDS
  const open = pool.filter((k) => {
    if (k === "eng1") return !failures.eng1
    if (k === "eng2") return !failures.eng2
    if (k === "fire") return !failures.fire
    if (k === "hyd") return !failures.hyd
    if (k === "elec") return !failures.elec
    if (k === "gearJam") return !failures.gearJam && player?.def?.gear?.mode === "retract"
    if (k === "carEng") return !failures.carEng
    if (k === "tire") return !failures.tire
    if (k === "brakes") return !failures.brakes
    return true
  })
  if (!open.length) return null
  return open[Math.floor(Math.random() * open.length)]
}

function practiceFailure() {
  if (mode !== "fly" || outside || recovering) {
    toast("Start flying or driving first, then tap Fail.")
    return
  }
  if (failMode === "off" && !cheats.admin) {
    toast("Failures are Off — open Fails, then tap On.")
    return
  }
  const kind = pickRandomFailure()
  if (!kind) {
    toast("Every system is already failed. Tap Reset.")
    return
  }
  triggerFailure(kind, { practice: true })
}

function tickFailures(dt) {
  if (failMode === "off" || mode !== "fly" || outside || recovering) return
  // Autopilot flights stay clean — random failures were nuking climbs mid-ALT bump.
  if (ap.on && !playerIsCar()) return
  failCooldown = Math.max(0, failCooldown - dt)
  if (failCooldown > 0) return
  // Only after you're really going — takeoff / cruise / drive.
  const speed = velocity.length()
  const agl = player ? Math.max(0, player.root.position.y - clearanceOf(player)) : 0
  const eligible = playerIsCar()
    ? speed > 8
    : (!grounded && agl > 40 && speed > 40)
  if (!eligible) return
  failAcc += dt
  const period = failMode === "hard" ? 18 : 45
  if (failAcc < period) return
  failAcc = 0
  const chance = failMode === "hard" ? 0.55 : 0.28
  if (Math.random() > chance) {
    failCooldown = 8
    return
  }
  const kind = pickRandomFailure()
  if (kind) triggerFailure(kind)
}

function thrustFactor() {
  let engines = Math.max(1, player?.def?.engines?.length || 2)
  if (engines > 4) engines = 4
  let live = engines
  if (failures.eng1) live -= 1
  if (failures.eng2) live -= 1
  if (failures.fire) live = Math.max(0, live - 0.35)
  let factor = THREE.MathUtils.clamp(live / engines, 0.15, 1)
  if (cheats.turbo) factor *= 2
  return factor
}

function controlFactor() {
  return failures.hyd ? 0.42 : 1
}

function setFailMode(next) {
  failMode = next
  try { localStorage.setItem("tfs-fail-mode", failMode) } catch { /* ignore */ }
  for (const btn of document.querySelectorAll("#fail-modes .fail-mode")) {
    btn.classList.toggle("on", btn.dataset.fail === failMode)
  }
  const status = document.getElementById("fail-status")
  if (status) {
    status.textContent = failMode === "off"
      ? "Off"
      : failMode === "hard"
        ? "Hard · tap Fail now"
        : "On · tap Fail now"
  }
  refreshFailPanel()
}

function refreshFailPanel() {
  const flying = mode === "fly"
  if (failures.fire && !refreshFailPanel.sawFire) failOpen = true
  refreshFailPanel.sawFire = !!failures.fire
  const dock = document.getElementById("fail-dock")
  const panel = document.getElementById("fail-panel")
  const toggle = document.getElementById("fail-toggle")
  if (dock) dock.hidden = !flying
  if (panel) panel.hidden = !flying || !failOpen
  if (toggle) {
    toggle.setAttribute("aria-expanded", failOpen ? "true" : "false")
    toggle.classList.toggle("on", failOpen)
    toggle.classList.toggle("alert", !!failures.fire)
    toggle.textContent = failures.fire ? "Fire" : "Fails"
  }
  const extinguish = document.getElementById("fail-extinguish")
  if (extinguish) extinguish.hidden = !(flying && failures.fire)
}

function setFailOpen(open) {
  failOpen = !!open
  refreshFailPanel()
}

function extinguishFire() {
  if (!failures.fire) {
    toast("No engine fire.")
    return
  }
  failures.fire = false
  failures.fireIndex = -1
  systems.fireLeft = true
  systems.fireRight = true
  toast("Fire extinguished!")
  beep(720, 0.1)
  refreshFailCautions()
  refreshFailPanel()
}
const parked = []

/** Windshear / gust cells — kept off the runway climb-out so takeoff stays fair. */
const SHEAR_ZONES = [
  { x: 520, z: -600, r: 200, y0: 20, y1: 110, top: { x: 14, y: -10, z: 4 }, bot: { x: -12, y: 7, z: -3 } },
  { x: -480, z: 2600, r: 240, y0: 40, y1: 160, top: { x: -12, y: -12, z: 8 }, bot: { x: 14, y: 8, z: -6 } },
  { x: 720, z: 2200, r: 200, y0: 50, y1: 180, top: { x: 10, y: -10, z: -10 }, bot: { x: -8, y: 7, z: 12 } },
  { x: 1100, z: 900, r: 180, y0: 25, y1: 100, top: { x: 16, y: -8, z: 2 }, bot: { x: -12, y: 6, z: 3 } },
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
  if (!weather) return
  let saved = "clear"
  try { saved = localStorage.getItem("tfs-weather") || "clear" } catch { /* ignore */ }
  if (saved === "live") {
    // Don't block hangar open on geolocation / network.
    weather.apply("clear")
    refreshWxPanel()
    weather.applyLive().then(() => refreshWxPanel()).catch(() => {
      weather.apply("clear")
      refreshWxPanel()
    })
    return
  }
  if (weather.presets.some((item) => item.id === saved)) weather.apply(saved)
  else weather.apply("clear")
  refreshWxPanel()
}

function yieldFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

async function ensureSimCore() {
  if (world) return
  boot.textContent = "Building airfield…"
  await yieldFrame()
  world = createWorld(scene)
  weather = createWeatherController({ scene, hemi, sun, fill, world })
  crashFx = createCrashFx(scene)
  await yieldFrame()
  // Fancy reflections after the hangar is usable — not on the critical path.
  import("../node_modules/three/examples/jsm/environments/RoomEnvironment.js")
    .then(({ RoomEnvironment }) => {
      const pmrem = new THREE.PMREMGenerator(renderer)
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
      pmrem.dispose()
    })
    .catch(() => {})
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

const chatRoot = document.getElementById("chat")
const chatPanel = document.getElementById("chat-panel")
const chatLog = document.getElementById("chat-log")
const chatInput = document.getElementById("chat-input")
const chatHint = document.getElementById("chat-hint")
const chatToggle = document.getElementById("chat-toggle")
const chatBackdrop = document.getElementById("chat-backdrop")
const chatBadge = document.getElementById("chat-badge")
const chatEmojiBtn = document.getElementById("chat-emoji")
const chatEmojiPanel = document.getElementById("chat-emoji-panel")
const chatPop = document.getElementById("chat-pop")
const CHAT_ENABLED = false
const MAX_CHAT_LINES = 48
const CHAT_MAX_LEN = 140
const MAX_CHAT_POPS = 4
let chatUnread = 0
let chatPopSeq = 0
const recentChatKeys = new Set()

function chatMessageKey(msg) {
  return `${msg.id || "?"}|${msg.at || 0}|${msg.text || ""}`
}

function typingInField() {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable
}

function chatOpen() {
  return Boolean(chatRoot && chatRoot.classList.contains("open"))
}

function syncChatButton(btn) {
  if (!btn) return
  btn.classList.toggle("on", chatOpen())
  let badge = btn.querySelector(".chat-fly-badge")
  if (chatUnread > 0 && mode === "fly" && !chatOpen()) {
    if (!badge) {
      badge = document.createElement("span")
      badge.className = "chat-fly-badge"
      btn.appendChild(badge)
    }
    badge.hidden = false
    badge.textContent = chatUnread > 9 ? "9+" : String(chatUnread)
  } else if (badge) {
    badge.hidden = true
  }
}

function hideChatControls() {
  if (chatRoot) {
    chatRoot.hidden = true
    chatRoot.classList.remove("open")
  }
  if (chatPanel) chatPanel.hidden = true
  if (chatBackdrop) chatBackdrop.hidden = true
  if (chatPop) chatPop.hidden = true
  const flyChat = document.getElementById("fly-chat")
  const failChat = document.getElementById("fail-chat")
  if (flyChat) flyChat.hidden = true
  if (failChat) failChat.hidden = true
}

function syncChatChrome() {
  if (!CHAT_ENABLED) {
    hideChatControls()
    return
  }
  if (!chatRoot) return
  chatRoot.classList.toggle("in-flight", mode === "fly")
  const flyChat = document.getElementById("fly-chat")
  const failChat = document.getElementById("fail-chat")
  if (failChat) failChat.hidden = mode !== "fly"
  syncChatButton(flyChat)
  syncChatButton(failChat)
  if (chatBadge) {
    if (chatUnread > 0 && !chatOpen() && mode !== "fly") {
      chatBadge.hidden = false
      chatBadge.textContent = chatUnread > 9 ? "9+" : String(chatUnread)
    } else {
      chatBadge.hidden = true
    }
  }
}

function updateChatViewportOffset() {
  if (!chatRoot || !window.visualViewport) {
    chatRoot?.style.setProperty("--chat-vv-bottom", "0px")
    return
  }
  const vv = window.visualViewport
  const occluded = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop))
  // Keep the composer above the soft keyboard on iPhone / iPad / Android.
  chatRoot.style.setProperty("--chat-vv-bottom", `${Math.round(occluded)}px`)
}

function setEmojiPanelOpen(open) {
  if (!chatEmojiPanel || !chatEmojiBtn) return
  chatEmojiPanel.hidden = !open
  chatEmojiBtn.setAttribute("aria-expanded", open ? "true" : "false")
}

function insertChatEmoji(emoji) {
  if (!chatInput || !emoji) return
  const value = chatInput.value || ""
  const start = chatInput.selectionStart ?? value.length
  const end = chatInput.selectionEnd ?? value.length
  const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`.slice(0, CHAT_MAX_LEN)
  const caret = Math.min(start + emoji.length, next.length)
  chatInput.value = next
  chatInput.focus({ preventScroll: true })
  chatInput.setSelectionRange(caret, caret)
}

function setChatOpen(open) {
  if (!CHAT_ENABLED) {
    hideChatControls()
    return
  }
  if (!chatRoot || !chatPanel) return
  chatRoot.classList.toggle("open", open)
  chatPanel.hidden = !open
  if (chatBackdrop) chatBackdrop.hidden = !open
  if (!open) setEmojiPanelOpen(false)
  if (open) {
    chatUnread = 0
    chatHint.textContent = net.online
      ? "Friends on this Wi‑Fi can read this · Close when done"
      : "Choose Multiplayer at start to chat on Wi‑Fi"
    updateChatViewportOffset()
    // Focus after layout so iOS/Android keyboards land on the input.
    requestAnimationFrame(() => {
      chatInput?.focus({ preventScroll: true })
      updateChatViewportOffset()
    })
  } else if (document.activeElement === chatInput) {
    chatInput.blur()
    chatRoot.style.setProperty("--chat-vv-bottom", "0px")
  }
  syncChatChrome()
}

function appendChatLine({ name, text, you = false, system = false }) {
  if (!chatLog) return
  const line = document.createElement("div")
  line.className = `chat-line${you ? " you" : ""}${system ? " system" : ""}`
  if (system) {
    line.textContent = text
  } else {
    const who = document.createElement("span")
    who.className = "who"
    who.textContent = name || "Pilot"
    line.append(who, document.createTextNode(text))
  }
  chatLog.appendChild(line)
  while (chatLog.children.length > MAX_CHAT_LINES) chatLog.firstChild.remove()
  chatLog.scrollTop = chatLog.scrollHeight
}

function showChatPopup({ name, text, you = false }) {
  if (!chatPop || !text) return
  // Ensure the toast stack is visible even if a parent was hidden.
  chatPop.hidden = false
  const bubble = document.createElement("div")
  bubble.className = `chat-pop-bubble${you ? " you" : ""}`
  bubble.dataset.popId = String(++chatPopSeq)
  const who = document.createElement("div")
  who.className = "who"
  who.textContent = you ? "You" : (name || "Pilot")
  const body = document.createElement("div")
  body.className = "msg"
  body.textContent = text
  bubble.append(who, body)
  chatPop.appendChild(bubble)
  while (chatPop.children.length > MAX_CHAT_POPS) {
    chatPop.firstChild.remove()
  }
  requestAnimationFrame(() => bubble.classList.add("show"))
  const holdMs = Math.min(8000, 4200 + Math.min(text.length, 100) * 32)
  setTimeout(() => {
    bubble.classList.add("out")
    setTimeout(() => bubble.remove(), 240)
  }, holdMs)
}

function pushChatMessage(msg) {
  if (!CHAT_ENABLED || !msg?.text) return
  const key = chatMessageKey(msg)
  if (recentChatKeys.has(key)) return
  recentChatKeys.add(key)
  setTimeout(() => recentChatKeys.delete(key), 4000)

  const you = Boolean(net.you && msg.id === net.you.id)
  appendChatLine({ name: msg.name, text: msg.text, you })
  // Big on-screen popup for every pilot — hangar or mid-flight.
  showChatPopup({ name: msg.name, text: msg.text, you })
  // Also float a bubble above the sender’s plane so nearby pilots see it in-world.
  if (msg.id) showWorldChatBubble(msg.id, msg.text)
  if (!chatOpen() && !you) {
    chatUnread += 1
    syncChatChrome()
  }
}

function sendChatFromInput() {
  if (!CHAT_ENABLED) return
  const raw = chatInput?.value || ""
  const text = raw.replace(/\s+/g, " ").trim()
  if (!text) return
  if (!net.online) {
    appendChatLine({ text: "Multiplayer is off — go back and choose Multiplayer to chat.", system: true })
    return
  }
  if (!net.sendChat(text)) {
    appendChatLine({ text: "Could not send — reconnecting…", system: true })
    return
  }
  if (chatInput) chatInput.value = ""
  // Keep keyboard open on phones for quick back-and-forth.
  chatInput?.focus({ preventScroll: true })
}

function showChatUi() {
  if (!CHAT_ENABLED) {
    hideChatControls()
    return
  }
  if (chatRoot) chatRoot.hidden = false
  syncChatChrome()
}

function bindChatUi() {
  if (!CHAT_ENABLED || !chatRoot) return
  chatToggle?.addEventListener("click", () => {
    setChatOpen(true)
  })
  document.getElementById("fail-chat")?.addEventListener("click", () => {
    setChatOpen(!chatOpen())
  })
  document.getElementById("chat-close")?.addEventListener("click", () => {
    setChatOpen(false)
  })
  chatBackdrop?.addEventListener("click", () => {
    setChatOpen(false)
  })
  document.getElementById("chat-form")?.addEventListener("submit", (event) => {
    event.preventDefault()
    setEmojiPanelOpen(false)
    sendChatFromInput()
  })
  chatEmojiBtn?.addEventListener("click", (event) => {
    event.preventDefault()
    event.stopPropagation()
    setEmojiPanelOpen(Boolean(chatEmojiPanel?.hidden))
    chatInput?.focus({ preventScroll: true })
  })
  chatEmojiPanel?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-emoji]")
    if (!btn) return
    event.preventDefault()
    insertChatEmoji(btn.getAttribute("data-emoji"))
  })
  chatInput?.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      if (chatEmojiPanel && !chatEmojiPanel.hidden) {
        setEmojiPanelOpen(false)
        return
      }
      setChatOpen(false)
    }
  })
  chatPanel?.addEventListener("pointerdown", (event) => {
    if (!chatEmojiPanel || chatEmojiPanel.hidden) return
    if (event.target === chatEmojiBtn || chatEmojiBtn?.contains(event.target)) return
    if (chatEmojiPanel.contains(event.target)) return
    setEmojiPanelOpen(false)
  })
  const onVv = () => {
    if (chatOpen()) updateChatViewportOffset()
  }
  window.visualViewport?.addEventListener("resize", onVv)
  window.visualViewport?.addEventListener("scroll", onVv)
  window.addEventListener("resize", onVv)
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
  if (isCar(craft.def)) {
    return { gear: 1, flaps: 0, spoilers: 0, doors: 0, cargo: 0, nose: 0 }
  }
  // Keep gear down on the ground — retracting on the runway drops the plane to belly height.
  if (craft === player && grounded && craft.def.gear?.mode === "retract") controls.gear = 1
  return {
    gear: craft.def.gear?.mode === "retract" ? controls.gear : 1,
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
    if (craft.def.gear?.mode !== "retract") return
    if (craft === player && failures.gearJam) {
      toast("Gear jammed! Reset or land carefully.")
      beep(180, 0.12, "square")
      return
    }
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
  if (!panel) return
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
  if (!panel) return
  for (const button of panel.children) {
    const group = button.dataset.group
    button.querySelector("b").textContent = partState(player, group)
    button.classList.toggle("on", partOn(player, group))
  }
}

function hintLine(def) {
  const bits = isCar(def)
    ? [
        "W / Up gas",
        "S / Down reverse",
        "A D or arrows steer",
        "Slide throttle",
        "Space brake",
        "Shift faster",
        "J J get out",
      ]
    : [
        "Stick or arrows bank and pitch",
        "Slide throttle",
        "B autopilot",
        "H home land",
        "J J get out / jump",
        "Shift faster",
        "Q E rudder",
        "Space brake",
      ]
  for (const item of partButtons(def)) bits.push(`${item.key} ${item.label.toLowerCase()}`)
  bits.push(
    "K practice failure",
    "C cycle cams",
    "V / Planes swap",
    "[ ] prev/next",
    "R reset",
    "Esc hangar"
  )
  return bits.join("  ·  ")
}

function planeMatches(def, query) {
  if (!query || !def) return true
  const hay = `${def.name} ${def.role || ""} ${def.group || ""} ${def.id || ""}`.toLowerCase()
  return hay.includes(query)
}

function applyPlaneFilter() {
  const query = planeQuery.trim().toLowerCase()
  let heading = null
  let shownUnder = 0
  for (const child of list.children) {
    if (child.tagName === "H3") {
      if (heading) heading.hidden = shownUnder === 0
      heading = child
      shownUnder = 0
      continue
    }
    const def = FLEET[Number(child.dataset.index)]
    const ok = planeMatches(def, query)
    child.hidden = !ok
    if (ok) shownUnder += 1
  }
  if (heading) heading.hidden = shownUnder === 0
  const empty = document.getElementById("plane-empty")
  const any = [...list.querySelectorAll(".plane-btn")].some((button) => !button.hidden)
  if (empty) empty.hidden = any || !query
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

function boardReach(craft) {
  if (!craft?.def) return 12
  if (isCar(craft.def)) return Math.max(8, craft.def.length * 1.4)
  return Math.max(22, craft.def.length * 0.55, craft.def.wing?.span * 0.35 || 0)
}

function boardableCandidates() {
  const list = []
  if (homeCraft?.root) list.push(homeCraft)
  if (player?.root) list.push(player)
  for (const car of worldCars) {
    if (car?.root && car !== player) list.push(car)
  }
  return list
}

function nearestBoardable() {
  if (!pilot) return null
  let best = null
  let bestDist = Infinity
  for (const craft of boardableCandidates()) {
    const dx = pilot.root.position.x - craft.root.position.x
    const dz = pilot.root.position.z - craft.root.position.z
    const dist = Math.hypot(dx, dz)
    if (dist <= boardReach(craft) && dist < bestDist) {
      best = craft
      bestDist = dist
    }
  }
  return best
}

function boardNearPlane() {
  return !!nearestBoardable()
}

function adoptVehicle(craft) {
  if (!craft) return
  if (player && player !== craft && isCar(player.def) && !worldCars.includes(player)) {
    worldCars.push(player)
  }
  if (player && player !== craft && !isCar(player.def)) homeCraft = player
  if (isCar(craft.def)) {
    const idx = worldCars.indexOf(craft)
    if (idx >= 0) worldCars.splice(idx, 1)
  } else {
    homeCraft = null
  }
  player = craft
  if (typeof window !== "undefined") {
    window.__player = player
    window.__camera = camera
  }
  const fleetIdx = FLEET.findIndex((d) => d.id === craft.def.id)
  if (fleetIdx >= 0) selected = fleetIdx
  document.getElementById("hud-name").textContent = isAirliner(craft.def)
    ? craft.def.brand === "fedex"
      ? `${craft.def.name} · FedEx Express`
      : `${craft.def.name} · ${AIRLINE_NAME}`
    : craft.def.name
  document.getElementById("hints").textContent = hintLine(craft.def)
  renderPartButtons()
  refreshSysPanel()
  syncAirlinePaintUI(craft.def)
  if (!isCar(craft.def) && craft.controls.doors > 0.5) toggle(craft, "doors")
  craft.setCockpit(cameraMode === COCKPIT_CAM && !isCar(craft.def))
}

function enterPlane({ quiet = false } = {}) {
  if (!outside) return
  const target = nearestBoardable() || player
  outside = false
  chuteOpen = false
  pilotVel.set(0, 0, 0)
  if (pilot) {
    pilot.chute.visible = false
    pilot.root.visible = false
  }
  adoptVehicle(target)
  systems.parking = false
  throttle = 0
  velocity.set(0, 0, 0)
  snapCam = true
  refreshFlyActions()
  if (!quiet) {
    toast(isCar(target.def)
      ? `You're driving the ${target.def.name}! Tap Jump twice to get out.`
      : "Back in the plane! Tap Jump twice to get out.")
    beep(720, 0.08)
    setTimeout(() => beep(880, 0.1), 70)
  }
}

function exitPlane() {
  if (mode !== "fly" || !player || recovering || outside) return
  const clearance = clearanceOf(player)
  const agl = player.root.position.y - clearance
  const drivingCar = playerIsCar()
  const jumping = !drivingCar && (!grounded || agl > 5)
  const exitVel = velocity.clone()

  if (ap.on) disengageAp()
  throttle = 0
  velocity.set(0, 0, 0)
  systems.parking = true
  if (!drivingCar && player.controls.doors < 0.5) toggle(player, "doors")
  player.setCockpit(false)

  if (drivingCar && !worldCars.includes(player)) worldCars.push(player)
  if (!drivingCar) homeCraft = player

  const avatar = ensurePilot()
  const sideOff = drivingCar
    ? Math.max(2.2, player.def.width * 0.7)
    : Math.max(2.8, player.def.radius * 1.35)
  const side = new THREE.Vector3(-sideOff, 0, player.seat?.z ?? 0)
  side.applyQuaternion(player.root.quaternion)
  avatar.root.position.copy(player.root.position).add(side)
  avatar.root.quaternion.copy(player.root.quaternion)
  avatar.root.rotation.x = 0
  avatar.root.rotation.z = 0
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
    toast("You jumped out! Walk to a plane, then Board twice.")
    beep(320, 0.12, "triangle")
  } else {
    chuteOpen = false
    avatar.chute.visible = false
    avatar.root.position.y = 0
    pilotVel.set(0, 0, 0)
    toast(drivingCar
      ? "You left the craft. Walk to a plane, then Get in twice."
      : "You stepped out. Walk to a plane, then Get in twice.")
    beep(480, 0.08)
  }
  refreshFlyActions()
}

function toggleExit() {
  if (mode !== "fly" || recovering) return
  if (outside) {
    const near = nearestBoardable()
    if (chuteOpen && pilot && pilot.root.position.y > 4 && !near) {
      toast("Land first, or float closer to a plane, then press J twice.")
      return
    }
    if (!near) {
      toast("Walk closer to a plane, then press J twice.")
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

  // Keep the parked vehicle still while you're out.
  velocity.set(0, 0, 0)
  throttle = 0
}

function stepDrive(dt) {
  const drive = player.def.drive
  readStick()

  // Stick forward / W / Up = gas. Stick back / S / Down = brake or reverse.
  // Throttle slider and Shift still work as cruise power.
  if (held.throttle > 0 || keys.has("ShiftLeft") || keys.has("ShiftRight")) throttle += dt * 0.7
  if (held.throttle < 0 || keys.has("ControlLeft") || keys.has("ControlRight")) throttle -= dt * 0.7
  if (keys.has("KeyX")) throttle = 1
  if (keys.has("KeyZ")) throttle = 0
  if (stick.pitch > 0.08) throttle = Math.max(throttle, stick.pitch)
  if (stick.pitch < -0.08) throttle = Math.min(throttle, 1 + stick.pitch)
  throttle = THREE.MathUtils.clamp(throttle, 0, 1)

  // Gas cancels parking brake so cars always feel ready to roll.
  if (throttle > 0.05 || stick.pitch > 0.1) systems.parking = false

  const onPavement = world.onDrivable?.(player.root.position.x, player.root.position.z)
    ?? world.onRoad?.(player.root.position.x, player.root.position.z)
    ?? true
  const maxSpeed = drive.maxSpeed * (onPavement ? 1 : drive.offRoadMax)
  const friction = onPavement ? drive.friction : drive.offRoadFriction

  forward.set(0, 0, 1).applyQuaternion(player.root.quaternion)
  const along = velocity.dot(forward)
  const pedalBrake = held.brake > 0 || keys.has("Space") || !!systems.parking
  const wantReverse = stick.pitch < -0.25 && along < 2.5 && !pedalBrake

  if (pedalBrake) {
    const spd = velocity.length()
    const brakePower = failures.brakes ? 0.22 : 1.35
    if (spd > 0.05) {
      const cut = Math.min(spd, drive.brake * brakePower * dt)
      velocity.multiplyScalar(Math.max(0, (spd - cut) / spd))
    } else if (!failures.brakes) velocity.set(0, 0, 0)
    throttle = Math.max(0, throttle - dt * 1.4)
  } else if (wantReverse) {
    const revPower = Math.min(1, -stick.pitch) * drive.accel * 0.55
    velocity.addScaledVector(forward, -revPower * dt)
    const revMax = maxSpeed * 0.35
    if (velocity.length() > revMax) velocity.setLength(revMax)
  } else if (throttle > 0.02) {
    const power = (failures.carEng ? 0.35 : 1) * (cheats.turbo ? 2 : 1)
    velocity.addScaledVector(forward, drive.accel * 1.25 * throttle * power * dt)
  }

  const speed = velocity.length()
  // Light coasting drag so throttle actually builds speed.
  if (speed > 0.01 && !wantReverse) {
    const coast = throttle > 0.15 ? 0.55 : 1
    const drag = Math.max(0, 1 - friction * coast * dt * 0.22 * (failures.carEng ? 1.35 : 1))
    velocity.multiplyScalar(drag)
  }
  const top = maxSpeed * (failures.carEng ? 0.55 : 1) * (failures.tire ? 0.75 : 1) * (cheats.turbo ? 2 : 1)
  if (!wantReverse && velocity.length() > top) velocity.setLength(top)

  // Steer more eagerly at low speed so parking-lot turns feel good.
  const steerInput = stick.yaw + stick.roll + (failures.tire ? failures.tireSide * 0.35 : 0)
  const turnAuth = THREE.MathUtils.clamp(0.35 + speed / 6, 0.4, 1.35)
  player.root.rotateY(-steerInput * drive.steer * 1.15 * turnAuth * dt)
  player.root.rotation.x = 0
  player.root.rotation.z = THREE.MathUtils.clamp(-steerInput * 0.04 * Math.min(1, speed / 20), -0.08, 0.08)

  // Flat tire pulls the car; brake failure weakens Space.
  if (failures.tire && speed > 1) {
    velocity.addScaledVector(right.set(1, 0, 0).applyQuaternion(player.root.quaternion), failures.tireSide * 2.8 * dt)
  }
  tickFailures(dt)
  refreshFailCautions()

  if (speed > 0.15) {
    forward.set(0, 0, 1).applyQuaternion(player.root.quaternion)
    const signed = velocity.dot(forward) >= 0 ? 1 : -1
    velocity.copy(forward).multiplyScalar(signed * velocity.length())
  }

  player.root.position.x += velocity.x * dt
  player.root.position.z += velocity.z * dt
  player.root.position.y = clearanceOf(player)
  grounded = true
  distance += velocity.length() * dt

  const hit = obstacleAt(player.root.position)
  if (hit) {
    const dx = player.root.position.x - hit.x
    const dz = player.root.position.z - hit.z
    const dist = Math.hypot(dx, dz) || 1
    const push = (hit.r || 4) + 1.4 - dist
    if (push > 0) {
      player.root.position.x += (dx / dist) * push
      player.root.position.z += (dz / dist) * push
      if (cheats.crashPhysics && speed > 18) {
        crash(crashMessage(hit))
        return
      }
      velocity.multiplyScalar(0.15)
    }
  }

  forward.set(0, 0, 1).applyQuaternion(player.root.quaternion)
  up.set(0, 1, 0)
  right.set(1, 0, 0).applyQuaternion(player.root.quaternion)
  flightInfo.bank = 0
  flightInfo.aoa = 0
  flightInfo.warnings = []
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
  const locked = def.brand === "fedex" || def.lockedLivery === "fedex"
  const colors = locked
    ? { primary: "#4D148C", secondary: "#FF6600", fuselage: "#f7f7f5" }
    : loadAirlineColors()
  document.getElementById("airline-primary").value = colors.primary
  document.getElementById("airline-secondary").value = colors.secondary
  document.getElementById("airline-fuselage").value = colors.fuselage
  panel.classList.toggle("locked-fedex", locked)
}

function hangarSwatch(def, colors = loadAirlineColors()) {
  if (def.brand === "fedex" || def.lockedLivery === "fedex") {
    return "linear-gradient(135deg, #f7f7f5 0%, #4D148C 55%, #FF6600 100%)"
  }
  if (isAirliner(def)) {
    return `linear-gradient(135deg, ${colors.fuselage}, ${colors.primary})`
  }
  return `linear-gradient(135deg, ${def.body}, ${def.accent})`
}

function repaintAirlineFleet(colors) {
  saveAirlineColors(colors)
  if (player && !isCar(player.def)) applyDemiAirline(player, colors)
  for (const craft of parked) applyDemiAirline(craft, colors)
  for (const button of buttons) {
    const def = FLEET[Number(button.dataset.index)]
    if (!isAirliner(def)) continue
    button.querySelector(".swatch").style.background = hangarSwatch(def, colors)
  }
}

let selectToken = 0

function selectPlane(index) {
  void selectVehicle(index)
}

async function selectVehicle(index) {
  if (index === selected && player) return
  const def = FLEET[index]
  if (!def) return
  const token = ++selectToken
  selected = index
  document.getElementById("plane-name").textContent =
    def.brand === "fedex"
      ? `${def.name} · FedEx Express`
      : isAirliner(def) ? `${def.name} · ${AIRLINE_NAME}` : def.name
  document.getElementById("plane-role").textContent = def.role
  document.getElementById("plane-blurb").textContent = def.blurb
  document.getElementById("plane-parts").textContent = partSummary(def)
  document.getElementById("fly-btn").textContent = `${actionVerb(def)} the ${def.name}`
  syncAirlinePaintUI(def)
  if (def.id === "md11") {
    // ¾ front-side view so the FedEx titles + #3 inlet read clearly.
    orbitYaw = 0.95
    orbitPitch = 0.18
    orbitDist = Math.max(def.length * 1.05, def.wing.span * 0.7) + 10
    orbitAuto = false
  }
  for (const button of buttons) button.classList.toggle("active", Number(button.dataset.index) === index)
  const active = buttons.find((button) => Number(button.dataset.index) === index)
  active?.scrollIntoView({ block: "nearest" })

  // Cars are procedural — only aircraft GLBs need a hangar load wait.
  if (!isCar(def) && !isModelCached(def.id)) {
    boot.hidden = false
    boot.textContent = `Loading ${def.name}…`
    await ensureModel(def.id)
    if (token !== selectToken) return
    boot.hidden = true
  }

  if (homeCraft && homeCraft !== player) {
    scene.remove(homeCraft.root)
    disposeVehicle(homeCraft)
  }
  homeCraft = null
  if (player) {
    const wi = worldCars.indexOf(player)
    if (wi >= 0) worldCars.splice(wi, 1)
    scene.remove(player.root)
    disposeVehicle(player)
  }
  player = createVehicle(def)
  scene.add(player.root)
  if (typeof window !== "undefined") window.__player = player
  if (isCar(def)) {
    place(player, PAD.x - 40, PAD.z + 40, 0.4)
    orbitDist = Math.max(def.length * 3.2, 14)
  } else {
    place(player, PAD.x, PAD.z, 0.4)
    orbitDist = Math.max(def.length * 1.15, def.wing.span * 0.72) + 8
  }
  snapCam = true
}

function selectRelative(step) {
  const query = planeQuery.trim().toLowerCase()
  let index = selected
  for (let n = 0; n < FLEET.length; n += 1) {
    index = (index + step + FLEET.length) % FLEET.length
    if (planeMatches(FLEET[index], query)) {
      void selectVehicle(index)
      return
    }
  }
}

function swapPanelOpen() {
  const panel = document.getElementById("swap-panel")
  return Boolean(panel && !panel.hidden)
}

function setSwapPanelOpen(open) {
  const panel = document.getElementById("swap-panel")
  if (!panel) return
  panel.hidden = !open
  if (open) {
    refreshSwapList()
    if (chatOpen()) setChatOpen(false)
  }
}

function refreshSwapList() {
  const list = document.getElementById("swap-list")
  if (!list) return
  const query = swapQuery.trim().toLowerCase()
  list.innerHTML = ""
  let shown = 0
  FLEET.forEach((def, index) => {
    if (!planeMatches(def, query)) return
    shown += 1
    const button = document.createElement("button")
    button.type = "button"
    button.className = "swap-item"
    if (index === selected) button.classList.add("active")
    button.innerHTML = `<span class="swap-name">${def.name}</span><span class="swap-role">${def.role || ""}</span>`
    button.addEventListener("click", () => {
      void changePlaneInFlight(index)
    })
    list.appendChild(button)
  })
  const empty = document.getElementById("swap-empty")
  if (empty) empty.hidden = shown > 0 || !query
  list.querySelector(".swap-item.active")?.scrollIntoView({ block: "nearest" })
}

/**
 * Swap aircraft mid-flight / mid-drive while keeping world pose and speed.
 */
async function changePlaneInFlight(index) {
  if (mode !== "fly" || recovering || outside) {
    toast("Start flying first, then tap Planes.")
    return
  }
  const def = FLEET[index]
  if (!def || !player) return
  if (index === selected) {
    setSwapPanelOpen(false)
    return
  }

  const token = ++selectToken
  const prev = player
  const pos = prev.root.position.clone()
  const quat = prev.root.quaternion.clone()
  const vel = velocity.clone()
  const thr = throttle
  const gearUp = (prev.controls?.gear ?? 1) > 0.5
  const lightsOn = (prev.controls?.lights ?? 0) > 0.5
  const wasAir = wasAirborne
  const agl = Math.max(0, pos.y - clearanceOf(prev))

  selected = index
  for (const button of buttons) button.classList.toggle("active", Number(button.dataset.index) === index)

  if (!isCar(def) && !isModelCached(def.id)) {
    boot.hidden = false
    boot.textContent = `Loading ${def.name}…`
    await ensureModel(def.id)
    if (token !== selectToken) return
    boot.hidden = true
  }
  if (token !== selectToken) return

  if (homeCraft && homeCraft !== prev) {
    scene.remove(homeCraft.root)
    disposeVehicle(homeCraft)
  }
  homeCraft = null
  const wi = worldCars.indexOf(prev)
  if (wi >= 0) worldCars.splice(wi, 1)
  scene.remove(prev.root)
  disposeVehicle(prev)

  player = createVehicle(def)
  scene.add(player.root)
  if (typeof window !== "undefined") window.__player = player
  if (isCar(def) && !worldCars.includes(player)) worldCars.push(player)

  player.root.position.copy(pos)
  player.root.quaternion.copy(quat)
  player.root.updateMatrixWorld(true)
  // Keep height above ground; new gear sit height may differ.
  const nextClear = clearanceOf(player)
  player.root.position.y = Math.max(nextClear + 0.02, nextClear + agl)
  velocity.copy(vel)
  // Soft-cap ridiculous speed jumps when swapping a jet for a Cub, etc.
  const maxSpd = isCar(def)
    ? Math.max(28, def.drive?.maxSpeed || 35)
    : Math.max(def.flight?.cruise || 55, (def.flight?.stall || 30) * 2.4)
  if (velocity.length() > maxSpd) velocity.setLength(maxSpd)
  throttle = THREE.MathUtils.clamp(thr, 0, 1)
  takeoffBoost = 0
  wasAirborne = wasAir
  grounded = player.root.position.y <= clearanceOf(player) + 0.12

  resetControls(player)
  if (!isCar(def)) {
    // Stay gear-up if you were flying clean; gear-down on the ground.
    const wantGear = grounded || !gearUp ? 1 : 0
    player.controls.gear = wantGear
    for (const part of player.parts) {
      if (part.group !== "gear") continue
      part.t = wantGear
      part.dest = wantGear
      part.apply(part.t)
    }
    player.gearT = wantGear
  }
  if (lightsOn) {
    player.controls.lights = 1
    player.setLights?.(true)
  }
  player.setCockpit(cameraMode === COCKPIT_CAM && !isCar(def))

  document.getElementById("hud-name").textContent =
    def.brand === "fedex"
      ? `${def.name} · FedEx Express`
      : isAirliner(def) ? `${def.name} · ${AIRLINE_NAME}` : def.name
  document.getElementById("hints").textContent = hintLine(def)
  document.getElementById("plane-name").textContent =
    def.brand === "fedex"
      ? `${def.name} · FedEx Express`
      : isAirliner(def) ? `${def.name} · ${AIRLINE_NAME}` : def.name
  document.getElementById("plane-role").textContent = def.role
  document.getElementById("plane-blurb").textContent = def.blurb
  document.getElementById("plane-parts").textContent = partSummary(def)
  document.getElementById("fly-btn").textContent = `${actionVerb(def)} the ${def.name}`
  syncAirlinePaintUI(def)
  renderPartButtons()
  refreshSysPanel()
  refreshFlyActions()
  refreshApPanel()
  refreshSwapList()
  setSwapPanelOpen(false)
  snapCam = true
  netSyncAcc = 99
  toast(isCar(def) ? `Now driving the ${def.name}` : `Now flying the ${def.name}`)
}

function resetControls(craft) {
  if (isCar(craft.def)) {
    craft.controls = { lights: 0 }
    craft.setLights(false)
    return
  }
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

function clearHomeLand() {
  ap.land = false
  ap.landPhase = null
  ap.landHdg = 0
  ap.landFix = null
  ap.landThresh = null
  ap.inbound = false
  ap.rolloutUntil = 0
}

function disengageAp(reason) {
  if (!ap.on) {
    clearHomeLand()
    return
  }
  ap.on = false
  clearHomeLand()
  refreshApPanel()
  if (reason) toast(reason)
}

function captureApTargets() {
  if (playerIsCar() || !player.def.flight) return
  forward.set(0, 0, 1).applyQuaternion(player.root.quaternion)
  ap.targetHdg = Math.round(currentHeadingDeg())
  ap.targetAlt = Math.max(30, Math.round(currentAltM()))
  const flight = player.def.flight
  // Never engage with a near-stall speed bug — climb needs a real cruise margin.
  ap.targetSpd = Math.max(
    flight.stall * 1.55,
    flight.cruise * 0.78,
    velocity.length() > 8 ? velocity.length() : flight.cruise * 0.85
  )
}

/** Clean the airframe so AP climb isn't fighting gear/flap drag. */
function configureApClimb() {
  if (!player || playerIsCar()) return
  if (player.def.gear?.mode === "retract" && player.controls.gear > 0.5) {
    player.controls.gear = 0
  }
  if (player.def.flaps && player.controls.flapStep > 0) player.controls.flapStep = 0
  if (player.def.spoilers) player.controls.spoilers = 0
}

/** Gear and flaps for home-airport approach. */
function configureApLanding(fullFlaps = false) {
  if (!player || playerIsCar()) return
  if (player.def.gear?.mode === "retract" && player.controls.gear < 0.5) {
    if (failures.gearJam) {
      /* leave gear as-is */
    } else {
      player.controls.gear = 1
    }
  }
  if (player.def.flaps) {
    const want = fullFlaps ? 3 : 2
    if (player.controls.flapStep < want) player.controls.flapStep = want
  }
  if (player.def.spoilers) player.controls.spoilers = 0
}

function bearingToDeg(fromX, fromZ, toX, toZ) {
  return (THREE.MathUtils.radToDeg(Math.atan2(toX - fromX, toZ - fromZ)) + 360) % 360
}

function homeLandPlanForHdg(landHdg) {
  const rx = RUNWAY.x
  if (landHdg < 90 || landHdg > 270) {
    return {
      landHdg: 0,
      threshX: rx,
      threshZ: RUNWAY.z0,
      fixX: rx,
      fixZ: RUNWAY.z0 - LAND_FIX_DIST,
    }
  }
  return {
    landHdg: 180,
    threshX: rx,
    threshZ: RUNWAY.z1,
    fixX: rx,
    fixZ: RUNWAY.z1 + LAND_FIX_DIST,
  }
}

function designatedLandPlan() {
  return homeLandPlanForHdg(RUNWAY.landHdg || 0)
}

/** Along-track of the landing line: 10 ft past the last guide light. Altitude is 0 here. */
function minTouchAlong() {
  return -((RUNWAY.lightInset || 0) + (RUNWAY.touchClear || 0))
}

function approachGateAlt() {
  return RUNWAY.gateAlt || 100 * 0.3048
}

function lightLeadM() {
  return RUNWAY.lightLead || 1600
}

/** 100 ft until the first light, then a straight line down to 0 on the landing line. */
function lightGlideAlt(along) {
  const gate = approachGateAlt()
  const lead = lightLeadM()
  const touch = minTouchAlong()
  if (along >= lead) return gate
  if (along <= touch) return 0
  return gate * (along - touch) / (lead - touch)
}

function computeHomeLandPlan() {
  // Land the way the aircraft was parked, following that runway's guide lights.
  return designatedLandPlan()
}

function applyHomeLandPlan(plan) {
  ap.landHdg = plan.landHdg
  ap.landFix = { x: plan.fixX, z: plan.fixZ }
  ap.landThresh = { x: plan.threshX, z: plan.threshZ }
}

/** Signed distance remaining to threshold along the landing direction. Positive = before threshold. */
function alongToThreshold(pz, threshZ, landHdg) {
  const alongSign = Math.cos(THREE.MathUtils.degToRad(landHdg))
  return (threshZ - pz) * alongSign
}

function runwayCrossTrack(px) {
  return px - RUNWAY.x
}

function setHomeLandPhase(next, message) {
  if (ap.landPhase === next) return
  ap.landPhase = next
  refreshApPanel()
  if (message) toast(message)
}

function updateHomeLand(_dt, speed) {
  if (!ap.land || !player?.def?.flight || !ap.landFix || !ap.landThresh) return
  const flight = player.def.flight
  const px = player.root.position.x
  const pz = player.root.position.z
  const alt = currentAltM()
  const fix = ap.landFix
  const thresh = ap.landThresh
  const distFix = Math.hypot(px - fix.x, pz - fix.z)
  const along = alongToThreshold(pz, thresh.z, ap.landHdg)
  const xtk = Math.abs(runwayCrossTrack(px))
  const approachSpd = Math.max(flight.stall * 1.35, flight.cruise * 0.42, 22)
  const hdg = currentHeadingDeg()
  const hdgErr = Math.abs(((ap.landHdg - hdg + 540) % 360) - 180)

  const gearDown = player.def.gear?.mode !== "retract" || (player.controls.gear > 0.5 && player.gearT > 0.7)
  const linedUp = xtk < 40 && hdgErr < 10 && along >= LAND_LINEUP_MIN && gearDown
  const alongSign = Math.cos(THREE.MathUtils.degToRad(ap.landHdg))
  // A couple of degrees of correction keeps the straight-in on the centerline
  // without bending the path into a turn.
  const straightSteer = THREE.MathUtils.clamp(-runwayCrossTrack(px) * alongSign * 0.045, -4, 4)
  const captureSteer = THREE.MathUtils.clamp(-runwayCrossTrack(px) * alongSign * 0.08, -40, 40)

  // Past the runway and still flying — go to the other end instead of skimming away.
  if (along < -80 && ap.landPhase !== "nav" && ap.landPhase !== "flare") {
    applyHomeLandPlan(designatedLandPlan())
    ap.inbound = false
    setHomeLandPhase("nav", "Autoland · following the lights")
    return
  }

  // Still turning inside 200 ft. Go back to the lineup point instead of descending.
  if (
    along < LAND_LINEUP_MIN
    && (xtk > 35 || hdgErr > 12)
    && ap.landPhase !== "nav"
    && ap.landPhase !== "flare"
  ) {
    applyHomeLandPlan(designatedLandPlan())
    ap.inbound = false
    setHomeLandPhase("nav", "Autoland · lining up farther out")
    return
  }

  if (ap.landPhase === "nav") {
    const distField = Math.hypot(px - RUNWAY.x, pz - (RUNWAY.z0 + RUNWAY.z1) * 0.5)
    if (distField < 5500) configureApLanding(false)
    else configureApClimb()
    const gate = approachGateAlt()
    const lead = lightLeadM()
    // Turn back at the first light. Flying on for kilometers was only to bleed down to 30 m.
    if (!ap.inbound && along >= lead && xtk < 280) ap.inbound = true
    if (!ap.inbound && along > lead + 500) ap.inbound = true
    if (!ap.inbound && xtk < 110 && hdgErr < 30 && along >= lead * 0.7 && alt <= gate + 18) ap.inbound = true
    ap.targetSpd = Math.max(flight.stall * 1.42, Math.min(flight.cruise * 0.48, 115))
    // 30 m by the first light. The sloping path starts there.
    ap.targetAlt = lightGlideAlt(Math.max(along, lead))
    if (!ap.inbound && along < lead) {
      const outbound = (ap.landHdg + 180) % 360
      const outboundSteer = THREE.MathUtils.clamp(runwayCrossTrack(px) * alongSign * 0.05, -30, 30)
      ap.targetHdg = (outbound + outboundSteer + 360) % 360
      return
    }
    ap.targetHdg = (ap.landHdg + captureSteer + 360) % 360
    if (alt <= gate + 8 && hdgErr < 18 && xtk < 70 && along >= lead) {
      setHomeLandPhase("align", "Autoland · lining up")
    }
    return
  }

  if (ap.landPhase === "align") {
    configureApLanding(false)
    // Heading stays on the runway. A wider nudge is allowed until the descent
    // starts, so a late capture can still reach the centerline.
    ap.targetHdg = (ap.landHdg + captureSteer + 360) % 360
    ap.targetAlt = lightGlideAlt(along)
    ap.targetSpd = Math.max(approachSpd, flight.stall * 1.35)
    if (linedUp && along <= lightLeadM() && alt <= approachGateAlt() + 6) {
      setHomeLandPhase("final", "Autoland · straight in")
    }
    return
  }

  if (ap.landPhase === "final") {
    configureApLanding(true)
    // 100 ft at the first light, then a straight line that is on the pavement at the landing line.
    ap.targetHdg = (ap.landHdg + straightSteer + 360) % 360
    ap.targetAlt = lightGlideAlt(along)
    ap.targetSpd = flight.stall * 1.25
    if (along < 40 && along > minTouchAlong() - 30 && alt < 8 && xtk < 28 && hdgErr < 12) {
      setHomeLandPhase("flare", "Autoland · flare")
    }
    return
  }

  if (ap.landPhase === "flare") {
    configureApLanding(true)
    ap.targetHdg = (ap.landHdg + straightSteer * 0.35 + 360) % 360
    ap.targetAlt = 0
    ap.targetSpd = flight.stall * 1.25
  }
}

function handleHomeLandRollout(dt, speed) {
  if (ap.landPhase !== "rollout") {
    ap.landPhase = "rollout"
    ap.rolloutUntil = performance.now() + 5000
    const name = world.airportName || "home airport"
    toast(`Landed at ${name}`)
    beep(880, 0.1)
    setTimeout(() => beep(1100, 0.12), 100)
  }
  const rolling = performance.now() < ap.rolloutUntil
  throttle = 0
  braking = false
  if (player?.def?.spoilers) player.controls.spoilers = rolling ? 0 : 1
  if (rolling) return
  braking = true
  if (speed < 1.8) {
    systems.parking = true
    const name = world.airportName || "home airport"
    disengageAp(`Parked at ${name}`)
  }
}

function toggleHomeLand() {
  if (mode !== "fly" || !player || playerIsCar()) return
  if (failures.elec) {
    toast("Electrical failure — autopilot unavailable.")
    beep(200, 0.1, "square")
    return
  }
  if (ap.land) {
    if (performance.now() < ap.landArm) return
    clearHomeLand()
    refreshApPanel()
    toast("Autoland cancelled.")
    beep(420, 0.08)
    return
  }
  if (grounded) {
    toast("Take off first, then engage home land.")
    return
  }
  applyHomeLandPlan(computeHomeLandPlan())
  ap.landArm = performance.now() + 1200
  ap.land = true
  ap.landPhase = "nav"
  ap.on = true
  ap.hdg = true
  ap.alt = true
  ap.spd = true
  configureApClimb()
  updateHomeLand(0.016, velocity.length())
  refreshApPanel()
  toast(`Autoland → ${world.airportName || "home airport"} · flying to approach`)
  beep(740, 0.08)
  setTimeout(() => beep(980, 0.1), 90)
}

function toggleAutopilot() {
  if (mode !== "fly" || !player || playerIsCar()) return
  if (failures.elec) {
    toast("Electrical failure — autopilot unavailable.")
    beep(200, 0.1, "square")
    return
  }
  if (ap.on) {
    disengageAp("Autopilot off.")
    return
  }
  if (grounded) {
    toast("Take off first, then turn on autopilot.")
    return
  }
  clearHomeLand()
  captureApTargets()
  configureApClimb()
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
    // Small steps — big ALT jumps were commanding climbs the airframe couldn't sustain.
    ap.targetAlt = THREE.MathUtils.clamp(ap.targetAlt + dir * 25, 30, 4000)
    ap.alt = true
    if (dir > 0 && player?.def?.flight) {
      const climbSpd = Math.max(player.def.flight.stall * 1.65, player.def.flight.cruise * 0.88)
      ap.targetSpd = Math.max(ap.targetSpd, climbSpd)
      ap.spd = true
      configureApClimb()
      throttle = Math.max(throttle, 0.9)
    }
  }
  if (!ap.on && mode === "fly" && !grounded) {
    captureApTargets()
    configureApClimb()
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
  const land = document.getElementById("ap-land")
  if (!master) return
  master.classList.toggle("on", ap.on)
  master.textContent = ap.on ? "AP ON" : "AP OFF"
  hdg.classList.toggle("on", ap.on && ap.hdg)
  alt.classList.toggle("on", ap.on && ap.alt)
  spd.classList.toggle("on", ap.on && ap.spd)
  if (land) {
    land.classList.toggle("on", ap.on && ap.land)
    if (ap.land && ap.landPhase) {
      const tag = String(ap.landPhase).slice(0, 5).toUpperCase()
      land.textContent = tag
    } else {
      land.textContent = "HOME"
    }
  }
  document.getElementById("ap-hdg-read").textContent = `HDG ${String(Math.round(ap.targetHdg) % 360).padStart(3, "0")}`
  document.getElementById("ap-alt-read").textContent = `ALT ${Math.round(ap.targetAlt)} m`
  document.getElementById("ap-spd-read").textContent = `SPD ${Math.round(ap.targetSpd * 3.6)} km/h`
  systems.autopilot = ap.on
  systems.autothrottle = ap.on && ap.spd
  systems.apApp = ap.on && ap.land
  refreshSysPanel()
  refreshSysDocks()
}

function refreshSysPanel() {
  if (player) {
    systems.landing = player.controls.lights > 0.5
    systems.landingL = systems.landing
    systems.landingR = systems.landing
    if (isCar(player.def)) {
      systems.gear = false
      systems.gearUp = false
      systems.gearDown = true
      systems.doors = false
      systems.flaps = false
      systems.cargo = false
      systems.nose = false
      systems.spoilers = false
      systems.autopilot = false
      systems.autothrottle = false
      systems.apHdg = false
      systems.apAlt = false
      systems.apApp = false
    } else {
      systems.gear = player.def.gear?.mode === "retract" && player.controls.gear < 0.5
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
      systems.apApp = ap.on && ap.land
    }
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
      if (!ap.hdg) clearHomeLand()
      refreshApPanel()
      toast(ap.hdg ? "Heading hold on" : "Heading hold off")
    }
    return
  } else if (id === "apAlt" || id === "apVs" || id === "apLvl") {
    if (!ap.on) toggleAutopilot()
    else {
      ap.alt = !ap.alt
      if (!ap.alt) clearHomeLand()
      refreshApPanel()
      toast(ap.alt ? "Altitude hold on" : "Altitude hold off")
    }
    return
  } else if (id === "apApp" || id === "apLoc") {
    toggleHomeLand()
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
    if ((id === "fireLeft" || id === "fireRight") && systems[id] && failures.fire) {
      failures.fire = false
      failures.fireIndex = -1
      toast("Fire extinguished!")
      beep(720, 0.1)
      refreshFailCautions()
    } else {
      toast(systems[id] ? `${def.label} pulled!` : `${def.label} stowed`)
    }
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
  if (!ap.on || recovering) return

  if (ap.land && grounded) {
    handleHomeLandRollout(dt, speed)
    return
  }
  if (grounded) return

  const flight = player.def.flight
  const pilot = Math.max(Math.abs(held.pitch), Math.abs(held.roll), Math.abs(held.yaw))
  const keysPilot = keys.has("KeyW") || keys.has("KeyS") || keys.has("KeyA") || keys.has("KeyD")
    || keys.has("ArrowUp") || keys.has("ArrowDown") || keys.has("ArrowLeft") || keys.has("ArrowRight")
    || keys.has("KeyQ") || keys.has("KeyE")
  // Home land tolerates light touch drag so camera looks don't cancel the approach.
  const kick = ap.land ? 0.82 : 0.45
  if (pilot > kick || keysPilot) {
    disengageAp("Autopilot kicked off — you took the stick.")
    return
  }

  if (ap.land) updateHomeLand(dt, speed)

  const landing = ap.land && (ap.landPhase === "align" || ap.landPhase === "final" || ap.landPhase === "flare")
  const descending = ap.land && (landing || (ap.landPhase === "nav" && currentAltM() > LAND_NAV_ALT + 20))
  const flaring = ap.land && ap.landPhase === "flare"

  forward.set(0, 0, 1).applyQuaternion(player.root.quaternion)
  up.set(0, 1, 0).applyQuaternion(player.root.quaternion)
  right.set(1, 0, 0).applyQuaternion(player.root.quaternion)
  const bankRad = Math.atan2(right.y, up.y)
  const pitchNow = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1))
  const hdg = currentHeadingDeg()
  const hdgErr = ((ap.targetHdg - hdg + 540) % 360) - 180
  const alt = currentAltM()
  const altErr = ap.targetAlt - alt
  let pathPitch = 0
  if (speed > 1.5) pathPitch = Math.asin(THREE.MathUtils.clamp(velocity.y / speed, -1, 1))
  const aoaNow = pitchNow - pathPitch

  // Speed first. Climb is gated hard so ALT bumps can't haul into a stall spiral.
  const minSafe = ap.land ? flight.stall * (flaring ? 1.05 : 1.18) : flight.stall * 1.5
  const climbReady = speed > flight.stall * 1.7 && aoaNow < 0.16 && pitchNow < 0.14
  const slow = speed < minSafe
  const noseHigh = pitchNow > 0.16 || aoaNow > 0.18
  const protecting = !landing && !descending && (slow || noseHigh)
  const energy = THREE.MathUtils.clamp((speed - minSafe) / Math.max(12, flight.cruise * 0.4), 0, 1)
  const low = alt < 120

  // Home land yaws the nose toward the runway and keeps the wings level.
  // Banking for that turn was rolling the jet over instead of bringing it back.
  if (ap.land) {
    stick.roll = THREE.MathUtils.clamp(-bankRad * 2.2, -1, 1)
    stick.yaw = THREE.MathUtils.clamp(-hdgErr / 16, -1, 1)
  } else if (ap.hdg && !protecting) {
    const bankCap = flaring ? 0.22
      : ap.landPhase === "final" ? 0.32
      : ap.land ? 0.45
      : climbReady && altErr > 30 ? 0.25 : 0.38
    const desiredRight = THREE.MathUtils.clamp(hdgErr * (ap.land ? 0.028 : 0.02), -bankCap, bankCap)
    stick.roll = THREE.MathUtils.clamp((desiredRight - bankRad) * 1.4, -1, 1)
  } else {
    stick.roll = THREE.MathUtils.clamp(-bankRad * 1.8, -1, 1)
  }
  if (!ap.land) stick.yaw = 0

  if (ap.land) {
    // The flight path follows the nose, so an altitude-error dive (about -10°)
    // at jet speed is a sink past the hard-landing limit. Command a sink rate
    // and pitch only enough to match it.
    const speedSafe = Math.max(speed, 28)
    const landAlong = alongToThreshold(
      player.root.position.z,
      ap.landThresh?.z ?? RUNWAY.z0,
      ap.landHdg || RUNWAY.landHdg || 0,
    )
    const lead = lightLeadM()
    const touch = minTouchAlong()
    const onSlope = (ap.landPhase === "align" || ap.landPhase === "final") && landAlong < lead && landAlong > touch
    const slope = approachGateAlt() / Math.max(1, lead - touch)
    let vyTarget = 0
    if (flaring) {
      vyTarget = -1.2
    } else if (onSlope) {
      const track = -speedSafe * slope
      vyTarget = THREE.MathUtils.clamp(track + (ap.targetAlt - alt) * 0.25, -4.5, 1.2)
    } else if (alt > ap.targetAlt + 35) {
      // Lose the extra height before the lights, instead of flying miles out at a crawl.
      vyTarget = -9
    } else if (alt > ap.targetAlt + 6) {
      vyTarget = -5
    } else if (alt < ap.targetAlt - 8) {
      vyTarget = THREE.MathUtils.clamp((ap.targetAlt - alt) * 0.06, 0.4, 4)
    }
    // Stay off the pavement until the landing line, then meet it at 0.
    if (landAlong > touch && alt < 2) vyTarget = Math.max(vyTarget, 0.15)
    let wantPitch = Math.asin(THREE.MathUtils.clamp(vyTarget / speedSafe, -0.1, 0.22))
    if (!onSlope && !flaring && alt <= ap.targetAlt + 4) wantPitch = Math.max(wantPitch, 0)
    if (flaring && velocity.y < -2.2) wantPitch = Math.max(wantPitch, 0.04)
    stick.pitch = THREE.MathUtils.clamp((wantPitch - pitchNow) * 1.7, -0.65, 0.55)
  } else if (protecting) {
    // Unload the wing, but don't dive into the dirt when low.
    const recoverPitch = low ? (noseHigh ? 0.0 : 0.04) : -0.1
    stick.pitch = THREE.MathUtils.clamp((recoverPitch - pitchNow) * 1.8, low ? -0.35 : -0.7, 0.2)
  } else if (ap.alt) {
    // Hold with tiny pitch; only climb once energy is clearly there.
    let wantPitch = 0.02
    if (!landing && !descending && climbReady && altErr > 8) {
      const climbCap = THREE.MathUtils.lerp(2, 6.5, energy)
      const wantClimb = THREE.MathUtils.clamp(altErr * 0.06, 0, climbCap)
      wantPitch = THREE.MathUtils.clamp(0.02 + wantClimb * 0.008, 0.02, 0.08)
    } else if ((landing || descending) && altErr < -4) {
      // Stronger sink authority so approaches actually get down to the glideslope.
      wantPitch = THREE.MathUtils.clamp(altErr * 0.0022, -0.18, -0.025)
    } else if (altErr < -8) {
      wantPitch = THREE.MathUtils.clamp(altErr * 0.0008, -0.14, -0.02)
    } else if (landing && altErr > 8) {
      wantPitch = THREE.MathUtils.clamp(0.02 + altErr * 0.0006, 0.02, 0.08)
    } else {
      wantPitch = THREE.MathUtils.clamp(altErr * 0.0005, -0.05, 0.05)
    }
    stick.pitch = THREE.MathUtils.clamp((wantPitch - pitchNow) * 1.35, -1, 1)
  } else {
    stick.pitch = THREE.MathUtils.clamp((0.02 - pitchNow) * 1.2, -1, 1)
  }

  // Autothrottle — allow idle on final/flare; keep energy on cruise AP.
  let spdTarget = ap.land
    ? Math.max(ap.targetSpd, flight.stall * (flaring ? 1.05 : 1.18))
    : Math.max(ap.targetSpd, flight.stall * 1.6, flight.cruise * 0.8)
  if (!ap.land && !landing && altErr > 15) spdTarget = Math.max(spdTarget, flight.cruise * 0.88)
  if (!ap.land && !landing && !descending && (protecting || slow)) spdTarget = Math.max(spdTarget, flight.cruise * 0.92)
  const spdErr = spdTarget - speed
  const thrMin = flaring ? 0 : ap.land ? 0.04 : 0.45
  const thrMax = flaring ? 0.4 : 1
  if (flaring) {
    throttle = THREE.MathUtils.clamp(throttle - dt * 0.9, 0, 0.12)
  } else if (descending && altErr < -25 && speed > flight.stall * 1.3) {
    // Pull power in a high approach so we can make the slope.
    throttle = THREE.MathUtils.clamp(throttle + Math.min(0, spdErr) * 0.04 * dt * 60, 0.15, 0.85)
  } else {
    throttle = THREE.MathUtils.clamp(throttle + spdErr * 0.03 * dt * 60, thrMin, thrMax)
  }
  if (!ap.land && !landing && !descending && (protecting || altErr > 15 || slow)) throttle = 1
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
  crashFx?.clear()
  velocity.set(0, 0, 0)
  lastTrackYaw = null
  throttle = 0
  takeoffBoost = 0
  rotateWait = 0
  holdBank = 0
  holdPitch = 0
  rollLatch = 0
  pitchLatch = 0
  pitchTouched = false
  wasAirborne = false
  grounded = true
  systems.parking = false
  ap.on = false
  clearHomeLand()
  clearFailures({ quiet: true })
  clearCautions()
  resetControls(player)
  if (playerIsCar()) place(player, PAD.x - 40, PAD.z + 40, 0.4)
  else place(player, localOrigin.x + 0, localOrigin.z + 80, 0)
  player.setCockpit(cameraMode === 1 && !playerIsCar())
  snapCam = true
  refreshApPanel()
  if (message) toast(message)
}

function startFlight() {
  if (!player) return
  refreshBanLock()
  if (isBanned()) {
    toast(`Banned — wait ${formatBanClock(banRemainingMs())}.`)
    return
  }
  world.resetRings()
  distance = 0
  toldRotate = false
  coachOn = true
  cameraMode = 0
  hideCrashScreen()
  recovering = false
  crashTimer = 0
  crashFx?.clear()
  resetToRunway()
  mode = "fly"
  menu.hidden = true
  const settingsPage = document.getElementById("settings-page")
  if (settingsPage) settingsPage.hidden = true
  hud.hidden = false
  const coach = document.getElementById("coach")
  coach.hidden = false
  coach.textContent = playerIsCar()
    ? "Push Up / W or slide throttle to drive. Steer with Left / Right. Space brakes. Down reverses."
    : "Throttle up, then use the stick or arrow keys to bank and pitch."
  document.getElementById("hud-name").textContent =
    player.def.brand === "fedex"
      ? `${player.def.name} · FedEx Express`
      : isAirliner(player.def) ? `${player.def.name} · ${AIRLINE_NAME}` : player.def.name
  document.getElementById("hints").textContent = hintLine(player.def)
  renderPartButtons()
  refreshSysPanel()
  refreshWxPanel()
  refreshFlyActions()
  refreshFailPanel()
  syncChatChrome()
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
  hideCrashScreen()
  setSwapPanelOpen(false)
  setFlyMore(false)
  failOpen = false
  apOpen = false
  partsOpen = false
  crashFx?.clear()
  recovering = false
  crashTimer = 0
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
  lastTrackYaw = null
  const settingsPage = document.getElementById("settings-page")
  if (settingsPage) settingsPage.hidden = true
  velocity.set(0, 0, 0)
  ap.on = false
  clearHomeLand()
  clearCautions()
  refreshApPanel()
  refreshWxPanel()
  refreshFailPanel()
  syncChatChrome()
  player.setCockpit(false)
  camera.up.set(0, 1, 0)
  camera.fov = 60
  camera.updateProjectionMatrix()
  if (playerIsCar()) place(player, PAD.x - 40, PAD.z + 40, 0.4)
  else place(player, PAD.x, PAD.z, 0.4)
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
  if (playerIsCar() && cameraMode === COCKPIT_CAM) cameraMode = (cameraMode + 1) % CAMERA_NAMES.length
  player.setCockpit(cameraMode === COCKPIT_CAM && !playerIsCar())
  camera.up.set(0, 1, 0)
  camera.fov = cameraMode === COCKPIT_CAM ? 70 : 60
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

let crashPromptOpen = false
let lastCrashMessage = "That didn’t go as planned."

function hideCrashScreen() {
  const screen = document.getElementById("crash-screen")
  if (screen) screen.hidden = true
  crashPromptOpen = false
}

function showCrashScreen(message) {
  lastCrashMessage = message || lastCrashMessage
  const screen = document.getElementById("crash-screen")
  const msg = document.getElementById("crash-message")
  if (msg) msg.textContent = lastCrashMessage
  if (screen) screen.hidden = false
  crashPromptOpen = true
  recovering = true
  velocity.set(0, 0, 0)
  lastTrackYaw = null
  crashTimer = 0
  crashSpin.set(0, 0, 0)
  throttle = 0
  ap.on = false
  clearHomeLand()
}

function respawnAfterCrash() {
  hideCrashScreen()
  crashFx?.clear()
  if (player) {
    player.root.rotation.x = 0
    player.root.rotation.z = 0
  }
  recovering = false
  resetToRunway("Back on the runway. Try again!")
  mode = "fly"
  menu.hidden = true
  hud.hidden = false
  const settingsPage = document.getElementById("settings-page")
  if (settingsPage) settingsPage.hidden = true
  snapCam = true
  beep(520, 0.08)
}

function hangarAfterCrash() {
  hideCrashScreen()
  crashFx?.clear()
  if (player) {
    player.root.rotation.x = 0
    player.root.rotation.z = 0
  }
  recovering = false
  showMenu()
  beep(320, 0.08)
}

function bindCrashScreen() {
  document.getElementById("crash-respawn")?.addEventListener("click", () => {
    ensureAudio()
    respawnAfterCrash()
  })
  document.getElementById("crash-hangar")?.addEventListener("click", () => {
    ensureAudio()
    hangarAfterCrash()
  })
}

function crash(message) {
  if (recovering || mode !== "fly" || crashPromptOpen) return
  if (cheats.admin && !cheats.crashPhysics) {
    velocity.multiplyScalar(-0.25)
    velocity.y = Math.max(2, Math.abs(velocity.y) * 0.35)
    toast(`${message} (admin shrug)`)
    beep(220, 0.12, "triangle")
    return
  }
  recovering = true
  lastCrashMessage = message || "That didn’t go as planned."
  toast(message)
  beep(90, 0.35, "sawtooth")
  crashTimer = playerIsCar() ? 4.2 : 5.5
  crashGroundHits = 0
  // Tumble, then burn. This used to wait on the crash-physics cheat.
  const horiz = Math.hypot(velocity.x, velocity.z)
  crashRollAxis.set(-velocity.z, 0, velocity.x)
  if (crashRollAxis.lengthSq() < 0.01) crashRollAxis.set(1, 0, 0)
  crashRollAxis.normalize()
  crashSpin.set(
    (Math.random() - 0.5) * 9 + crashRollAxis.x * (4 + horiz * 0.08),
    (Math.random() - 0.5) * 5.5,
    (Math.random() - 0.5) * 10 + crashRollAxis.z * (4 + horiz * 0.08)
  )
  const kick = playerIsCar() ? 16 : 22
  velocity.x += (Math.random() - 0.5) * kick
  velocity.z += (Math.random() - 0.5) * kick
  velocity.y = playerIsCar() ? Math.abs(velocity.y) + 5 : Math.max(velocity.y, 2) + 10
  crashFx?.begin({
    craft: player,
    position: player.root.position.clone(),
    velocity: velocity.clone(),
    isCar: playerIsCar(),
  })
  setTimeout(() => beep(55, 0.45, "sawtooth"), 120)
  setTimeout(() => beep(40, 0.55, "square"), 280)
}

function stepCrashPhysics(dt) {
  if (!player || !recovering) return false
  if (crashPromptOpen) {
    crashFx?.update(dt, player.root.position)
    return true
  }
  if (crashTimer <= 0) return false
  crashTimer -= dt

  // Continuous rolling tumble in world space
  player.root.rotateOnWorldAxis(crashRollAxis, crashSpin.length() * 0.55 * dt)
  player.root.rotateX(crashSpin.x * dt)
  player.root.rotateY(crashSpin.y * dt)
  player.root.rotateZ(crashSpin.z * dt)

  velocity.y -= (playerIsCar() ? 26 : 20) * dt
  // Skidding drag — still slides a long way
  velocity.x *= Math.max(0.15, 1 - 0.28 * dt)
  velocity.z *= Math.max(0.15, 1 - 0.28 * dt)
  player.root.position.addScaledVector(velocity, dt)

  const clearance = clearanceOf(player)
  if (player.root.position.y <= clearance) {
    player.root.position.y = clearance
    const impact = Math.abs(velocity.y)
    if (velocity.y < 0) {
      velocity.y *= -0.42
      // Convert slide speed into more roll on each bounce
      const slide = Math.hypot(velocity.x, velocity.z)
      crashSpin.x += (Math.random() - 0.5) * (2 + slide * 0.12)
      crashSpin.z += (Math.random() - 0.5) * (2 + slide * 0.12)
      crashSpin.y += (Math.random() - 0.5) * 1.5
      if (crashRollAxis.lengthSq() > 0.01) {
        crashSpin.addScaledVector(crashRollAxis, slide * 0.08)
      }
    }
    velocity.x *= 0.78
    velocity.z *= 0.78
    crashSpin.multiplyScalar(0.88)
    crashGroundHits += 1
    if (impact > 1.2) {
      beep(60 + Math.random() * 40, 0.07, "square")
      // Fresh scars + scrap on hard bounces (don't restart the whole wreck FX)
      if (crashGroundHits <= 6) {
        crashFx?.burstAt(
          player.root.position,
          velocity.clone().setY(Math.max(8, impact * 4)),
          Math.max(1.4, Math.min(3.5, (player.def?.length || 12) * 0.1))
        )
      }
    }
  }

  crashFx?.update(dt, player.root.position)

  if (crashTimer <= 0) {
    crashTimer = 0
    crashSpin.set(0, 0, 0)
    velocity.set(0, 0, 0)
    if (mode === "fly") showCrashScreen(lastCrashMessage)
  }
  return true
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
  if (!audioCtx || !engineGain) return
  const now = audioCtx.currentTime
  // Hangar / walk-around stay silent — no idle buzz behind the menu.
  if (muted || mode !== "fly" || outside || !craft) {
    engineGain.gain.setTargetAtTime(0, now, 0.04)
    return
  }
  const jet = craft.def.engines.some((engine) => engine.kind === "jet")
  const t = THREE.MathUtils.clamp(engineThrottle, 0, 1)
  // Soft triangle/square mix beats a raw sawtooth drone.
  engineOsc.type = jet ? "triangle" : "sine"
  engineOsc.frequency.setTargetAtTime(
    jet ? 55 + t * 95 + speed * 0.08 : 48 + t * 90 + speed * 0.2,
    now,
    0.1
  )
  engineFilter.frequency.setTargetAtTime(
    jet ? 220 + t * 1400 : 160 + t * 700,
    now,
    0.1
  )
  // Quiet at idle / shut down; swell with throttle only while flying.
  const volume = t < 0.04 ? 0 : 0.01 + t * 0.045
  engineGain.gain.setTargetAtTime(volume, now, 0.1)
}

function toggleMute() {
  muted = !muted
  const muteBtn = document.getElementById("mute-btn")
  if (muteBtn) muteBtn.textContent = muted ? "Sound off" : "Sound on"
  if (audioCtx && engineGain) {
    engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.02)
  }
}

function goCockpitView() {
  if (mode !== "fly" || !player || outside || playerIsCar()) return
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
  camera.fov = 60
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
  if (cockpit) cockpit.hidden = outside || playerIsCar()
  if (orbit) orbit.hidden = outside
  const muteBtn = document.getElementById("mute-btn")
  if (muteBtn) muteBtn.textContent = muted ? "Sound off" : "Sound on"
  const adi = document.getElementById("adi")
  if (adi) adi.hidden = playerIsCar() || outside
  const cautions = document.getElementById("cautions")
  if (cautions) cautions.hidden = playerIsCar()
  refreshSysDocks()
}

function refreshSysDocks() {
  const flying = mode === "fly"
  const showAp = flying && !!player && !playerIsCar() && !outside
  const apPanel = document.getElementById("ap-panel")
  const apToggle = document.getElementById("ap-toggle")
  const partsPanel = document.getElementById("parts-panel")
  const partsToggle = document.getElementById("parts-toggle")
  if (apToggle) {
    apToggle.hidden = !showAp
    apToggle.setAttribute("aria-expanded", showAp && apOpen ? "true" : "false")
    apToggle.classList.toggle("on", showAp && apOpen)
    apToggle.classList.toggle("live", !!ap.on)
    apToggle.textContent = ap.on ? "AP ON" : "AP"
  }
  if (apPanel) apPanel.hidden = !showAp || !apOpen
  if (partsToggle) {
    partsToggle.hidden = !flying
    partsToggle.setAttribute("aria-expanded", flying && partsOpen ? "true" : "false")
    partsToggle.classList.toggle("on", flying && partsOpen)
  }
  if (partsPanel) partsPanel.hidden = !flying || !partsOpen
}

function setApOpen(open) {
  apOpen = !!open
  refreshSysDocks()
}

function setPartsOpen(open) {
  partsOpen = !!open
  refreshSysDocks()
}

function setFlyMore(open) {
  flyMoreOpen = !!open
  const panel = document.getElementById("fly-actions")
  const button = document.getElementById("fly-more")
  panel?.classList.toggle("more-open", flyMoreOpen)
  if (button) button.setAttribute("aria-expanded", flyMoreOpen ? "true" : "false")
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
    else if (action === "chat") setChatOpen(!chatOpen())
    else if (action === "planes") setSwapPanelOpen(!swapPanelOpen())
    else if (action === "jump") onJumpKey()
    else if (action === "reset") resetToRunway("Back on the runway.")
    else if (action === "mute") toggleMute()
    setFlyMore(false)
    button.blur()
  })
  document.getElementById("fly-more")?.addEventListener("click", (event) => {
    event.preventDefault()
    setFlyMore(!flyMoreOpen)
  })
  window.addEventListener("pointerdown", (event) => {
    if (!flyMoreOpen) return
    const target = event.target
    if (target instanceof Element && target.closest("#fly-actions")) return
    setFlyMore(false)
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
  // Full throttle clears a stuck parking brake so air drag can't lock a stall.
  if (throttle > 0.35 && systems.parking) systems.parking = false
  braking = held.brake > 0 || keys.has("Space") || !!systems.parking
}

/** Point the nose along the flight path and bank into the turn. */
function tiltTowardTravel(dt) {
  // Pitch chase was driving the nose into a dive on climb-out. Bank only, and only once clear of the runway.
  const speed = velocity.length()
  const agl = Math.max(0, player.root.position.y - clearanceOf(player))
  // Autoland keeps the wings level and yaws onto the runway. Banking into that
  // yaw rolls the jet into a descending spiral around the lineup point.
  if (ap.land || grounded || speed < 14 || agl < 40 || takeoffBoost > 0) {
    lastTrackYaw = null
    return
  }
  const pathYaw = Math.atan2(velocity.x, velocity.z)
  let yawRate = 0
  if (lastTrackYaw != null) {
    let delta = pathYaw - lastTrackYaw
    if (delta > Math.PI) delta -= Math.PI * 2
    else if (delta < -Math.PI) delta += Math.PI * 2
    yawRate = delta / Math.max(dt, 1 / 120)
  }
  lastTrackYaw = pathYaw
  up.set(0, 1, 0).applyQuaternion(player.root.quaternion)
  right.set(1, 0, 0).applyQuaternion(player.root.quaternion)
  const bankRad = Math.atan2(right.y, up.y)
  const wantBank = THREE.MathUtils.clamp(yawRate * 0.9, -0.7, 0.7)
  // A latched bank is the turn. Don't pull the wings toward the path.
  if (!ap.on && Math.abs(holdBank) > 0.1) return
  if (Math.abs(stick.roll) < 0.4) {
    const bankErr = wantBank - bankRad
    player.root.rotateZ(bankErr * (1 - Math.exp(-dt * 2.2)))
  }
}

function stepFlight(dt) {
  const def = player.def
  const flight = def.flight
  readStick()
  const pilotPitch = stick.pitch
  const pilotRoll = stick.roll
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
  // Liftoff only once safely above stall — Vr used to sit below Vs and auto-rotate
  // threw every takeoff straight into a stall that couldn't be recovered.
  const rotateMin = Math.max(flight.rotate, flight.stall * 1.12)
  if (grounded && throttle > 0.55 && speed > rotateMin * 0.92 && !pushingDown) rotateWait += dt
  else if (!grounded || throttle < 0.4) rotateWait = 0
  const wantsUp = !pushingDown && (stick.pitch > 0.12 || rotateWait > 1.6)
  const rotating = grounded && throttle > 0.35 && speed > rotateMin * 0.92 && wantsUp && player.gearT > 0.55
  if (rotating && stick.pitch < 0.45) stick.pitch = 0.55

  const ctrl = controlFactor()
  const authority = grounded ? 0.35 : THREE.MathUtils.clamp(speed / Math.max(12, flight.stall), 0.35, 1)
  const pitchAuth = grounded ? (speed > rotateMin * 0.55 ? 1 : 0.55) : authority
  // In the air the pilot's pitch eases toward a held target below. Autopilot and the takeoff rotate still pitch directly.
  const pitchDrive = !grounded && !ap.on ? 0 : pitchAuth
  player.root.rotateX(-stick.pitch * flight.pitch * pitchDrive * ctrl * dt)
  // In the air the pilot's bank eases toward a held target below. Autopilot still rolls directly.
  const rollDrive = grounded ? 0.2 : ap.on ? authority : 0
  player.root.rotateZ(stick.roll * flight.roll * rollDrive * ctrl * dt)
  // Ground and autopilot keep their steer. The pilot's turn comes from the bank below.
  const rollForYaw = grounded || ap.on ? -stick.roll : 0
  const steer = stick.yaw + rollForYaw * (grounded ? 1 : 0.45)
  player.root.rotateY(-steer * flight.yaw * (grounded ? 1 : authority) * ctrl * dt * (grounded ? Math.min(1, 0.25 + speed / 30) : 1))
  // Asymmetric thrust yaw when one engine is out.
  if (!grounded && (failures.eng1 || failures.eng2) && !(failures.eng1 && failures.eng2)) {
    const side = failures.eng1 ? 1 : -1
    player.root.rotateY(side * 0.22 * throttle * dt)
  }

  forward.set(0, 0, 1).applyQuaternion(player.root.quaternion)
  if (grounded) {
    const pitchNow = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1))
    const maxPitch = speed > rotateMin * 0.8 ? 0.28 : 0.1
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

  // One press sets a bank or pitch and it stays. The next press is the correction.
  // Autopilot and the ground still fly the stick directly.
  const holdDead = 0.15
  if (ap.on || grounded) {
    holdBank = bankRad
    holdPitch = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1))
    rollLatch = 0
    pitchLatch = 0
    if (grounded) pitchTouched = false
  } else {
    const rolling = Math.abs(pilotRoll) >= holdDead
    if (rolling) {
      const sign = Math.sign(pilotRoll)
      // A tap sets a new bank. Holding the key deepens it. The wings roll there slowly.
      const step = rollLatch !== sign ? 0.3 : 0.18 * dt
      holdBank = THREE.MathUtils.clamp(holdBank + sign * step, -0.9, 0.9)
      rollLatch = sign
    } else rollLatch = 0
    const bankEase = 1 - Math.exp(-dt * 0.75)
    const bankStep = (holdBank - bankRad) * bankEase
    player.root.rotateZ(bankStep)
    const flownBank = bankRad + bankStep
    if (speed > 12 && Math.abs(flownBank) > 0.05) {
      // The bank was yawing the nose away from the low wing.
      const yawCmd = THREE.MathUtils.clamp(-flownBank / 0.8, -1, 1)
      player.root.rotateY(yawCmd * flight.yaw * authority * ctrl * dt)
    }

    forward.set(0, 0, 1).applyQuaternion(player.root.quaternion)
    let nosePitch = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1))
    const pitching = Math.abs(pilotPitch) >= holdDead
    if (pitching) {
      const sign = Math.sign(pilotPitch)
      if (pitchLatch !== sign && !pitchTouched && sign < 0) {
        // First down press leaves the automatic climb and aims at a descent.
        holdPitch = -0.12
      } else {
        const step = pitchLatch !== sign ? 0.12 : 0.07 * dt
        holdPitch = THREE.MathUtils.clamp(holdPitch + sign * step, -0.32, 0.34)
      }
      pitchLatch = sign
      pitchTouched = true
    } else {
      pitchLatch = 0
      if (!pitchTouched && speed > 8) {
        const agl = Math.max(0, player.root.position.y - clearanceOf(player))
        // Hands-off still climbs clear of the ridge, then levels. A pitch press replaces that.
        const speedTrim = THREE.MathUtils.clamp((flight.cruise * 0.88 - speed) / flight.cruise, -0.12, 0.14) * 0.18
        holdPitch = Math.max(0, speedTrim)
        if (agl < 800 && speed > flight.stall) holdPitch = 0.16
      }
    }
    const stalled = takeoffBoost <= 0 && (speed < stallSpeed * 0.92 || aoa > 0.34)
    if (speed > 8 && !stalled) {
      const pitchEase = 1 - Math.exp(-dt * 0.75)
      player.root.rotateX(-(holdPitch - nosePitch) * pitchEase)
    }
    forward.set(0, 0, 1).applyQuaternion(player.root.quaternion)
    up.set(0, 1, 0).applyQuaternion(player.root.quaternion)
    right.set(1, 0, 0).applyQuaternion(player.root.quaternion)
    flightInfo.bank = Math.atan2(right.y, up.y)
  }

  const aglNow = Math.max(0, player.root.position.y - clearanceOf(player))
  // Arcade-friendly stall: warn early, punish late, keep enough lift to recover.
  // Don't spear the runway — a stall on the climb-out used to drop the nose into the ground.
  const stalling = !grounded && takeoffBoost <= 0 && (speed < stallSpeed * 0.92 || aoa > 0.34)
  const stallDive = stalling && aglNow > 35
  if (stallDive) {
    player.root.rotateX(0.55 * dt * Math.max(0.15, 1 - speed / Math.max(1, stallSpeed)))
    player.root.rotateZ(Math.sin(performance.now() * 0.028) * 0.2 * dt)
    forward.set(0, 0, 1).applyQuaternion(player.root.quaternion)
    up.set(0, 1, 0).applyQuaternion(player.root.quaternion)
    right.set(1, 0, 0).applyQuaternion(player.root.quaternion)
  }

  const flying = THREE.MathUtils.clamp(speed / Math.max(8, stallSpeed * 0.85), 0, 1.05)
  const bankLift = THREE.MathUtils.clamp(up.y, 0, 1)
  const aoaLift = stallDive
    ? 0.45
    : THREE.MathUtils.clamp(1 - Math.abs(aoa) * 1.1, 0.45, 1.05)

  let dragK = flight.drag
  dragK *= 1 + player.flapT * 0.75
  if (player.doorT > 0.2) dragK += flight.drag * 0.45
  if (player.cargoT > 0.2) dragK += flight.drag * 0.35
  if (player.spoilerT > 0.2) dragK += flight.drag * 0.9
  if (player.noseT > 0.2) dragK += flight.drag * 0.12
  if (!grounded && def.gear.mode === "retract" && player.gearT > 0.25) dragK += flight.drag * 0.28
  // Parking / wheel brakes only bite on the ground — not in the air.
  if (braking && grounded) dragK += flight.drag * 1.2
  if (stalling) dragK *= 1.2
  if (speed > flight.cruise * 1.4) dragK *= 1.2

  const weather = sampleWind(player.root.position, wind)
  const shearHit = !grounded && weather.shear > 0.35

  velocity.addScaledVector(forward, ((throttle * flight.thrust * thrustFactor()) / flight.mass) * dt)
  if (failures.fire) {
    // Fire adds drag and a little buffet until extinguished from the Fail panel.
    velocity.addScaledVector(velocity, -0.08 * dt)
    player.root.rotateZ(Math.sin(performance.now() * 0.04) * 0.15 * dt)
  }
  tickFailures(dt)
  refreshFailCautions()
  velocity.y -= 9.81 * dt
  if (!grounded || rotating) velocity.y += 9.81 * flying * bankLift * aoaLift * dt
  if (rotating) velocity.y = Math.max(velocity.y, 5)
  if (takeoffBoost > 0 && !grounded) velocity.y += 3.2 * Math.min(1, takeoffBoost) * dt
  if (stallDive) velocity.y -= 1.6 * dt
  // Air mass moves the plane; shear layers shove harder when you cross them.
  if (!grounded) {
    const windBlend = 1 - Math.exp(-dt * (shearHit ? 1.6 : 0.35))
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
    // The nose leads the climb; the path catches up instead of dragging the nose down.
    const align = stalling ? 0.85 : shearHit ? 0.7 : 1.5
    trackDir.copy(forward).multiplyScalar(Math.max(8, velocity.length()))
    velocity.lerp(trackDir, 1 - Math.exp(-dt * align))
  }
  if (!grounded && Math.abs(bankRad) > 0.2) {
    // Slide toward the lowered wing so the path matches the bank.
    velocity.addScaledVector(right, -Math.sin(bankRad) * speed * 0.28 * dt)
  }
  const spd = velocity.length()
  if (spd > 0.01) {
    const dragAcc = (dragK * spd * spd) / flight.mass
    const dragScale = Math.min(0.85, (dragAcc * dt) / spd)
    velocity.addScaledVector(velocity, -dragScale)
  }
  if (!Number.isFinite(velocity.x) || !Number.isFinite(velocity.y) || !Number.isFinite(velocity.z)) velocity.set(0, 0, 0)

  const maxV = flight.cruise * 1.7 * (cheats.turbo ? 2 : 1)
  if (velocity.length() > maxV) velocity.multiplyScalar(maxV / velocity.length())

  tiltTowardTravel(dt)
  forward.set(0, 0, 1).applyQuaternion(player.root.quaternion)
  up.set(0, 1, 0).applyQuaternion(player.root.quaternion)
  right.set(1, 0, 0).applyQuaternion(player.root.quaternion)
  const flownBank = Math.atan2(right.y, up.y)
  flightInfo.bank = flownBank
  if (!grounded && velocity.length() > 1.5) {
    const pathPitchNow = Math.asin(THREE.MathUtils.clamp(velocity.y / velocity.length(), -1, 1))
    const nosePitchNow = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1))
    flightInfo.aoa = nosePitchNow - pathPitchNow
  }

  const previousY = player.root.position.y
  player.root.position.addScaledVector(velocity, dt)
  distance += velocity.length() * dt

  const clearance = clearanceOf(player)
  const sink = velocity.y
  const hitGround = player.root.position.y <= clearance

  if (hitGround && !rotating && sink <= 0.4) {
    const impact = sink
    const hardLimit = cheats.crashPhysics ? -8 : -12
    const bellyLimit = cheats.crashPhysics ? -4.5 : -7
    const hard = wasAirborne && impact < hardLimit
    const belly = player.gearT < 0.45 && wasAirborne && impact < bellyLimit
    if ((hard || belly) && speed > (cheats.crashPhysics ? 10 : 16)) {
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
      const rolloutFree = ap.land && ap.landPhase === "rollout" && performance.now() < ap.rolloutUntil
      if (!rolloutFree && throttle < 0.04) along *= Math.max(0, 1 - dt * 0.7)
      velocity.x = heading.x * along
      velocity.z = heading.z * along
    }
  } else {
    if (player.root.position.y < clearance) player.root.position.y = clearance
    grounded = false
    if (previousY <= clearance + 0.3) takeoffBoost = 3.5
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

  if (!toldRotate && grounded && throttle > 0.75 && speed > rotateMin) {
    toldRotate = true
    toast("Pull back to take off.")
  }
  updateWarnings(dt, velocity.length(), stallSpeed, flownBank, flightInfo.aoa, player.root.position.y - clearance, weather.shear)
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
  if (playerIsCar()) {
    if (coachOn && speed > 8) {
      coach.textContent = "Follow the service road out to the highway ring."
      coachOn = false
    }
  } else if (coachOn && grounded && velocity.length() > player.def.flight.rotate && throttle > 0.5) {
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
  const engineCount = craft.def?.engines?.length || craft.engineFires?.length || 0
  const engineFire = []
  for (let i = 0; i < engineCount; i += 1) {
    engineFire.push(
      craft === player && failures.fire && (failures.fireIndex < 0 || failures.fireIndex === i)
    )
  }
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
    engineFire,
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
  const stalling = !grounded && takeoffBoost <= 0 && (speed < stallSpeed * 1.05 || aoaDeg > 18)
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
  let dt = Math.min(0.033, Math.max(0.001, clock.getDelta()))
  if (cheats.slowmo) dt *= 0.5
  banUiAcc += dt
  if (banUiAcc > 0.25) {
    banUiAcc = 0
    refreshBanLock()
  }
  if (mode === "fly" && recovering && (crashTimer > 0 || crashPromptOpen)) {
    stepCrashPhysics(dt)
  } else if (mode === "fly" && !recovering) {
    if (outside) stepOutside(dt)
    else if (playerIsCar()) stepDrive(dt)
    else stepFlight(dt)
  } else if (player) {
    player.root.position.y = clearanceOf(player)
    readStick()
  }

  const showcaseThrottle = mode === "menu" ? 0.28 : (outside ? 0 : throttle)
  if (player) {
    updateVehicle(
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
    updateVehicle(craft, dt, craftInput(craft, 0, 0, true, { pitch: 0, roll: 0, yaw: 0 }))
  }
  for (const car of worldCars) {
    if (car === player) continue
    updateVehicle(car, dt, craftInput(car, 0, 0, true, { pitch: 0, roll: 0, yaw: 0 }))
  }
  for (const remote of remotes.values()) {
    if (!remote.craft?.root) continue
    if (remote.hasPose) {
      remote.craft.root.position.lerp(remote.targetPos, 1 - Math.exp(-12 * dt))
      remote.craft.root.quaternion.slerp(remote.targetQuat, 1 - Math.exp(-12 * dt))
    }
    remote.craft.root.visible = true
    const groundedRemote = remote.mode !== "fly" || remote.craft.root.position.y < clearanceOf(remote.craft) + 2
    updateVehicle(
      remote.craft,
      dt,
      craftInput(
        remote.craft,
        remote.throttle ?? 0.15,
        groundedRemote ? 0 : (isCar(remote.craft.def) ? 12 : 40),
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
    for (const child of remote.craft.root.children) {
      if (!child.userData?.chatBubble) continue
      child.lookAt(camera.position)
      const dist = camera.position.distanceTo(remote.craft.root.position)
      const scale = THREE.MathUtils.clamp(dist / 160, 1.1, 9)
      child.scale.setScalar(scale)
      child.position.y = 14 + scale * 2.4
    }
  }
  if (player?.root) {
    for (const child of player.root.children) {
      if (!child.userData?.chatBubble) continue
      child.lookAt(camera.position)
      const dist = camera.position.distanceTo(player.root.position)
      const scale = THREE.MathUtils.clamp(dist / 160, 1.1, 9)
      child.scale.setScalar(scale)
      child.position.y = 14 + scale * 2.4
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
    const span = Math.max(50, (player.def.wing?.span || player.def.width || 20) * 0.8)
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
  updateLandingLights(performance.now())
  renderer.render(scene, camera)
  } catch (error) {
    console.error(error)
  }
}

const clock = new THREE.Clock()

let hangarReady = false

async function bootMenu() {
  if (hangarReady) return
  if (PLANES.length < 1) throw new Error("Hangar fleet is empty")
  boot.hidden = false
  boot.textContent = "Opening hangar…"
  await ensureSimCore()
  // Tiny starter set only — rest loads when you pick a plane.
  const bootIds = ["a320", "b737"].filter(Boolean)
  await preloadAircraftModels((done, total) => {
    boot.textContent = `Loading aircraft… ${done}/${total}`
  }, bootIds)
  list.innerHTML = ""
  buttons.length = 0
  let lastGroup = ""
  FLEET.forEach((def, index) => {
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
    const topSpeed = Math.round(
      (isCar(def) ? (def.drive?.maxSpeed || 35) : (def.flight?.cruise || 55)) * 3.6
    )
    button.innerHTML = `<span class="swatch"></span><span><strong>${def.name}</strong><small>${def.role}</small></span><span class="speed">${topSpeed} km/h</span>`
    button.querySelector(".swatch").style.background = hangarSwatch(def)
    button.addEventListener("click", () => { void selectVehicle(index) })
    button.addEventListener("dblclick", async () => {
      await selectVehicle(index)
      startFlight()
    })
    list.appendChild(button)
    buttons.push(button)
  })
  applyPlaneFilter()

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
  const redeemFromUi = () => {
    ensureAudio()
    const input = document.getElementById("promo-input")
    const ok = redeemPromo(input?.value)
    if (ok && input) input.value = ""
  }
  document.getElementById("promo-btn")?.addEventListener("click", redeemFromUi)
  document.getElementById("promo-input")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault()
      redeemFromUi()
    }
  })
  document.getElementById("promo-toggle")?.addEventListener("click", () => {
    setPromoSectionCollapsed(!promoSectionCollapsed())
  })
  syncPromoSectionUi()
  refreshPromoStatus()
  refreshBanLock()
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
      else clearHomeLand()
      refreshApPanel()
    }
  })
  document.getElementById("ap-alt").addEventListener("click", () => {
    ensureAudio()
    if (!ap.on) toggleAutopilot()
    else {
      ap.alt = !ap.alt
      if (ap.alt) ap.targetAlt = Math.max(30, Math.round(currentAltM()))
      else clearHomeLand()
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
  document.getElementById("ap-land")?.addEventListener("click", () => {
    ensureAudio()
    toggleHomeLand()
  })
  for (const button of document.querySelectorAll("[data-ap-adj]")) {
    button.addEventListener("click", () => {
      ensureAudio()
      adjustAp(button.dataset.apAdj, Number(button.dataset.dir))
    })
  }
  refreshApPanel()
  renderWxPanel()
  void restoreWeather()
  for (const id of ["airline-primary", "airline-secondary", "airline-fuselage"]) {
    document.getElementById(id).addEventListener("input", () => {
      repaintAirlineFleet(airlineColorsFromInputs())
    })
  }
  bindHoldButtons()
  bindJoystick()
  bindThrottle()
  bindCrashScreen()

  selectPlane(0)
  setFailMode(failMode)
  document.getElementById("fail-modes")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-fail]")
    if (!btn) return
    ensureAudio()
    setFailMode(btn.dataset.fail)
    toast(failMode === "off" ? "Failures off" : failMode === "hard" ? "Hard failures on" : "Failures on")
  })
  document.getElementById("fail-trigger")?.addEventListener("click", () => {
    ensureAudio()
    practiceFailure()
  })
  document.getElementById("fail-clear")?.addEventListener("click", () => {
    ensureAudio()
    clearFailures()
    refreshFailPanel()
  })
  document.getElementById("fail-toggle")?.addEventListener("click", () => {
    ensureAudio()
    setFailOpen(!failOpen)
  })
  document.getElementById("ap-toggle")?.addEventListener("click", () => {
    ensureAudio()
    setApOpen(!apOpen)
  })
  document.getElementById("parts-toggle")?.addEventListener("click", () => {
    ensureAudio()
    setPartsOpen(!partsOpen)
  })
  document.getElementById("fail-extinguish")?.addEventListener("click", () => {
    ensureAudio()
    extinguishFire()
  })
  boot.hidden = true
  hangarReady = true
  bindChatUi()
  document.getElementById("swap-close")?.addEventListener("click", () => setSwapPanelOpen(false))
  document.getElementById("swap-panel")?.addEventListener("click", (event) => {
    if (event.target?.id === "swap-panel") setSwapPanelOpen(false)
  })
  refreshAirportUi()
  refreshFailPanel()
  animate()
  // Heavy world detail + remaining GLBs after the hangar is already usable.
  setTimeout(() => {
    try { world?.enrich?.() } catch (error) { console.warn(error) }
  }, 250)
  setTimeout(() => {
    warmAircraftModels(bootIds).catch(() => {})
  }, 2500)
}

function beginWithName(name, { multiplayer = false } = {}) {
  playerName = sanitizeName(name)
  try { localStorage.setItem("tfs-player-name", playerName) } catch { /* ignore */ }
  document.getElementById("name-gate").hidden = true
  menu.hidden = false
  world.setLocalAirport(0, playerName, startAt)
  localOrigin = { ...world.localOrigin }
  if (player) place(player, PAD.x, PAD.z, 0.4)
  place(parked[0], PAD.x - 80, PAD.z + 250, 0.8)
  place(parked[1], PAD.x - 80, PAD.z + 340, -0.4)
  refreshAirportUi()
  const hint = document.getElementById("join-hint")
  showChatUi()
  if (multiplayer) {
    net.connect(playerName, startAt)
    if (hint) {
      const host = location.host || `127.0.0.1:8765`
      hint.textContent = location.hostname === "127.0.0.1" || location.hostname === "localhost"
        ? "Hosting locally — share your Wi‑Fi LAN address with friends (see Terminal)."
        : `Joined via ${host}`
    }
    toast(`Multiplayer on — starting at ${world.placeName}.`)
    if (CHAT_ENABLED) appendChatLine({ text: "Chat is live — press T to talk.", system: true })
  } else {
    net.disconnect?.()
    if (hint) hint.textContent = "Singleplayer — you are flying alone."
    toast(`Singleplayer — starting at ${world.placeName}.`)
    if (CHAT_ENABLED) appendChatLine({ text: "Singleplayer — choose Multiplayer next time to chat on Wi‑Fi.", system: true })
  }
}

function randomUserId() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  let tail = ""
  for (const b of bytes) tail += alphabet[b % alphabet.length]
  return tail
}

async function startApp() {
  menu.hidden = true
  boot.hidden = true
  const gate = document.getElementById("name-gate")
  const nameStep = document.getElementById("name-step")
  const placeStep = document.getElementById("place-step")
  const modeStep = document.getElementById("mode-step")
  const nameCard = document.querySelector(".name-card")
  gate.hidden = false
  nameStep.hidden = false
  placeStep.hidden = true
  modeStep.hidden = true
  try {
    const raw = JSON.parse(localStorage.getItem("tfs-start-place") || "")
    if (raw && Number.isFinite(Number(raw.x)) && Number.isFinite(Number(raw.z))) {
      startAt = spawnBeside(Number(raw.x), Number(raw.z))
    }
  } catch { /* ignore */ }
  const input = document.getElementById("player-name")
  input.value = randomUserId()
  input.focus()
  input.select()
  let submitting = false
  let pendingName = ""

  async function enterHangar(multiplayer) {
    if (submitting || hangarReady) return
    const name = sanitizeName(pendingName || input.value)
    if (name.length < 2) {
      toast("Pick a name with at least 2 letters.")
      nameStep.hidden = false
      placeStep.hidden = true
      modeStep.hidden = true
      nameCard?.classList.remove("picking")
      input.focus()
      return
    }
    submitting = true
    gate.hidden = true
    boot.hidden = false
    try {
      await bootMenu()
      beginWithName(name, { multiplayer })
    } catch (error) {
      submitting = false
      gate.hidden = false
      nameStep.hidden = true
      placeStep.hidden = true
      modeStep.hidden = false
      nameCard?.classList.remove("picking")
      boot.hidden = true
      boot.textContent = error && error.message ? error.message : "The hangar could not open."
      console.error(error)
    }
  }

  function paintStartPin() {
    const pin = document.getElementById("start-pin")
    const label = document.getElementById("place-label")
    const spanX = START_BOUNDS.maxX - START_BOUNDS.minX
    const spanZ = START_BOUNDS.maxZ - START_BOUNDS.minZ
    if (pin) {
      pin.style.left = `${((startAt.x - START_BOUNDS.minX) / spanX) * 100}%`
      pin.style.top = `${((startAt.z - START_BOUNDS.minZ) / spanZ) * 100}%`
    }
    if (label) label.textContent = `Starting at ${describePlace(startAt.x, startAt.z)}`
    for (const btn of document.querySelectorAll(".start-place")) {
      const dx = Number(btn.dataset.x) - startAt.x
      const dz = Number(btn.dataset.z) - startAt.z
      btn.classList.toggle("on", Math.hypot(dx, dz) < 400)
    }
  }

  function chooseStart(x, z) {
    startAt = spawnBeside(x, z)
    try { localStorage.setItem("tfs-start-place", JSON.stringify(startAt)) } catch { /* ignore */ }
    paintStartPin()
  }

  function buildStartMap() {
    const map = document.getElementById("start-map")
    const list = document.getElementById("start-places")
    if (!map || map.dataset.ready === "1") return
    map.dataset.ready = "1"
    const spanX = START_BOUNDS.maxX - START_BOUNDS.minX
    const spanZ = START_BOUNDS.maxZ - START_BOUNDS.minZ
    for (const [x, z, r, color, label] of CONTINENTS) {
      const land = document.createElement("div")
      land.className = "start-land"
      land.title = label
      const w = (r * 2) / spanX
      const h = (r * 2) / spanZ
      const left = (x - START_BOUNDS.minX) / spanX
      const top = (z - START_BOUNDS.minZ) / spanZ
      land.style.left = `${(left - w / 2) * 100}%`
      land.style.top = `${(top - h / 2) * 100}%`
      land.style.width = `${w * 100}%`
      land.style.height = `${h * 100}%`
      land.style.background = `#${color.toString(16).padStart(6, "0")}`
      map.appendChild(land)
    }
    const pin = document.createElement("div")
    pin.id = "start-pin"
    pin.className = "start-pin"
    map.appendChild(pin)
    map.addEventListener("pointerdown", (event) => {
      const rect = map.getBoundingClientRect()
      const u = (event.clientX - rect.left) / rect.width
      const v = (event.clientY - rect.top) / rect.height
      chooseStart(START_BOUNDS.minX + u * spanX, START_BOUNDS.minZ + v * spanZ)
    })
    const places = [
      { name: "Home field", x: 0, z: 0 },
      ...WORLD_AIRPORTS.map(([x, z, name]) => {
        const spot = spawnBeside(x, z)
        return { name: prettyPlace(name), x: spot.x, z: spot.z }
      }),
    ]
    for (const place of places) {
      const btn = document.createElement("button")
      btn.type = "button"
      btn.className = "start-place"
      btn.textContent = place.name
      btn.dataset.x = String(place.x)
      btn.dataset.z = String(place.z)
      btn.addEventListener("click", () => chooseStart(place.x, place.z))
      list?.appendChild(btn)
    }
  }

  function showPlaceStep() {
    const name = sanitizeName(input.value)
    if (name.length < 2) {
      toast("Pick a name with at least 2 letters.")
      return
    }
    pendingName = name
    buildStartMap()
    paintStartPin()
    nameStep.hidden = true
    placeStep.hidden = false
    modeStep.hidden = true
    nameCard?.classList.add("picking")
  }

  function showModeStep() {
    const name = sanitizeName(pendingName || input.value)
    if (name.length < 2) {
      toast("Pick a name with at least 2 letters.")
      return
    }
    pendingName = name
    nameStep.hidden = true
    placeStep.hidden = true
    modeStep.hidden = false
    nameCard?.classList.remove("picking")
    const hint = document.getElementById("join-hint")
    if (hint && (location.hostname === "127.0.0.1" || location.hostname === "localhost")) {
      hint.textContent = "Finding this computer’s Wi‑Fi address for the iPad…"
      fetch("/lan.json").then((res) => res.json()).then((data) => {
        const url = data.urls?.[0]
        hint.textContent = url
          ? `On the iPad, open ${url} — same Wi‑Fi. If that page says offline, allow this computer through the firewall.`
          : "Connect this computer to Wi‑Fi, then the iPad can open the LAN address."
      }).catch(() => {
        hint.textContent = "Singleplayer works on this device even when multiplayer is offline."
      })
    }
    document.getElementById("mode-single")?.focus()
  }

  document.getElementById("name-form").addEventListener("submit", (event) => {
    event.preventDefault()
    if (submitting || hangarReady) return
    if (!nameStep.hidden) showPlaceStep()
    else if (!placeStep.hidden) showModeStep()
  })
  document.getElementById("place-go")?.addEventListener("click", () => {
    if (submitting || hangarReady) return
    showModeStep()
  })
  document.getElementById("mode-single")?.addEventListener("click", () => enterHangar(false))
  document.getElementById("mode-multi")?.addEventListener("click", () => enterHangar(true))

  window.addEventListener("keydown", (event) => {
    if (gate.hidden || submitting || hangarReady) return
    if (modeStep.hidden) return
    if (event.repeat) return
    if (event.code === "KeyS") {
      event.preventDefault()
      enterHangar(false)
    } else if (event.code === "KeyM") {
      event.preventDefault()
      enterHangar(true)
    }
  })
}

document.getElementById("plane-search")?.addEventListener("input", (event) => {
  planeQuery = event.target.value || ""
  applyPlaneFilter()
})
document.getElementById("swap-search")?.addEventListener("input", (event) => {
  swapQuery = event.target.value || ""
  refreshSwapList()
})
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
  // Don't steal keys while typing in chat / promo / rename fields.
  if (typingInField()) {
    if (event.code === "Escape" && chatOpen()) {
      event.preventDefault()
      setChatOpen(false)
    }
    return
  }
  if (CHAT_ENABLED && event.code === "KeyT" && hangarReady && chatRoot && !chatRoot.hidden) {
    event.preventDefault()
    setChatOpen(true)
    return
  }
  if (event.code === "Escape" && chatOpen()) {
    event.preventDefault()
    setChatOpen(false)
    return
  }
  if (event.code === "Escape" && swapPanelOpen()) {
    event.preventDefault()
    setSwapPanelOpen(false)
    return
  }
  if (event.code === "Escape" && (flyMoreOpen || failOpen || apOpen || partsOpen)) {
    event.preventDefault()
    setFlyMore(false)
    failOpen = false
    apOpen = false
    partsOpen = false
    refreshFailPanel()
    refreshSysDocks()
    return
  }
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault()
  const once = ["KeyG", "KeyF", "KeyO", "KeyP", "KeyU", "KeyN", "KeyL", "KeyC", "KeyR", "KeyM", "KeyB", "KeyH", "KeyJ", "KeyK", "KeyT", "KeyV", "BracketLeft", "BracketRight", "Enter", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]
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
  if (event.code === "Escape") {
    setSwapPanelOpen(false)
    showMenu()
  }
  else if (event.code === "KeyR") resetToRunway("Back on the runway.")
  else if (event.code === "KeyC") cycleCamera()
  else if (event.code === "KeyM") toggleMute()
  else if (event.code === "KeyB") toggleAutopilot()
  else if (event.code === "KeyH") toggleHomeLand()
  else if (event.code === "KeyJ") onJumpKey()
  else if (event.code === "KeyK") practiceFailure()
  else if (event.code === "KeyV") setSwapPanelOpen(!swapPanelOpen())
  else if (event.code === "BracketLeft") void changePlaneInFlight((selected - 1 + FLEET.length) % FLEET.length)
  else if (event.code === "BracketRight") void changePlaneInFlight((selected + 1) % FLEET.length)
  else if (player && !outside) tapPart(player, event.code)
})

window.addEventListener("keyup", (event) => {
  if (typingInField()) return
  keys.delete(event.code)
})
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
  throttlePointer = null
  holdPointers.clear()
  document.getElementById("joy")?.classList.remove("dragging")
  document.getElementById("throttle-slider")?.classList.remove("dragging")
  const knob = document.getElementById("joy-knob")
  if (knob) knob.style.transform = "translate(0px, 0px)"
  for (const button of document.querySelectorAll("#aux-pad button.held, #fly-actions button.held")) {
    button.classList.remove("held")
  }
}

const holdPointers = new Map()

function applyHold(button, value) {
  const key = button.dataset.hold
  if (!key) return
  if (key === "brake") held.brake = value
  else held[key] = Number(button.dataset.value) * value
  button.classList.toggle("held", value > 0)
}

function releaseHoldPointer(pointerId) {
  const button = holdPointers.get(pointerId)
  if (!button) return
  holdPointers.delete(pointerId)
  const stillHeld = [...holdPointers.values()].includes(button)
  if (!stillHeld) applyHold(button, 0)
}

function bindHoldButtons() {
  for (const button of document.querySelectorAll("[data-hold]")) {
    button.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return
      applyHold(button, 1)
      holdPointers.set(event.pointerId, button)
      try { button.setPointerCapture(event.pointerId) } catch (error) { /* already released */ }
      event.preventDefault()
    })
    button.addEventListener("contextmenu", (event) => event.preventDefault())
  }
  window.addEventListener("pointerup", (event) => releaseHoldPointer(event.pointerId))
  window.addEventListener("pointercancel", (event) => releaseHoldPointer(event.pointerId))
}

let joyPointer = null
let throttlePointer = null

function stickAxis(value) {
  const dead = window.matchMedia("(pointer: coarse)").matches ? 0.08 : 0.12
  const amount = Math.abs(value)
  if (amount < dead) return 0
  return Math.sign(value) * THREE.MathUtils.clamp((amount - dead) / (1 - dead), 0, 1)
}

function bindJoystick() {
  const joy = document.getElementById("joy")
  const knob = document.getElementById("joy-knob")
  const place = (event) => {
    const rect = joy.getBoundingClientRect()
    const limit = Math.max(24, rect.width / 2 - knob.offsetWidth / 2)
    let dx = event.clientX - (rect.left + rect.width / 2)
    let dy = event.clientY - (rect.top + rect.height / 2)
    const len = Math.hypot(dx, dy)
    if (len > limit && len > 0) {
      dx = (dx / len) * limit
      dy = (dy / len) * limit
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`
    const nx = limit > 0 ? dx / limit : 0
    const ny = limit > 0 ? -dy / limit : 0
    held.roll = stickAxis(nx)
    held.pitch = stickAxis(ny)
  }
  const end = (event) => {
    if (event && event.pointerId !== joyPointer) return
    joyPointer = null
    held.pitch = 0
    held.roll = 0
    joy.classList.remove("dragging")
    knob.style.transform = "translate(0px, 0px)"
  }
  joy.addEventListener("pointerdown", (event) => {
    if (joyPointer !== null && event.pointerId !== joyPointer) return
    if (event.pointerType === "mouse" && event.button !== 0) return
    joyPointer = event.pointerId
    joy.classList.add("dragging")
    place(event)
    try { joy.setPointerCapture(event.pointerId) } catch (error) { /* already released */ }
    event.preventDefault()
  })
  joy.addEventListener("pointermove", (event) => {
    if (event.pointerId !== joyPointer) return
    place(event)
    event.preventDefault()
  })
  joy.addEventListener("pointerup", end)
  joy.addEventListener("pointercancel", end)
  joy.addEventListener("contextmenu", (event) => event.preventDefault())
  window.addEventListener("pointermove", (event) => {
    if (event.pointerId !== joyPointer) return
    place(event)
  })
  window.addEventListener("pointerup", end)
  window.addEventListener("pointercancel", end)
}

function bindThrottle() {
  const panel = document.getElementById("throttle-panel")
  const slider = document.getElementById("throttle-slider")
  const knob = document.getElementById("throttle-knob")
  const move = (event) => {
    const rect = slider.getBoundingClientRect()
    const knobH = knob.offsetHeight || 44
    const travel = Math.max(1, rect.height - knobH)
    const y = event.clientY - rect.top - knobH / 2
    throttle = THREE.MathUtils.clamp(1 - y / travel, 0, 1)
  }
  const end = (event) => {
    if (event.pointerId !== throttlePointer) return
    throttlePointer = null
    slider.classList.remove("dragging")
  }
  panel.addEventListener("pointerdown", (event) => {
    if (throttlePointer !== null && event.pointerId !== throttlePointer) return
    if (event.pointerType === "mouse" && event.button !== 0) return
    throttlePointer = event.pointerId
    slider.classList.add("dragging")
    move(event)
    try { panel.setPointerCapture(event.pointerId) } catch (error) { /* already released */ }
    event.preventDefault()
  })
  panel.addEventListener("pointermove", (event) => {
    if (event.pointerId !== throttlePointer) return
    move(event)
    event.preventDefault()
  })
  panel.addEventListener("pointerup", end)
  panel.addEventListener("pointercancel", end)
  panel.addEventListener("contextmenu", (event) => event.preventDefault())
  window.addEventListener("pointermove", (event) => {
    if (event.pointerId !== throttlePointer) return
    move(event)
  })
  window.addEventListener("pointerup", end)
  window.addEventListener("pointercancel", end)
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
  if (el === canvas || el.closest("#controls, #throttle-panel, #fail-dock, #fly-actions")) event.preventDefault()
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

