import * as THREE from "three"
import { WORLD_RADIUS } from "./world.js"

/** Kid-friendly weather picks — visuals + wind + precip. */
export const WEATHER_PRESETS = [
  {
    id: "clear",
    label: "Clear",
    sky: [[0, "#0b3d91"], [0.35, "#1f6fd0"], [0.55, "#79c6ff"], [0.78, "#d7f1ff"], [1, "#f3e2c2"]],
    fog: 0xc5e4f8,
    fogNear: 2800,
    fogFar: 0.9,
    bg: 0x8ecfff,
    hemiSky: 0xd7ecff,
    hemiGround: 0x5d8f45,
    hemi: 1.1,
    sun: 2.4,
    fill: 0.3,
    cloudOpacity: 0.55,
    cloudColor: 0xffffff,
    wind: 0.7,
    precip: 0,
    sunY: 260,
    moonVisible: true,
  },
  {
    id: "dawn",
    label: "Dawn",
    sky: [[0, "#1a2848"], [0.28, "#ff6b4a"], [0.5, "#ffb070"], [0.72, "#ffe0a8"], [1, "#c8e4ff"]],
    fog: 0xffc8a0,
    fogNear: 2200,
    fogFar: 0.82,
    bg: 0xffb888,
    hemiSky: 0xffd8b8,
    hemiGround: 0x5a4838,
    hemi: 0.9,
    sun: 1.6,
    fill: 0.28,
    cloudOpacity: 0.65,
    cloudColor: 0xffd0b0,
    wind: 0.75,
    precip: 0,
    sunY: 70,
    sunX: -280,
    moonVisible: true,
  },
  {
    id: "windy",
    label: "Windy",
    sky: [[0, "#2a5078"], [0.4, "#5a90c0"], [0.75, "#a8d0f0"], [1, "#e0f0ff"]],
    fog: 0xb0d0e8,
    fogNear: 2000,
    fogFar: 0.78,
    bg: 0x90c0e0,
    hemiSky: 0xc8e0f4,
    hemiGround: 0x5a7048,
    hemi: 1.0,
    sun: 2.0,
    fill: 0.28,
    cloudOpacity: 0.85,
    cloudColor: 0xf0f6fa,
    wind: 2.8,
    precip: 0,
    sunY: 240,
    moonVisible: true,
  },
  {
    id: "cloudy",
    label: "Cloudy",
    sky: [[0, "#4a6478"], [0.4, "#7a97ad"], [0.7, "#b7c9d6"], [1, "#dfe7ec"]],
    fog: 0xb8c9d6,
    fogNear: 1800,
    fogFar: 0.75,
    bg: 0xa8bdd0,
    hemiSky: 0xc5d5e2,
    hemiGround: 0x4f6a45,
    hemi: 0.9,
    sun: 1.4,
    fill: 0.22,
    cloudOpacity: 0.95,
    cloudColor: 0xe8eef2,
    wind: 1.1,
    precip: 0,
    sunY: 220,
    moonVisible: true,
  },
  {
    id: "overcast",
    label: "Overcast",
    sky: [[0, "#3a4450"], [0.45, "#6a7684"], [0.8, "#9aa6b2"], [1, "#c2cad2"]],
    fog: 0x9aa6b2,
    fogNear: 1200,
    fogFar: 0.6,
    bg: 0x8a96a4,
    hemiSky: 0xaab4be,
    hemiGround: 0x44503c,
    hemi: 0.7,
    sun: 0.7,
    fill: 0.18,
    cloudOpacity: 1,
    cloudColor: 0x9aa4ae,
    wind: 1.3,
    precip: 0,
    sunY: 180,
    moonVisible: false,
  },
  {
    id: "rain",
    label: "Rain",
    sky: [[0, "#2c3a48"], [0.4, "#4d6070"], [0.75, "#6f8494"], [1, "#8fa3b0"]],
    fog: 0x6f8494,
    fogNear: 700,
    fogFar: 0.45,
    bg: 0x5d7384,
    hemiSky: 0x8fa3b0,
    hemiGround: 0x3a4a38,
    hemi: 0.55,
    sun: 0.45,
    fill: 0.12,
    cloudOpacity: 1,
    cloudColor: 0x6a7682,
    wind: 1.6,
    precip: 1,
    sunY: 160,
    moonVisible: false,
  },
  {
    id: "storm",
    label: "Storm",
    sky: [[0, "#121820"], [0.35, "#243040"], [0.7, "#3a4c5c"], [1, "#4e6270"]],
    fog: 0x3a4c5c,
    fogNear: 400,
    fogFar: 0.35,
    bg: 0x2a3846,
    hemiSky: 0x5a6e7e,
    hemiGround: 0x2a3428,
    hemi: 0.35,
    sun: 0.2,
    fill: 0.08,
    cloudOpacity: 1,
    cloudColor: 0x3a4650,
    wind: 2.4,
    precip: 1.6,
    sunY: 140,
    moonVisible: false,
    lightning: true,
  },
  {
    id: "fog",
    label: "Fog",
    sky: [[0, "#8a949c"], [0.5, "#b0b8be"], [1, "#d4dae0"]],
    fog: 0xc8d0d6,
    fogNear: 80,
    fogFar: 0.18,
    bg: 0xb8c0c6,
    hemiSky: 0xd0d6dc,
    hemiGround: 0x6a7468,
    hemi: 0.65,
    sun: 0.5,
    fill: 0.15,
    cloudOpacity: 0.4,
    cloudColor: 0xd8dee4,
    wind: 0.5,
    precip: 0,
    sunY: 200,
    moonVisible: false,
  },
  {
    id: "sunset",
    label: "Sunset",
    sky: [[0, "#1a2040"], [0.3, "#c45c28"], [0.55, "#f0a050"], [0.8, "#ffd4a0"], [1, "#ffe8d0"]],
    fog: 0xe8b888,
    fogNear: 2000,
    fogFar: 0.8,
    bg: 0xe09860,
    hemiSky: 0xffd4b0,
    hemiGround: 0x6a5040,
    hemi: 0.85,
    sun: 1.8,
    fill: 0.35,
    cloudOpacity: 0.75,
    cloudColor: 0xffc8a0,
    wind: 0.8,
    precip: 0,
    sunY: 90,
    sunX: 320,
    moonVisible: true,
  },
  {
    id: "night",
    label: "Night",
    sky: [[0, "#02040c"], [0.35, "#0a1430"], [0.7, "#152048"], [1, "#1e2a50"]],
    fog: 0x0c1428,
    fogNear: 900,
    fogFar: 0.55,
    bg: 0x0a1228,
    hemiSky: 0x203050,
    hemiGround: 0x101810,
    hemi: 0.22,
    sun: 0.05,
    fill: 0.05,
    cloudOpacity: 0.35,
    cloudColor: 0x2a3448,
    wind: 0.9,
    precip: 0,
    sunY: -40,
    moonVisible: true,
  },
  {
    id: "snow",
    label: "Snow",
    sky: [[0, "#6a7888"], [0.45, "#a8b4c0"], [0.8, "#d0d8e0"], [1, "#eef2f6"]],
    fog: 0xd8e0e8,
    fogNear: 900,
    fogFar: 0.5,
    bg: 0xc8d4e0,
    hemiSky: 0xe8eef4,
    hemiGround: 0xb8c4c8,
    hemi: 0.85,
    sun: 1.0,
    fill: 0.2,
    cloudOpacity: 0.9,
    cloudColor: 0xf0f4f8,
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
