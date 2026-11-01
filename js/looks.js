/**
 * Type-specific silhouette overrides so each catalog plane reads as its type,
 * not a generic tube. Applied before procedural mesh build (and before GLB alias).
 */

function twinJets(span, y, z, r) {
  return [
    { kind: "jet", x: -span * 0.16, y, z, r, pylon: true },
    { kind: "jet", x: span * 0.16, y, z, r, pylon: true },
  ]
}

function quadJets(span, y, z, r) {
  return [
    { kind: "jet", x: -span * 0.14, y, z, r, pylon: true },
    { kind: "jet", x: span * 0.14, y, z, r, pylon: true },
    { kind: "jet", x: -span * 0.28, y: y + 0.15, z: z - 1.2, r, pylon: true },
    { kind: "jet", x: span * 0.28, y: y + 0.15, z: z - 1.2, r, pylon: true },
  ]
}

function twinProps(span, y, z, r = 1.15) {
  return [
    { kind: "prop", x: -span * 0.22, y, z, r },
    { kind: "prop", x: span * 0.22, y, z, r },
  ]
}

function quadProps(span, y, z, r = 1.25) {
  return [
    { kind: "prop", x: -span * 0.16, y, z, r },
    { kind: "prop", x: span * 0.16, y, z, r },
    { kind: "prop", x: -span * 0.3, y, z: z - 0.3, r },
    { kind: "prop", x: span * 0.3, y, z: z - 0.3, r },
  ]
}

function noseProp(r = 0.9) {
  return [{ kind: "prop", x: 0, y: 0.05, z: 0.35, r }]
}

function rearTwins(radius, length, r) {
  return [
    { kind: "jet", x: -radius * 1.15, y: radius * 0.35, z: -length * 0.3, r },
    { kind: "jet", x: radius * 1.15, y: radius * 0.35, z: -length * 0.3, r },
  ]
}

