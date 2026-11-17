import * as THREE from "three"

function car(spec) {
  spec.kind = "car"
  spec.group = spec.group || "Ground"
  spec.radius = spec.radius ?? Math.max(spec.width * 0.35, spec.height * 0.45)
  spec.wing = spec.wing || { span: spec.width }
  spec.gear = spec.gear || { mode: "fixed", height: spec.clearance }
  spec.seat = spec.seat || { y: spec.height * 0.55, z: 0.15 }
  spec.drive = {
    accel: spec.accel ?? 14,
    brake: spec.brake ?? 22,
    maxSpeed: spec.maxSpeed ?? 38,
    steer: spec.steer ?? 1.55,
    friction: spec.friction ?? 2.8,
    offRoadFriction: spec.offRoadFriction ?? 7.5,
    offRoadMax: spec.offRoadMax ?? 0.55,
  }
  return spec
}

/** Hangar ground fleet — distinct shapes and handling. */
export const CARS = [
  car({
    id: "sedan",
    name: "City Sedan",
    role: "Car",
    number: "TF-CAR",
    blurb: "A sleek airport runabout — quick on the service road and the highway ring.",
    body: "#c62828",
    accent: "#1a1a1a",
    glass: "#9ec9e8",
    trim: "#c5ccd4",
    length: 4.7,
    width: 1.9,
    height: 1.42,
    clearance: 0.92,
    wheelR: 0.34,
    style: "sedan",
    accel: 18,
    brake: 26,
    maxSpeed: 48,
    steer: 1.85,
  }),
  car({
    id: "sports",
    name: "Turbo Coupe",
    role: "Sports",
    number: "TF-GT",
    blurb: "Low, loud, and fast — best on the highway ring.",
    body: "#f4d35e",
    accent: "#1a1a1a",
    glass: "#6ec6ff",
    trim: "#22262c",
    length: 4.4,
    width: 1.95,
    height: 1.22,
    clearance: 0.82,
    wheelR: 0.33,
    style: "sports",
    accel: 24,
    brake: 28,
    maxSpeed: 58,
    steer: 2.05,
    offRoadMax: 0.4,
  }),
  car({
    id: "taxi",
    name: "City Taxi",
    role: "Taxi",
    number: "TF-TXI",
    blurb: "Classic checker-cab yellow. Perfect for apron shuttle runs.",
    body: "#f9c74f",
    accent: "#1d3557",
    glass: "#a8d5e5",
    trim: "#22262c",
    length: 4.85,
    width: 1.95,
    height: 1.55,
    clearance: 0.98,
    wheelR: 0.35,
    style: "taxi",
    accel: 16,
    brake: 24,
    maxSpeed: 42,
    steer: 1.7,
  }),
  car({
    id: "police",
    name: "Patrol Car",
    role: "Police",
    number: "TF-PD",
    blurb: "Airport security cruiser with a light bar. Snappy steering.",
    body: "#1d3557",
    accent: "#e63946",
    glass: "#8ecae6",
    trim: "#c5ccd4",
    length: 4.9,
    width: 1.98,
    height: 1.5,
    clearance: 0.96,
    wheelR: 0.35,
    style: "police",
    accel: 20,
    brake: 27,
    maxSpeed: 52,
    steer: 1.95,
  }),
  car({
    id: "suv",
    name: "Trail SUV",
    role: "SUV",
    number: "TF-SUV",
    blurb: "Tall cabin and big wheels — happier on grass than the sedan.",
    body: "#1b4f72",
    accent: "#c9a227",
    glass: "#a8d5e5",
    trim: "#d7dde4",
    length: 5.15,
    width: 2.08,
    height: 1.88,
    clearance: 1.18,
    wheelR: 0.42,
    style: "suv",
    accel: 15,
    brake: 22,
    maxSpeed: 40,
    steer: 1.5,
    offRoadMax: 0.78,
    offRoadFriction: 5,
  }),
  car({
    id: "jeep",
    name: "Field Jeep",
    role: "Off-road",
    number: "TF-JP",
    blurb: "Open-top trail buggy for bouncing across the plateau.",
    body: "#6a994e",
    accent: "#386641",
    glass: "#cce3de",
    trim: "#bc6c25",
    length: 4.2,
    width: 1.85,
    height: 1.7,
    clearance: 1.25,
    wheelR: 0.46,
    style: "jeep",
    accel: 14,
    brake: 20,
    maxSpeed: 34,
    steer: 1.8,
    offRoadMax: 0.92,
    offRoadFriction: 3.8,
  }),
  car({
    id: "pickup",
    name: "Airport Pickup",
    role: "Truck",
    number: "TF-PU",
    blurb: "Service truck with a cargo bed for field runs around the apron.",
    body: "#2e7d32",
    accent: "#f4f4f4",
    glass: "#9ec9d8",
    trim: "#8a929c",
    length: 5.7,
    width: 2.12,
    height: 1.78,
    clearance: 1.12,
    wheelR: 0.44,
    style: "pickup",
    accel: 14,
    brake: 20,
    maxSpeed: 38,
    steer: 1.45,
    offRoadMax: 0.72,
    offRoadFriction: 5.5,
  }),
  car({
    id: "van",
    name: "Cargo Van",
    role: "Van",
    number: "TF-VAN",
    blurb: "Boxy hangar van — roomy cabin, steady on the service road.",
    body: "#6c757d",
    accent: "#adb5bd",
    glass: "#9ec9d8",
    trim: "#343a40",
    length: 5.4,
    width: 2.15,
    height: 2.15,
    clearance: 1.05,
    wheelR: 0.38,
    style: "van",
    accel: 12,
    brake: 20,
    maxSpeed: 36,
    steer: 1.35,
  }),
  car({
    id: "bus",
    name: "Apron Bus",
    role: "Bus",
    number: "TF-BUS",
    blurb: "Crew shuttle for hauling friends from hangar to runway.",
    body: "#457b9d",
    accent: "#e63946",
    glass: "#a8dadc",
    trim: "#1d3557",
    length: 8.2,
    width: 2.45,
    height: 2.6,
    clearance: 1.15,
    wheelR: 0.48,
    style: "bus",
    accel: 10,
    brake: 18,
    maxSpeed: 28,
    steer: 1.15,
    offRoadMax: 0.45,
  }),
]

