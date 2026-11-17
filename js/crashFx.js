import * as THREE from "three"

const _worldPos = new THREE.Vector3()
const _worldQuat = new THREE.Quaternion()
const _worldScale = new THREE.Vector3()
const _tmp = new THREE.Vector3()

function rand(a, b) {
  return a + Math.random() * (b - a)
}

function makeFireball(scale = 1) {
  const group = new THREE.Group()
  const layers = [
    { color: 0xff1a00, op: 0.55, r: 1.1, y: 0.2 },
    { color: 0xff6a00, op: 0.75, r: 0.75, y: 0.45 },
    { color: 0xffc233, op: 0.9, r: 0.42, y: 0.7 },
    { color: 0xfff6c8, op: 0.95, r: 0.2, y: 0.9 },
  ]
  for (const spec of layers) {
    const mat = new THREE.MeshBasicMaterial({
      color: spec.color,
      transparent: true,
      opacity: spec.op,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(spec.r * scale, 10, 8), mat)
    mesh.position.y = spec.y * scale
    mesh.userData.baseOp = spec.op
    mesh.userData.baseY = mesh.position.y
    mesh.userData.baseScale = 1
    group.add(mesh)
  }
  for (let i = 0; i < 5; i += 1) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x1a1612,
      transparent: true,
      opacity: 0.4 - i * 0.05,
      depthWrite: false,
    })
    const puff = new THREE.Mesh(new THREE.SphereGeometry(scale * (0.55 + i * 0.28), 8, 6), mat)
    puff.position.set(rand(-0.4, 0.4) * scale, scale * (1.1 + i * 0.55), rand(-0.4, 0.4) * scale)
    puff.userData.baseOp = mat.opacity
    puff.userData.smoke = true
    group.add(puff)
  }
  return group
}

function makeScrap(size) {
  const geo =
    Math.random() > 0.45
      ? new THREE.BoxGeometry(size * rand(0.4, 1.4), size * rand(0.08, 0.35), size * rand(0.3, 1.1))
      : new THREE.TetrahedronGeometry(size * rand(0.35, 0.9), 0)
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHSL(0.05 + Math.random() * 0.08, 0.15, 0.25 + Math.random() * 0.25),
    metalness: 0.55 + Math.random() * 0.35,
    roughness: 0.35 + Math.random() * 0.4,
    flatShading: true,
  })
  return new THREE.Mesh(geo, mat)
}

function stampScar(scene, scars, x, z, radius, burn = true) {
  const dirt = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 28),
    new THREE.MeshStandardMaterial({
      color: burn ? 0x1a1410 : 0x3a342c,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: burn ? 0.92 : 0.75,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    })
  )
  dirt.rotation.x = -Math.PI / 2
  dirt.position.set(x, 0.04, z)
  dirt.scale.set(1, 1, rand(0.55, 1.15))
  dirt.rotation.z = rand(0, Math.PI)
  scene.add(dirt)
  scars.push(dirt)

  if (burn) {
    const char = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.45, 20),
      new THREE.MeshBasicMaterial({
        color: 0x060504,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    )
    char.rotation.x = -Math.PI / 2
    char.position.set(x + rand(-radius * 0.15, radius * 0.15), 0.05, z + rand(-radius * 0.15, radius * 0.15))
    scene.add(char)
    scars.push(char)
  }

  // Gouged dirt chunks around the impact
  for (let i = 0; i < 6; i += 1) {
    const chunk = new THREE.Mesh(
      new THREE.BoxGeometry(rand(0.4, 1.6), rand(0.12, 0.4), rand(0.4, 1.4)),
      new THREE.MeshStandardMaterial({ color: 0x4a4034, roughness: 1 })
    )
    const ang = rand(0, Math.PI * 2)
    const dist = radius * rand(0.35, 1.05)
    chunk.position.set(x + Math.cos(ang) * dist, rand(0.05, 0.22), z + Math.sin(ang) * dist)
    chunk.rotation.set(rand(0, 0.6), ang, rand(0, 0.6))
    scene.add(chunk)
    scars.push(chunk)
  }
}