/** Patch a plane def in place with type-accurate layout. */
export function applyTypeLook(def) {
  const id = def.id
  const L = def.length
  const R = def.radius
  const S = def.wing.span

  // —— Family airliners (close to AMV meshes; light layout nudges only) ——
  if (["a321", "a319", "a220", "b757", "tu204", "e190", "ssj100", "crj900"].includes(id)) {
    def.profile = "tube"
    def.wing.y = -R * 0.35
    def.wingtips = true
    def.engines = twinJets(S, -R * 0.85, 0.4, R * 0.42)
    def.tail = { type: "low" }
    return def
  }
  if (id === "md80" || id === "caravelle") {
    def.profile = "tube"
    def.wing.y = -R * 0.3
    def.engines = rearTwins(R, L, R * 0.4)
    def.tail = { type: "t" }
    def.wingtips = false
    return def
  }
  if (id === "md11" || id === "falcon8x") {
    def.profile = id === "md11" ? "jumbo" : "biz"
    def.engines = [
      ...twinJets(S, -R * 0.7, 0.3, R * 0.4),
      { kind: "jet", x: 0, y: R * 0.95, z: -L * 0.36, r: R * 0.36 },
    ]
    def.tail = { type: "t" }
    return def
  }
  if (["b777", "b767", "a330", "g650", "g550", "global7500", "legacy650", "kc10"].includes(id)) {
    def.profile = L > 50 ? "jumbo" : "tube"
    def.wing.y = -R * 0.3
    def.engines = twinJets(S, -R * 0.8, 0.5, R * 0.48)
    def.wingtips = true
    return def
  }
  if (id === "b747" || id === "b747f" || id === "il96") {
    def.profile = "jumbo"
    def.hump = "front"
    // Keep catalog wing/engine layout for b747 — it already matches Queen proportions.
    if (id !== "b747") {
      def.wing.y = -R * 0.35
      def.engines = quadJets(S, -R * 0.75, 0.2, R * 0.45)
    } else {
      def.wing.y = -R * 0.28
      def.wingtips = true
      def.engines = [
        { kind: "jet", x: -S * 0.18, y: -R * 0.72, z: 0.4, r: R * 0.48, pylon: true },
        { kind: "jet", x: S * 0.18, y: -R * 0.72, z: 0.4, r: R * 0.48, pylon: true },
        { kind: "jet", x: -S * 0.32, y: -R * 0.62, z: -0.6, r: R * 0.48, pylon: true },
        { kind: "jet", x: S * 0.32, y: -R * 0.62, z: -0.6, r: R * 0.48, pylon: true },
      ]
    }
    def.wingtips = true
    return def
  }

  // —— High-wing turboprops / airlifters ——
  if (["atr72", "atr42", "dash8", "saab340", "do328", "f50", "an24", "cn235", "ys11", "l410", "beech1900"].includes(id)) {
    def.profile = "twin"
    def.wing.y = R * 0.55
    def.wing.z = -L * 0.02
    def.wing.dihedral = 0.02
    def.engines = twinProps(S, R * 0.15, 0.6, 1.2)
    def.tail = { type: "t" }
    def.wingtips = false
    def.openings = "doors"
    def.doorCount = 2
    def.body = "#f7f9fc"
    def.accent = "#e63946"
    def.metal = 0.4
    def.rough = 0.34
    return def
  }
  if (["c130", "a400m", "c17", "c5", "an124", "an225", "il76"].includes(id)) {
    def.profile = "herc"
    def.wing.y = R * 0.65
    def.wing.z = -L * 0.04
    def.tail = { type: "t" }
    def.cargo = "ramp"
    def.wingtips = false
    def.body = "#c5cdd4"
    def.accent = "#3d4a3a"
    def.metal = 0.48
    def.rough = 0.4
    if (id === "an225") {
      def.engines = [
        ...quadJets(S * 0.85, -R * 0.15, 0.5, R * 0.38),
        { kind: "jet", x: -S * 0.36, y: -R * 0.05, z: 0, r: R * 0.38, pylon: true },
        { kind: "jet", x: S * 0.36, y: -R * 0.05, z: 0, r: R * 0.38, pylon: true },
      ]
      def.wing.y = -R * 0.2
    } else if (id === "c130" || id === "a400m") {
      def.engines = quadProps(S, R * 0.25, 0.8, 1.4)
      def.camo = ["#6b7058", "#3d4a3a", "#8a8f78"]
    } else {
      def.engines = quadJets(S, -R * 0.2, 0.4, R * 0.4)
      def.wing.y = -R * 0.15
    }
    return def
  }
  if (id === "b52") {
    def.profile = "tube"
    def.wing.y = -R * 0.15
    def.wing.sweep = S * 0.22
    def.engines = [
      { kind: "jet", x: -S * 0.12, y: -R * 0.55, z: 1, r: R * 0.28, pylon: true },
      { kind: "jet", x: S * 0.12, y: -R * 0.55, z: 1, r: R * 0.28, pylon: true },
      { kind: "jet", x: -S * 0.2, y: -R * 0.55, z: 0.4, r: R * 0.28, pylon: true },
      { kind: "jet", x: S * 0.2, y: -R * 0.55, z: 0.4, r: R * 0.28, pylon: true },
      { kind: "jet", x: -S * 0.28, y: -R * 0.5, z: -0.2, r: R * 0.28, pylon: true },
      { kind: "jet", x: S * 0.28, y: -R * 0.5, z: -0.2, r: R * 0.28, pylon: true },
      { kind: "jet", x: -S * 0.36, y: -R * 0.45, z: -0.8, r: R * 0.28, pylon: true },
      { kind: "jet", x: S * 0.36, y: -R * 0.45, z: -0.8, r: R * 0.28, pylon: true },
    ]
    def.tail = { type: "low" }
    return def
  }
  if (id === "kc135" || id === "vc10") {
    def.profile = "tube"
    def.engines = id === "vc10"
      ? [
          ...rearTwins(R, L, R * 0.32),
          { kind: "jet", x: -R * 0.45, y: R * 0.75, z: -L * 0.34, r: R * 0.3 },
          { kind: "jet", x: R * 0.45, y: R * 0.75, z: -L * 0.34, r: R * 0.3 },
        ]
      : quadJets(S, -R * 0.7, 0.3, R * 0.35)
    return def
  }

  // —— Business jets (rear engines, T-tail) ——
  if (["challenger350", "citationx", "citationcj4", "phenom300", "falcon2000", "hawker800", "lear45"].includes(id)) {
    def.profile = "biz"
    def.wing.y = -R * 0.35
    def.engines = rearTwins(R, L, R * 0.34)
    def.tail = { type: "t" }
    def.wingtips = true
    def.doorCount = 1
    return def
  }

  // —— GA singles / twins ——
  if (["c172", "c182", "cub", "supercub", "c208", "kodiak"].includes(id)) {
    def.profile = "light"
    def.wing.y = R * 0.55
    def.wing.dihedral = 0.04
    def.engines = noseProp(id === "c208" || id === "kodiak" ? 1.15 : 0.85)
    def.tail = { type: "low" }
    def.struts = true
    def.gear.mode = id === "c208" || id === "kodiak" ? "retract" : "fixed"
    def.wingtips = false
    def.metal = 0.22
    def.rough = 0.48
    if (id === "c172") {
      def.body = "#f4f7fa"
      def.accent = "#c1121f"
    }
    if (id === "cub" || id === "supercub") {
      def.body = "#f4d35e"
      def.accent = "#1d3557"
    }
    return def
  }
  if (["pa28", "pa46", "mooney", "cirrus", "diamond40", "bonanza"].includes(id)) {
    def.profile = "light"
    def.wing.y = -R * 0.25
    def.engines = noseProp(0.9)
    def.tail = { type: id === "bonanza" ? "v" : "low" }
    def.struts = false
    def.gear.mode = ["mooney", "cirrus", "pa46"].includes(id) ? "retract" : "fixed"
    return def
  }
  if (id === "baron" || id === "diamond42") {
    def.profile = "twin"
    def.wing.y = -R * 0.2
    def.engines = twinProps(S, -R * 0.05, 0.5, 0.9)
    def.gear.mode = "retract"
    return def
  }
  if (["pc12", "tbm940"].includes(id)) {
    def.profile = "biz"
    def.wing.y = -R * 0.2
    def.engines = noseProp(1.2)
    def.tail = { type: "t" }
    def.gear.mode = "retract"
    return def
  }
  if (id === "extra330" || id === "pitts") {
    def.profile = "aerobat"
    def.wing.y = 0
    def.engines = noseProp(0.95)
    def.checker = id === "extra330"
    def.biplane = id === "pitts"
    return def
  }

  // —— Fighters ——
  if (id === "a10") {
    def.profile = "fighter"
    def.wing.y = -R * 0.15
    def.wing.sweep = S * 0.05
    def.engines = [
      { kind: "jet", x: -R * 0.95, y: R * 0.55, z: -L * 0.22, r: R * 0.42 },
      { kind: "jet", x: R * 0.95, y: R * 0.55, z: -L * 0.22, r: R * 0.42 },
    ]
    def.twinFin = true
    def.gunNose = true
    def.body = "#5a6350"
    def.accent = "#2f3630"
    def.metal = 0.55
    def.camo = ["#4d5644", "#2c3330", "#6a7058"]
    return def
  }
  if (["mig29", "su27", "su57", "f15", "f14", "f18", "f22", "f4"].includes(id)) {
    def.profile = "fighter"
    def.twinFin = ["mig29", "su27", "su57", "f14", "f15", "f18", "f22"].includes(id)
    def.engines = [
      { kind: "jet", x: -R * 0.5, y: -R * 0.1, z: -L * 0.18, r: R * 0.42 },
      { kind: "jet", x: R * 0.5, y: -R * 0.1, z: -L * 0.18, r: R * 0.42 },
    ]
    if (id === "f14") def.wing.sweep = S * 0.35
    return def
  }
  if (["f16", "f35", "harrier", "gripen"].includes(id)) {
    def.profile = "fighter"
    def.engines = [{ kind: "jet", x: 0, y: -R * 0.05, z: -L * 0.12, r: R * 0.48 }]
    def.intake = id === "f16" ? "belly" : null
    if (id === "f16") {
      def.body = "#6d7880"
      def.accent = "#c45c26"
      def.metal = 0.7
      def.rough = 0.32
      def.camo = ["#5c666e", "#3f474d", "#7a848c"]
    }
    return def
  }
  if (["rafale", "typhoon", "mig21"].includes(id)) {
    def.profile = "fighter"
    def.delta = true
    def.canards = id !== "mig21"
    def.engines = id === "mig21"
      ? [{ kind: "jet", x: 0, y: 0, z: -L * 0.15, r: R * 0.45 }]
      : [
          { kind: "jet", x: -R * 0.35, y: 0, z: -L * 0.12, r: R * 0.38 },
          { kind: "jet", x: R * 0.35, y: 0, z: -L * 0.12, r: R * 0.38 },
        ]
    def.wing.sweep = S * 0.4
    def.wing.root = S * 0.4
    return def
  }

  // —— Warbirds / classics ——
  if (id === "spitfire" || id === "mustang") {
    def.profile = "warbird"
    def.wing.y = -R * 0.15
    def.engines = noseProp(1.05)
    def.elliptical = id === "spitfire"
    def.body = id === "spitfire" ? "#5f7f9a" : "#c4a574"
    def.accent = id === "spitfire" ? "#c1121f" : "#1d3557"
    def.metal = 0.58
    def.rough = 0.36
    return def
  }
  if (["b29", "lancaster", "constellation"].includes(id)) {
    def.profile = "tube"
    def.wing.y = -R * 0.2
    def.engines = quadProps(S, -R * 0.1, 1.0, 1.35)
    def.tripleTail = id === "constellation"
    return def
  }
  if (id === "dc3") {
    def.profile = "twin"
    def.wing.y = -R * 0.15
    def.engines = twinProps(S, -R * 0.05, 0.9, 1.25)
    def.body = "#d6d3d1"
    return def
  }
  if (["catalina", "belle", "spruce"].includes(id)) {
    def.profile = "herc"
    def.flyingBoat = true
    def.wing.y = R * 0.7
    def.engines = id === "spruce" || id === "belle" ? quadProps(S, R * 0.35, 1.2, 1.4) : twinProps(S, R * 0.4, 0.8, 1.3)
    def.tail = { type: "t" }
    def.gear.mode = "fixed"
    def.gear.height = R * 0.25
    return def
  }
  if (id === "comet") {
    def.profile = "tube"
    def.engines = [
      { kind: "jet", x: -S * 0.22, y: 0, z: 0.2, r: R * 0.22 },
      { kind: "jet", x: S * 0.22, y: 0, z: 0.2, r: R * 0.22 },
      { kind: "jet", x: -S * 0.3, y: 0, z: -0.3, r: R * 0.22 },
      { kind: "jet", x: S * 0.3, y: 0, z: -0.3, r: R * 0.22 },
    ]
    return def
  }
  if (id === "sr71") {
    def.profile = "fighter"
    def.chines = true
    def.body = "#1a1d22"
    def.accent = "#8a939c"
    def.metal = 0.9
    def.engines = [
      { kind: "jet", x: -S * 0.28, y: -R * 0.15, z: 0, r: R * 0.55, pylon: true },
      { kind: "jet", x: S * 0.28, y: -R * 0.15, z: 0, r: R * 0.55, pylon: true },
    ]
    def.twinFin = true
    return def
  }
  if (id === "u2") {
    def.profile = "tube"
    def.wing.y = R * 0.1
    def.wing.span = S
    def.wing.root = S * 0.08
    def.engines = [{ kind: "jet", x: 0, y: 0, z: -L * 0.08, r: R * 0.4 }]
    return def
  }
  if (id === "xb70") {
    def.profile = "fighter"
    def.delta = true
    def.engines = quadJets(S * 0.6, -R * 0.9, -L * 0.08, R * 0.32)
    def.wing.sweep = S * 0.5
    def.body = "#c5cdd4"
    return def
  }
  if (id === "concorde" || id === "tu144") {
    def.profile = "concorde"
    def.droop = true
    def.tail = { type: "none" }
    def.body = "#f2f4f7"
    def.accent = "#0a9396"
    def.metal = 0.68
    def.rough = 0.22
    def.engines = [
      { kind: "jet", x: -S * 0.2, y: -R * 0.45, z: -2, r: R * 0.55, buried: true },
      { kind: "jet", x: S * 0.2, y: -R * 0.45, z: -2, r: R * 0.55, buried: true },
      { kind: "jet", x: -S * 0.12, y: -R * 0.45, z: -2.4, r: R * 0.55, buried: true },
      { kind: "jet", x: S * 0.12, y: -R * 0.45, z: -2.4, r: R * 0.55, buried: true },
    ]
    return def
  }

  return def
}