function hex(color) {
  if (typeof color === "number") return color
  return new THREE.Color(color).getHex()
}

function makeWheel(r, width) {
  const group = new THREE.Group()
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, width, 18),
    new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.92 })
  )
  tire.rotation.z = Math.PI / 2
  tire.castShadow = true
  const wall = new THREE.Mesh(
    new THREE.TorusGeometry(r * 0.72, r * 0.14, 8, 18),
    new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.9 })
  )
  wall.rotation.y = Math.PI / 2
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.42, r * 0.42, width * 1.08, 12),
    new THREE.MeshStandardMaterial({ color: 0xb8c0bc, metalness: 0.65, roughness: 0.3 })
  )
  hub.rotation.z = Math.PI / 2
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(r * 0.38, 12),
    new THREE.MeshStandardMaterial({ color: 0xd0d5da, metalness: 0.7, roughness: 0.25 })
  )
  disc.position.x = width * 0.52
  disc.rotation.y = Math.PI / 2
  group.add(tire, wall, hub, disc)
  return group
}

/**
 * Procedural car with cab, glass, lights, and spinning / steering wheels.
 */
export function createCar(rawDef) {
  const def = { ...rawDef, drive: { ...rawDef.drive }, wing: { ...(rawDef.wing || {}) } }
  const root = new THREE.Group()
  root.name = def.id

  const L = def.length
  const W = def.width
  const H = def.height
  const clearance = def.clearance
  const wheelR = def.wheelR
  const style = def.style || "sedan"
  const bodyY = clearance

  const paint = new THREE.MeshStandardMaterial({
    color: hex(def.body),
    metalness: 0.42,
    roughness: 0.32,
    envMapIntensity: 1.1,
  })
  const accent = new THREE.MeshStandardMaterial({
    color: hex(def.accent),
    metalness: 0.55,
    roughness: 0.35,
  })
  const trim = new THREE.MeshStandardMaterial({
    color: hex(def.trim || "#c5ccd4"),
    metalness: 0.7,
    roughness: 0.28,
  })
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: hex(def.glass || "#9ec9e8"),
    metalness: 0.05,
    roughness: 0.05,
    transparent: true,
    opacity: 0.55,
    transmission: 0.55,
    thickness: 0.2,
    depthWrite: false,
  })
  const blackout = new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.85 })
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 })

  // Lower body / rocker
  const rocker = new THREE.Mesh(new THREE.BoxGeometry(W * 0.96, H * 0.22, L * 0.9), blackout)
  rocker.position.y = bodyY - H * 0.12
  rocker.castShadow = true
  root.add(rocker)

  // Main body
  const tallCabin = style === "suv" || style === "van" || style === "bus" || style === "jeep"
  const bodyH = tallCabin ? H * 0.36 : style === "sports" ? H * 0.28 : H * 0.34
  const body = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, bodyH, L * 0.9), paint)
  body.position.y = bodyY
  body.castShadow = true
  body.receiveShadow = true
  root.add(body)

  // Slightly tapered nose hood
  const hoodLen = style === "pickup" || style === "bus" ? L * 0.22 : style === "sports" ? L * 0.36 : L * 0.32
  const hood = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, H * (style === "sports" ? 0.08 : 0.1), hoodLen), paint)
  hood.position.set(0, bodyY + bodyH * 0.35, L * (style === "pickup" || style === "bus" ? 0.32 : 0.26))
  hood.rotation.x = style === "sports" ? -0.1 : -0.06
  hood.castShadow = true
  root.add(hood)

  // Cabin greenhouse
  const cabinLen = style === "pickup" ? L * 0.34
    : style === "bus" || style === "van" ? L * 0.62
    : style === "suv" || style === "jeep" ? L * 0.48
    : style === "sports" ? L * 0.38
    : L * 0.44
  const cabinH = style === "bus" || style === "van" ? H * 0.52
    : style === "suv" || style === "jeep" ? H * 0.42
    : style === "sports" ? H * 0.3
    : H * 0.36
  const cabinZ = style === "pickup" ? L * 0.08
    : style === "bus" || style === "van" ? -L * 0.02
    : style === "sports" ? L * 0.02
    : L * 0.04
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, cabinH, cabinLen), paint)
  cabin.position.set(0, bodyY + bodyH * 0.55 + cabinH * 0.2, cabinZ)
  cabin.castShadow = true
  root.add(cabin)

  // Windows
  const winY = cabin.position.y + cabinH * 0.05
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(W * 0.76, cabinH * 0.72, 0.06), glassMat)
  windshield.position.set(0, winY, cabinZ + cabinLen * 0.42)
  windshield.rotation.x = -0.42
  root.add(windshield)
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(W * 0.76, cabinH * 0.65, 0.05), glassMat)
  rearGlass.position.set(0, winY, cabinZ - cabinLen * 0.42)
  rearGlass.rotation.x = 0.35
  root.add(rearGlass)
  for (const side of [-1, 1]) {
    const sideWin = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, cabinH * 0.55, cabinLen * 0.7),
      glassMat
    )
    sideWin.position.set(side * W * 0.41, winY, cabinZ)
    root.add(sideWin)
  }

  // Roof rails for SUV / jeep
  if (style === "suv" || style === "jeep") {
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, cabinLen * 0.85), trim)
      rail.position.set(side * W * 0.28, cabin.position.y + cabinH * 0.55, cabinZ)
      root.add(rail)
    }
  }

  // Police light bar
  if (style === "police") {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.55, 0.08, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.4 })
    )
    bar.position.set(0, cabin.position.y + cabinH * 0.58, cabinZ + cabinLen * 0.05)
    root.add(bar)
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.22, 0.06, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x3a86ff, emissive: 0x3a86ff, emissiveIntensity: 1.2 })
    )
    blue.position.set(-W * 0.14, bar.position.y + 0.05, bar.position.z)
    const red = blue.clone()
    red.material = new THREE.MeshStandardMaterial({ color: 0xff006e, emissive: 0xff006e, emissiveIntensity: 1.2 })
    red.position.x = W * 0.14
    root.add(blue, red)
  }

  // Taxi roof sign
  if (style === "taxi") {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.14, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xffb703, emissive: 0xffb703, emissiveIntensity: 0.55 })
    )
    sign.position.set(0, cabin.position.y + cabinH * 0.62, cabinZ)
    root.add(sign)
  }

  // Sports spoiler
  if (style === "sports") {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 0.04, 0.18), accent)
    spoiler.position.set(0, cabin.position.y + cabinH * 0.35, cabinZ - cabinLen * 0.55)
    root.add(spoiler)
  }

  // Bus stripe
  if (style === "bus") {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(W * 0.96, H * 0.08, L * 0.88), accent)
    stripe.position.set(0, bodyY + H * 0.15, 0)
    root.add(stripe)
  }

  // Pickup bed
  if (style === "pickup") {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(W * 0.88, H * 0.2, L * 0.38), accent)
    bed.position.set(0, bodyY + H * 0.02, -L * 0.24)
    bed.castShadow = true
    root.add(bed)
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, H * 0.28, L * 0.36), trim)
      rail.position.set(side * W * 0.42, bodyY + H * 0.18, -L * 0.24)
      root.add(rail)
    }
    const tailgate = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, H * 0.26, 0.06), paint)
    tailgate.position.set(0, bodyY + H * 0.12, -L * 0.44)
    root.add(tailgate)
  }

  // Bumpers
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, H * 0.14, 0.2), trim)
  bumperF.position.set(0, bodyY - H * 0.1, L * 0.46)
  root.add(bumperF)
  const bumperR = bumperF.clone()
  bumperR.position.z = -L * 0.46
  root.add(bumperR)

  // Grille
  const grille = new THREE.Mesh(new THREE.BoxGeometry(W * 0.55, H * 0.16, 0.06), blackout)
  grille.position.set(0, bodyY + H * 0.02, L * 0.455)
  root.add(grille)

  // Lights
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xfff2d0,
    emissive: 0xfff2d0,
    emissiveIntensity: 0,
  })
  const lightGeo = new THREE.BoxGeometry(0.28, 0.12, 0.08)
  const hl = new THREE.Mesh(lightGeo, lightMat)
  hl.position.set(-W * 0.32, bodyY + H * 0.02, L * 0.47)
  const hr = hl.clone()
  hr.position.x = W * 0.32
  root.add(hl, hr)
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff3030,
    emissive: 0xff2020,
    emissiveIntensity: 0.35,
  })
  const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.06), tailMat)
  tl.position.set(-W * 0.3, bodyY + H * 0.06, -L * 0.47)
  const tr = tl.clone()
  tr.position.x = W * 0.3
  root.add(tl, tr)

  // Side mirrors
  for (const side of [-1, 1]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.14), trim)
    mirror.position.set(side * W * 0.48, winY - cabinH * 0.05, cabinZ + cabinLen * 0.28)
    root.add(mirror)
  }

  // Exhaust tip
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.18, 8), trim)
  exhaust.rotation.x = Math.PI / 2
  exhaust.position.set(W * 0.28, wheelR * 0.45, -L * 0.48)
  root.add(exhaust)

  // Wheels
  const track = W * 0.42
  const axleF = L * 0.3
  const axleR = -L * 0.3
  const wheelW = style === "suv" || style === "pickup" || style === "jeep" || style === "bus" ? 0.32 : 0.26
  const wheels = []
  for (const [x, z, steer] of [
    [-track, axleF, true],
    [track, axleF, true],
    [-track, axleR, false],
    [track, axleR, false],
  ]) {
    const w = makeWheel(wheelR, wheelW)
    // Fix hub material typo from makeWheel
    w.position.set(x, wheelR, z)
    w.userData.steer = steer
    w.userData.spin = 0
    root.add(w)
    wheels.push(w)
  }

  // Wheel-arch lips
  for (const [x, z] of [
    [-track, axleF],
    [track, axleF],
    [-track, axleR],
    [track, axleR],
  ]) {
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(wheelR * 1.15, 0.04, 6, 12, Math.PI),
      rubber
    )
    arch.rotation.z = x < 0 ? Math.PI / 2 : -Math.PI / 2
    arch.rotation.y = Math.PI / 2
    arch.position.set(x * 1.05, wheelR * 0.85, z)
    root.add(arch)
  }

  const lights = { on: false, meshes: [hl, hr], mat: lightMat }

  return {
    def,
    root,
    parts: [],
    controls: { lights: 0 },
    wheels,
    lights,
    gearT: 1,
    flapT: 0,
    doorT: 0,
    spoilerT: 0,
    cargoT: 0,
    noseT: 0,
    modelClearance: clearance,
    modelBellyClearance: clearance * 0.55,
    seat: { ...def.seat },
    cockpit: null,
    setCockpit() {},
    setLights(on) {
      lights.on = !!on
      const intensity = on ? 1.6 : 0
      for (const mesh of lights.meshes) mesh.material.emissiveIntensity = intensity
    },
  }
}

export function updateCar(car, dt, input = {}) {
  const speed = input.speed || 0
  const throttle = input.throttle || 0
  const steer = THREE.MathUtils.clamp(input.steer ?? input.roll ?? 0, -1, 1)
  const wheelR = car.def.wheelR || 0.36
  const spinRate = (speed / Math.max(0.05, wheelR)) * dt
  const steerAngle = -steer * 0.48
  for (const w of car.wheels) {
    w.userData.spin += spinRate * (throttle >= 0 ? 1 : -1)
    const tire = w.children[0]
    if (tire) tire.rotation.x = w.userData.spin
    if (w.userData.steer) w.rotation.y = steerAngle
  }
  if (typeof input.lights === "number") car.setLights(input.lights > 0.5)
}

export function disposeCar(car) {
  if (!car?.root) return
  car.root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose()
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
      else obj.material.dispose()
    }
  })
}

export function isCar(def) {
  return def?.kind === "car"
}