function collectBreakMeshes(craft) {
  const hits = []
  const roots = [craft.skin, craft.root].filter(Boolean)
  for (const root of roots) {
    root.traverse((node) => {
      if (!node.isMesh) return
      if (node.userData?.engineFire) return
      if (node.parent?.userData?.engineFire) return
      if (!node.geometry) return
      // Skip tiny rivets / lights
      node.geometry.computeBoundingSphere?.()
      const r = node.geometry.boundingSphere?.radius || 0
      if (r < 0.12) return
      hits.push(node)
    })
  }
  // Prefer larger / named pieces
  hits.sort((a, b) => (b.geometry.boundingSphere?.radius || 0) - (a.geometry.boundingSphere?.radius || 0))
  return hits
}

export function createCrashFx(scene) {
  const debris = []
  const fires = []
  const scars = []
  const hidden = []
  let sparks = null
  let active = false
  let age = 0

  function disposeOwnedMesh(mesh) {
    mesh.geometry?.dispose?.()
    if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose?.())
    else mesh.material?.dispose?.()
  }

  function clear() {
    for (const d of debris) {
      scene.remove(d.mesh)
      // Breakaway clones share geometry/materials with the live aircraft — never dispose those.
      if (d.owned) disposeOwnedMesh(d.mesh)
    }
    debris.length = 0
    for (const f of fires) {
      scene.remove(f.group)
      f.group.traverse((n) => {
        n.geometry?.dispose?.()
        n.material?.dispose?.()
      })
    }
    fires.length = 0
    for (const s of scars) {
      scene.remove(s)
      s.geometry?.dispose?.()
      s.material?.dispose?.()
    }
    scars.length = 0
    for (const h of hidden) {
      if (h && h.parent) h.visible = true
    }
    hidden.length = 0
    if (sparks) {
      scene.remove(sparks.points)
      sparks.geo.dispose()
      sparks.mat.dispose()
      sparks = null
    }
    active = false
    age = 0
  }

  function spawnSparks(origin, count = 90) {
    const positions = new Float32Array(count * 3)
    const velocities = []
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = origin.x
      positions[i * 3 + 1] = origin.y + 0.5
      positions[i * 3 + 2] = origin.z
      velocities.push(
        new THREE.Vector3(rand(-28, 28), rand(6, 34), rand(-28, 28))
      )
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: 0xffb347,
      size: 0.55,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    const points = new THREE.Points(geo, mat)
    points.frustumCulled = false
    scene.add(points)
    sparks = { points, geo, mat, velocities, life: 1.6 }
  }

  function flingPiece(mesh, impactVel, boost = 1) {
    mesh.updateWorldMatrix(true, false)
    mesh.matrixWorld.decompose(_worldPos, _worldQuat, _worldScale)
    const clone = mesh.clone(true)
    clone.position.copy(_worldPos)
    clone.quaternion.copy(_worldQuat)
    clone.scale.copy(_worldScale)
    clone.visible = true
    clone.castShadow = true
    scene.add(clone)
    mesh.visible = false
    hidden.push(mesh)

    const kick = _tmp.copy(impactVel).multiplyScalar(0.55)
    kick.x += rand(-18, 18) * boost
    kick.y += rand(8, 28) * boost
    kick.z += rand(-18, 18) * boost
    debris.push({
      mesh: clone,
      vel: kick.clone(),
      spin: new THREE.Vector3(rand(-10, 10), rand(-8, 8), rand(-12, 12)),
      life: rand(3.5, 6.5),
      bounce: 0.35 + Math.random() * 0.25,
      onFire: Math.random() > 0.55,
      owned: false,
    })
  }

  function burstAt(position, velocity, scale = 2) {
    const impact = velocity.clone()
    stampScar(scene, scars, position.x, position.z, scale * rand(0.7, 1.3), true)
    for (let i = 0; i < 10; i += 1) {
      const scrap = makeScrap(scale * rand(0.12, 0.45))
      scrap.position.set(
        position.x + rand(-1.5, 1.5),
        position.y + rand(0.2, 1.5),
        position.z + rand(-1.5, 1.5)
      )
      scene.add(scrap)
      debris.push({
        mesh: scrap,
        vel: new THREE.Vector3(
          impact.x * 0.2 + rand(-16, 16),
          rand(6, 22),
          impact.z * 0.2 + rand(-16, 16)
        ),
        spin: new THREE.Vector3(rand(-12, 12), rand(-12, 12), rand(-12, 12)),
        life: rand(2, 4.5),
        bounce: 0.28,
        onFire: Math.random() > 0.6,
        owned: true,
      })
    }
    if (Math.random() > 0.35) {
      const lick = makeFireball(scale * 0.5)
      lick.position.set(position.x, 0.35, position.z)
      scene.add(lick)
      fires.push({ group: lick, follow: null, life: 2.2, heat: 0.55 })
    }
  }

  function begin({ craft, position, velocity, isCar = false }) {
    clear()
    active = true
    age = 0
    const impact = velocity.clone()
    const speed = impact.length()
    const scale = Math.max(1.2, Math.min(4.5, (craft.def?.length || 12) * 0.12))

    // Ground scar + gouges under the wreck
    stampScar(scene, scars, position.x, position.z, scale * (isCar ? 2.2 : 3.4), true)
    // Skid scars along impact direction
    const dir = impact.clone()
    dir.y = 0
    if (dir.lengthSq() > 1) {
      dir.normalize()
      for (let i = 1; i <= 4; i += 1) {
        stampScar(
          scene,
          scars,
          position.x - dir.x * i * scale * 1.4,
          position.z - dir.z * i * scale * 1.4,
          scale * (1.1 - i * 0.12),
          i < 3
        )
      }
    }

    // Break real aircraft pieces off
    const breakables = collectBreakMeshes(craft)
    const take = Math.min(breakables.length, isCar ? 10 : 18)
    for (let i = 0; i < take; i += 1) {
      flingPiece(breakables[i], impact, 0.85 + Math.random() * 0.6)
    }

    // Extra scrap flying everywhere
    const scrapCount = isCar ? 28 : 55
    for (let i = 0; i < scrapCount; i += 1) {
      const size = scale * rand(0.15, 0.7)
      const scrap = makeScrap(size)
      scrap.position.set(
        position.x + rand(-2, 2),
        position.y + rand(0.5, 3),
        position.z + rand(-2, 2)
      )
      scrap.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI))
      scene.add(scrap)
      debris.push({
        mesh: scrap,
        vel: new THREE.Vector3(
          impact.x * 0.3 + rand(-22, 22),
          rand(10, 36) + speed * 0.08,
          impact.z * 0.3 + rand(-22, 22)
        ),
        spin: new THREE.Vector3(rand(-14, 14), rand(-14, 14), rand(-14, 14)),
        life: rand(3, 7),
        bounce: 0.3 + Math.random() * 0.3,
        onFire: Math.random() > 0.7,
        owned: true,
      })
    }

    // Main wreck fire + secondary fires
    const mainFire = makeFireball(scale * (isCar ? 1.1 : 1.6))
    mainFire.position.copy(position)
    mainFire.position.y = Math.max(0.4, position.y)
    scene.add(mainFire)
    fires.push({ group: mainFire, follow: "wreck", life: 8, heat: 1 })

    for (let i = 0; i < 3; i += 1) {
      const side = makeFireball(scale * rand(0.45, 0.85))
      side.position.set(
        position.x + rand(-scale * 2, scale * 2),
        0.3,
        position.z + rand(-scale * 2, scale * 2)
      )
      scene.add(side)
      fires.push({ group: side, follow: null, life: 5 + Math.random() * 3, heat: 0.7 })
    }

    spawnSparks(position, isCar ? 70 : 120)
  }

  function update(dt, wreckPos) {
    if (!active) return
    age += dt

    for (let i = debris.length - 1; i >= 0; i -= 1) {
      const d = debris[i]
      d.life -= dt
      d.vel.y -= 28 * dt
      d.vel.x *= 1 - 0.4 * dt
      d.vel.z *= 1 - 0.4 * dt
      d.mesh.position.addScaledVector(d.vel, dt)
      d.mesh.rotation.x += d.spin.x * dt
      d.mesh.rotation.y += d.spin.y * dt
      d.mesh.rotation.z += d.spin.z * dt
      if (d.mesh.position.y < 0.12) {
        d.mesh.position.y = 0.12
        if (d.vel.y < 0) {
          d.vel.y *= -d.bounce
          d.vel.x *= 0.7
          d.vel.z *= 0.7
          d.spin.multiplyScalar(0.7)
          // Fresh scar where heavy parts slam
          if (d.bounce > 0.4 && Math.abs(d.vel.y) > 4 && Math.random() > 0.7) {
            stampScar(scene, scars, d.mesh.position.x, d.mesh.position.z, rand(0.6, 1.6), d.onFire)
            d.bounce *= 0.6
          }
        }
      }
      if (d.onFire && Math.random() > 0.97 && fires.length < 14) {
        const lick = makeFireball(0.35)
        lick.position.copy(d.mesh.position)
        scene.add(lick)
        fires.push({ group: lick, follow: null, life: 1.4, heat: 0.4, stick: d })
      }
      if (d.life <= 0) {
        scene.remove(d.mesh)
        if (d.owned) disposeOwnedMesh(d.mesh)
        debris.splice(i, 1)
      }
    }

    for (let i = fires.length - 1; i >= 0; i -= 1) {
      const f = fires[i]
      f.life -= dt
      if (f.follow === "wreck" && wreckPos) {
        f.group.position.lerp(wreckPos, 1 - Math.exp(-6 * dt))
        f.group.position.y = Math.max(0.35, wreckPos.y * 0.4 + 0.5)
      }
      if (f.stick && f.stick.mesh) {
        f.group.position.copy(f.stick.mesh.position)
        f.group.position.y += 0.4
      }
      const flicker = 0.75 + Math.sin(age * 18 + i) * 0.25
      f.group.scale.setScalar(flicker * (0.85 + f.heat * 0.3))
      f.group.traverse((n) => {
        if (!n.isMesh || !n.material) return
        if (n.userData.smoke) {
          n.position.y += 1.8 * dt
          n.material.opacity = Math.max(0, (n.userData.baseOp || 0.3) * (f.life / 4))
          n.scale.multiplyScalar(1 + 0.35 * dt)
        } else if (n.userData.baseOp != null) {
          n.material.opacity = n.userData.baseOp * (0.65 + Math.random() * 0.35) * Math.min(1, f.life)
          n.position.y = (n.userData.baseY || 0) + Math.sin(age * 22 + n.id) * 0.08
        }
      })
      if (f.life <= 0) {
        scene.remove(f.group)
        f.group.traverse((n) => {
          n.geometry?.dispose?.()
          n.material?.dispose?.()
        })
        fires.splice(i, 1)
      }
    }

    if (sparks) {
      sparks.life -= dt
      const arr = sparks.geo.attributes.position.array
      for (let i = 0; i < sparks.velocities.length; i += 1) {
        const v = sparks.velocities[i]
        v.y -= 40 * dt
        arr[i * 3] += v.x * dt
        arr[i * 3 + 1] += v.y * dt
        arr[i * 3 + 2] += v.z * dt
        if (arr[i * 3 + 1] < 0.05) {
          arr[i * 3 + 1] = 0.05
          v.y *= -0.2
          v.x *= 0.5
          v.z *= 0.5
        }
      }
      sparks.geo.attributes.position.needsUpdate = true
      sparks.mat.opacity = Math.max(0, sparks.life / 1.6)
      if (sparks.life <= 0) {
        scene.remove(sparks.points)
        sparks.geo.dispose()
        sparks.mat.dispose()
        sparks = null
      }
    }
  }

  return {
    begin,
    burstAt,
    update,
    clear,
    get active() {
      return active
    },
  }
}
