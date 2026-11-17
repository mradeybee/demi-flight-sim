import * as THREE from "three"
import { WORLD_RADIUS } from "./world.js"

/** Kid-friendly weather picks — visuals + wind + precip. */
export const WEATHER_PRESETS = [
  {
    id: "clear",
    label: "Clear",
    sky: [[0, "#0a1a38"], [0.28, "#1a4a7a"], [0.52, "#4a86b0"], [0.78, "#a8c8dc"], [1, "#d8c8a8"]],
    fog: 0xb7c9d6,
    fogNear: 2200,
    fogFar: 0.62,
    bg: 0x6fa8c8,
    hemiSky: 0xc8dceb,
    hemiGround: 0x4a5e3a,
    hemi: 0.72,
    sun: 2.05,
    fill: 0.22,
    cloudOpacity: 0.45,
    cloudColor: 0xe8eef4,
    wind: 0.7,
    precip: 0,
    sunY: 260,
    moonVisible: true,
  },
  {
    id: "dawn",
    label: "Dawn",
    sky: [[0, "#151e36"], [0.28, "#c45a3a"], [0.5, "#e09868"], [0.72, "#e8c8a0"], [1, "#b0c8d8"]],
    fog: 0xd4b090,
    fogNear: 1800,
    fogFar: 0.7,
    bg: 0xc88860,
    hemiSky: 0xe8c8a8,
    hemiGround: 0x4a3c30,
    hemi: 0.7,
    sun: 1.35,
    fill: 0.22,
    cloudOpacity: 0.5,
    cloudColor: 0xe8c0a0,
    wind: 0.75,
    precip: 0,
    sunY: 70,
    sunX: -280,
    moonVisible: true,
  },
  {
    id: "windy",
    label: "Windy",
    sky: [[0, "#1e3a58"], [0.4, "#4a78a0"], [0.75, "#90b4cc"], [1, "#c8d8e4"]],
    fog: 0xa0b8c8,
    fogNear: 1600,
    fogFar: 0.58,
    bg: 0x789eb8,
    hemiSky: 0xb8d0e0,
    hemiGround: 0x4a5a40,
    hemi: 0.68,
    sun: 1.7,
    fill: 0.2,
    cloudOpacity: 0.7,
    cloudColor: 0xdce6ee,
    wind: 2.8,
    precip: 0,
    sunY: 240,
    moonVisible: true,
  },
  {
    id: "cloudy",
    label: "Cloudy",
    sky: [[0, "#3a5060"], [0.4, "#6a8498"], [0.7, "#9eb0be"], [1, "#c8d2d8"]],
    fog: 0xa8b8c4,
    fogNear: 1400,
    fogFar: 0.55,
    bg: 0x8aa0b0,
    hemiSky: 0xb4c4d0,
    hemiGround: 0x44543c,
    hemi: 0.62,
    sun: 1.15,
    fill: 0.18,
    cloudOpacity: 0.82,
    cloudColor: 0xd4dde4,
    wind: 1.1,
    precip: 0,
    sunY: 220,
    moonVisible: true,
  },
  {
    id: "overcast",
    label: "Overcast",
    sky: [[0, "#323840"], [0.45, "#5a646e"], [0.8, "#868e96"], [1, "#aeb4ba"]],
    fog: 0x8a949c,
    fogNear: 1000,
    fogFar: 0.48,
    bg: 0x788088,
    hemiSky: 0x9aa4ac,
    hemiGround: 0x3a4434,
    hemi: 0.52,
    sun: 0.55,
    fill: 0.14,
    cloudOpacity: 0.92,
    cloudColor: 0x8e969e,
    wind: 1.3,
    precip: 0,
    sunY: 180,
    moonVisible: false,
  },
  {
    id: "rain",
    label: "Rain",
    sky: [[0, "#222c36"], [0.4, "#3e4e5a"], [0.75, "#5c6e7a"], [1, "#7a8c96"]],
    fog: 0x5c6e7a,
    fogNear: 550,
    fogFar: 0.38,
    bg: 0x4a5e6c,
    hemiSky: 0x7a8c96,
    hemiGround: 0x303c30,
    hemi: 0.42,
    sun: 0.35,
    fill: 0.1,
    cloudOpacity: 0.95,
    cloudColor: 0x5e6870,
    wind: 1.6,
    precip: 1,
    sunY: 160,
    moonVisible: false,
  },
  {
    id: "storm",
    label: "Storm",
    sky: [[0, "#0e1218"], [0.35, "#1c2832"], [0.7, "#2e3e4a"], [1, "#3e5060"]],
    fog: 0x2e3e4a,
    fogNear: 320,
    fogFar: 0.3,
    bg: 0x222e38,
    hemiSky: 0x4a5e6c,
    hemiGround: 0x222a22,
    hemi: 0.28,
    sun: 0.15,
    fill: 0.06,
    cloudOpacity: 0.98,
    cloudColor: 0x323c46,
    wind: 2.4,
    precip: 1.6,
    sunY: 140,
    moonVisible: false,
    lightning: true,
  },
  {
    id: "fog",
    label: "Fog",
    sky: [[0, "#6e787e"], [0.5, "#9aa2a8"], [1, "#c0c6ca"]],
    fog: 0xb8c0c6,
    fogNear: 60,
    fogFar: 0.15,
    bg: 0xa8b0b6,
    hemiSky: 0xc4cad0,
    hemiGround: 0x5a6458,
    hemi: 0.5,
    sun: 0.4,
    fill: 0.12,
    cloudOpacity: 0.35,
    cloudColor: 0xc8ced4,
    wind: 0.5,
    precip: 0,
    sunY: 200,
    moonVisible: false,
  },
  {
    id: "sunset",
    label: "Sunset",
    sky: [[0, "#14182e"], [0.3, "#a84a28"], [0.55, "#d88848"], [0.8, "#e8c090"], [1, "#e0d0b8"]],
    fog: 0xd0a078,
    fogNear: 1600,
    fogFar: 0.65,
    bg: 0xc08050,
    hemiSky: 0xe8c0a0,
    hemiGround: 0x584438,
    hemi: 0.65,
    sun: 1.45,
    fill: 0.28,
    cloudOpacity: 0.6,
    cloudColor: 0xe0b090,
    wind: 0.8,
    precip: 0,
    sunY: 90,
    sunX: 320,
    moonVisible: true,
  },
  {
    id: "night",
    label: "Night",
    sky: [[0, "#010208"], [0.35, "#060e22"], [0.7, "#101828"], [1, "#182038"]],
    fog: 0x0a101c,
    fogNear: 700,
    fogFar: 0.45,
    bg: 0x080e1c,
    hemiSky: 0x182438,
    hemiGround: 0x0c140c,
    hemi: 0.18,
    sun: 0.04,
    fill: 0.04,
    cloudOpacity: 0.28,
    cloudColor: 0x222a38,
    wind: 0.9,
    precip: 0,
    sunY: -40,
    moonVisible: true,
  },
  {
    id: "snow",
    label: "Snow",
    sky: [[0, "#546068"], [0.45, "#8e9aa4"], [0.8, "#c0c8d0"], [1, "#e4e8ec"]],
    fog: 0xc8d0d8,
    fogNear: 700,
    fogFar: 0.42,
    bg: 0xb0bcc8,
    hemiSky: 0xdce2e8,
    hemiGround: 0xa8b4b8,
    hemi: 0.65,
    sun: 0.85,
    fill: 0.16,
    cloudOpacity: 0.78,
    cloudColor: 0xe4e8ec,
    wind: 1.2,
    precip: 0.9,
    snow: true,
    sunY: 200,
    moonVisible: true,
  },
]

const LIVE_FALLBACK = { lat: 25.76, lon: -80.19 } // near Miami landmark

function wmoToPreset(code, isDay) {
  if (code === 0) return isDay ? "clear" : "night"
  if (code === 1 || code === 2) return isDay ? "cloudy" : "night"
  if (code === 3) return "overcast"
  if (code === 45 || code === 48) return "fog"
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain"
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow"
  if ([95, 96, 99].includes(code)) return "storm"
  return isDay ? "cloudy" : "night"
}

function makePrecip(scene, count, snow) {
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 90
    positions[i * 3 + 1] = Math.random() * 60
    positions[i * 3 + 2] = (Math.random() - 0.5) * 90
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({
    color: snow ? 0xffffff : 0xa8c4d8,
    size: snow ? 0.55 : 0.28,
    transparent: true,
    opacity: snow ? 0.9 : 0.55,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  points.visible = false
  scene.add(points)
  return { points, positions, snow: !!snow, speed: snow ? 12 : 38 }
}

export function createWeatherController({ scene, hemi, sun, fill, world }) {
  const rainFx = makePrecip(scene, 1400, false)
  const snowFx = makePrecip(scene, 900, true)
  let id = "clear"
  let label = "Clear"
  let windMul = 1
  let precipRate = 0
  let lightning = false
  let flash = 0
  let liveTimer = 0
  let liveMode = false
  let sunLift = 260
  let sunSide = 170

  function paint(preset) {
    if (world.paintSky) world.paintSky(preset.sky)
    if (scene.fog) {
      scene.fog.color.setHex(preset.fog)
      scene.fog.near = preset.fogNear
      scene.fog.far = WORLD_RADIUS * preset.fogFar
    }
    scene.background.setHex(preset.bg)
    hemi.color.setHex(preset.hemiSky)
    hemi.groundColor.setHex(preset.hemiGround)
    hemi.intensity = preset.hemi
    sun.intensity = preset.sun
    fill.intensity = preset.fill
    sunLift = preset.sunY ?? 240
    sunSide = preset.sunX ?? 170
    if (world.cloudMat) {
      world.cloudMat.opacity = preset.cloudOpacity
      world.cloudMat.color.setHex(preset.cloudColor)
      world.cloudMat.transparent = true
      world.cloudMat.needsUpdate = true
    }
    if (world.sunBall) {
      world.sunBall.visible = preset.sun > 0.15
      world.sunBall.material.color.setHex(preset.id === "sunset" ? 0xff8a3c : 0xfff1c2)
    }
    if (world.moon) world.moon.visible = !!preset.moonVisible
    windMul = preset.wind
    precipRate = preset.precip || 0
    lightning = !!preset.lightning
    rainFx.points.visible = precipRate > 0 && !preset.snow
    snowFx.points.visible = precipRate > 0 && !!preset.snow
    rainFx.points.material.opacity = Math.min(0.75, 0.35 + precipRate * 0.25)
  }

  function apply(presetId, meta = {}) {
    const preset = WEATHER_PRESETS.find((w) => w.id === presetId) || WEATHER_PRESETS[0]
    id = preset.id
    label = meta.label || preset.label
    liveMode = !!meta.live
    paint(preset)
    return { id, label }
  }

  async function locate() {
    try {
      const pos = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) reject(new Error("no geo"))
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 600000 })
      })
      return { lat: pos.coords.latitude, lon: pos.coords.longitude }
    } catch {
      return LIVE_FALLBACK
    }
  }

  async function applyLive() {
    liveMode = true
    label = "Live…"
    const { lat, lon } = await locate()
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&current=weather_code,wind_speed_10m,is_day,visibility&timezone=auto`
    const res = await fetch(url)
    if (!res.ok) throw new Error("weather fetch failed")
    const data = await res.json()
    const cur = data.current || {}
    const code = Number(cur.weather_code ?? 0)
    const isDay = Number(cur.is_day ?? 1) === 1
    const mapped = wmoToPreset(code, isDay)
    const windKmh = Number(cur.wind_speed_10m ?? 10)
    const result = apply(mapped, {
      live: true,
      label: `Live · ${WEATHER_PRESETS.find((w) => w.id === mapped)?.label || mapped}`,
    })
    // Scale wind from live report (km/h → multiplier).
    windMul = THREE.MathUtils.clamp(windKmh / 18, 0.5, 3.2)
    if (typeof cur.visibility === "number" && scene.fog) {
      const vis = Math.max(200, cur.visibility)
      scene.fog.near = Math.min(scene.fog.near, vis * 0.35)
      scene.fog.far = Math.min(scene.fog.far, vis * 1.4)
    }
    return { ...result, windKmh, code }
  }

  function update(dt, camera) {
    if (flash > 0) {
      flash -= dt
      sun.intensity = flash > 0 ? 4.5 : (WEATHER_PRESETS.find((w) => w.id === id)?.sun ?? 1)
      if (flash <= 0 && lightning && Math.random() < 0.008) flash = 0.12 + Math.random() * 0.1
    } else if (lightning && Math.random() < 0.004) {
      flash = 0.08 + Math.random() * 0.12
    }

    if (liveMode) {
      liveTimer -= dt
      if (liveTimer <= 0) {
        liveTimer = 600
        applyLive().catch(() => {})
      }
    }

    const cam = camera.position
    for (const fx of [rainFx, snowFx]) {
      if (!fx.points.visible) continue
      fx.points.position.set(cam.x, cam.y - 8, cam.z)
      const arr = fx.positions
      const fall = fx.speed * (0.6 + precipRate) * dt
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= fall * (0.6 + (i % 7) * 0.08)
        arr[i] += windMul * 2.5 * dt
        if (arr[i + 1] < -5) {
          arr[i + 1] = 55 + Math.random() * 20
          arr[i] = (Math.random() - 0.5) * 90
          arr[i + 2] = (Math.random() - 0.5) * 90
        }
      }
      fx.points.geometry.attributes.position.needsUpdate = true
    }
  }

  function sunFollow(focus) {
    sun.position.set(focus.x + sunSide, Math.max(20, focus.y + sunLift), focus.z + 80)
    if (world.sunBall) {
      world.sunBall.position.set(focus.x + sunSide * 40, Math.max(400, sunLift * 35), focus.z - 4000)
    }
    if (world.moon) {
      world.moon.position.set(focus.x - sunSide * 50, 7000, focus.z + 6000)
    }
  }

  apply("clear")
  return {
    presets: WEATHER_PRESETS,
    apply,
    applyLive,
    update,
    sunFollow,
    get id() { return id },
    get label() { return label },
    get windMul() { return windMul },
    get live() { return liveMode },
  }
}
