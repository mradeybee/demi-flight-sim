import * as THREE from "three"

export const AIRLINE_NAME = "Demi Airline"

export const LIVERIES = [
  { id: "demi", name: "Demi Airline", primary: "#0b3d91", secondary: "#7ec8e3", fuselage: "#f7f9fc" },
  { id: "sunset", name: "Sunset", primary: "#c45c28", secondary: "#f0a050", fuselage: "#fff4e8" },
  { id: "ocean", name: "Ocean Blue", primary: "#0077b6", secondary: "#00b4d8", fuselage: "#caf0f8" },
  { id: "forest", name: "Forest", primary: "#2d6a4f", secondary: "#95d5b2", fuselage: "#f1fff6" },
  { id: "night", name: "Night Owl", primary: "#1b1b3a", secondary: "#e94560", fuselage: "#2a2a4a" },
  { id: "banana", name: "Banana", primary: "#e9a825", secondary: "#ffe066", fuselage: "#fff8d6" },
  { id: "berry", name: "Berry", primary: "#9b2226", secondary: "#ee9b00", fuselage: "#fff1e6" },
  { id: "mint", name: "Mint", primary: "#2a9d8f", secondary: "#8ecae6", fuselage: "#f4fffc" },
  { id: "grape", name: "Grape", primary: "#5a189a", secondary: "#c77dff", fuselage: "#f8f0ff" },
  { id: "racing", name: "Racing", primary: "#d00000", secondary: "#ffba08", fuselage: "#ffffff" },
  { id: "arctic", name: "Arctic", primary: "#468faf", secondary: "#a9d6e5", fuselage: "#ffffff" },
  { id: "coral", name: "Coral", primary: "#e76f51", secondary: "#f4a261", fuselage: "#fff0eb" },
  { id: "lime", name: "Lime", primary: "#70e000", secondary: "#ccff33", fuselage: "#f4ffe8" },
  { id: "shadow", name: "Shadow", primary: "#212529", secondary: "#495057", fuselage: "#ced4da" },
  { id: "gold", name: "Gold Rush", primary: "#b08968", secondary: "#e6ccb2", fuselage: "#fff8f0" },
  { id: "candy", name: "Candy", primary: "#ff0a54", secondary: "#ff85a1", fuselage: "#ffe5ec" },
]

export const DEFAULT_AIRLINE = { ...LIVERIES[0] }

/** Classic FedEx Express purple + orange — locked onto the MD-11 freighter. */
export const FEDEX_LIVERY = {
  id: "fedex",
  name: "FedEx Express",
  primary: "#4D148C",
  secondary: "#FF6600",
  fuselage: "#f7f7f5",
}

const STORAGE_KEY = "turbo-flight-sim-2-livery"
const STORAGE_ID_KEY = "turbo-flight-sim-2-livery-id"

export function loadAirlineColors() {
  try {
    const id = localStorage.getItem(STORAGE_ID_KEY)
    const preset = LIVERIES.find((item) => item.id === id)
    if (preset) return { primary: preset.primary, secondary: preset.secondary, fuselage: preset.fuselage, id: preset.id }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_AIRLINE }
    const parsed = JSON.parse(raw)
    return {
      primary: parsed.primary || DEFAULT_AIRLINE.primary,
      secondary: parsed.secondary || DEFAULT_AIRLINE.secondary,
      fuselage: parsed.fuselage || DEFAULT_AIRLINE.fuselage,
      id: parsed.id || "custom",
    }
  } catch (error) {
    return { ...DEFAULT_AIRLINE }
  }
}

export function loadLiveryId() {
  return loadAirlineColors().id || "demi"
}

export function saveAirlineColors(colors) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colors))
  if (colors.id) localStorage.setItem(STORAGE_ID_KEY, colors.id)
}

export function liveryById(id) {
  return LIVERIES.find((item) => item.id === id) || LIVERIES[0]
}

export function isAirliner(def) {
  return def.group === "Airliners"
}

function disposeBrand(group) {
  group.traverse((node) => {
    if (node.geometry) node.geometry.dispose()
    if (node.material) {
      if (node.material.map) node.material.map.dispose()
      node.material.dispose()
    }
  })
}

/**
 * Paint a chosen livery onto any craft (airliners, GA, fighters).
 * Planes with `lockedLivery: "fedex"` always keep Express purple/orange.
 */
export function applyLivery(craft, colors = loadAirlineColors()) {
  if (!craft) return
  const locked = craft.def?.lockedLivery === "fedex" || craft.def?.brand === "fedex"
  const paint = locked ? FEDEX_LIVERY : colors
  const primary = new THREE.Color(paint.primary)
  const secondary = new THREE.Color(paint.secondary)
  const fuselage = new THREE.Color(paint.fuselage)

  if (craft.airlineBrand) {
    craft.root.remove(craft.airlineBrand)
    disposeBrand(craft.airlineBrand)
    craft.airlineBrand = null
  }

  // Keep procedural defs in sync so rebuilds / maps match.
  if (craft.def) {
    craft.def.body = paint.fuselage
    craft.def.accent = paint.primary
    if (locked) craft.def.accent2 = paint.secondary
  }

  // Real MD-11F already ships with a baked FedEx fuselage map — don't wash it out.
  const keepBakedFedex = locked && craft.useReal
  if (!keepBakedFedex) {
    craft.root.traverse((node) => {
      if (!node.isMesh || !node.material) return
      // Keep FedEx titles / chevrons / nose wrap on their brand materials.
      if (craft.fedexBrand && (node === craft.fedexBrand || craft.fedexBrand.children?.includes?.(node))) return
      let p = node.parent
      while (p) {
        if (p === craft.fedexBrand || p.name === "fedexBrand") return
        p = p.parent
      }
      const list = [].concat(node.material)
      for (const mat of list) {
        if (!mat || !mat.color) continue
        const name = (mat.name || node.name || "").toLowerCase()
        const lum = mat.color.r * 0.35 + mat.color.g * 0.45 + mat.color.b * 0.2
        const hex = mat.color.getHex()

        if (name.includes("glass") || name.includes("canopy") || mat.transparent && mat.opacity < 0.95) continue
        if (name.includes("tire") || name.includes("wheel") || hex === 0x1a1d22 || hex === 0x111111) continue
        if (name.includes("fedex")) continue
        // Don't recolor textured airframe parts — maps already carry the paint.
        if (mat.map) continue

        if (name.includes("accent") || name.includes("stripe")) {
          mat.color.copy(primary)
        } else if (lum > 0.72 || hex === 0xffffff || hex === 0xf5f5f5 || hex === 0xf4f8fb || hex === 0xf7f9fc) {
          mat.color.copy(fuselage)
        } else if (mat.color.b > mat.color.r + 0.08 && mat.color.b > 0.25) {
          mat.color.copy(primary)
        } else if (mat.color.b > 0.35 && lum > 0.35) {
          mat.color.copy(secondary)
        } else if (lum > 0.45 && lum < 0.72) {
          mat.color.copy(secondary)
        } else if (lum > 0.2) {
          mat.color.copy(primary)
        }
        mat.needsUpdate = true
      }
    })

    if (craft.mats?.paint?.color) craft.mats.paint.color.copy(fuselage)
    if (craft.mats?.wing?.color) craft.mats.wing.color.copy(fuselage)
    if (craft.mats?.accent?.color) craft.mats.accent.color.copy(primary)
    if (craft.mats?.accent2?.color) craft.mats.accent2.color.copy(secondary)

    // FedEx wordmark / chevron stay brand-purple — don't let airline remaps wash them.
    if (locked && craft.fedexBrand) {
      craft.fedexBrand.traverse((node) => {
        if (!node.isMesh || !node.material) return
        const name = (node.material.name || node.name || "").toLowerCase()
        if (name.includes("fedex-orange") || name.includes("orange")) {
          node.material.color?.copy(secondary)
        } else if (name.includes("fedex") || name.includes("purple")) {
          node.material.color?.copy(primary)
        }
      })
    }
  }

  craft.airlineColors = { ...paint }
  craft.liveryId = paint.id || "custom"
}

/** @deprecated use applyLivery */
export function applyDemiAirline(craft, colors = loadAirlineColors()) {
  applyLivery(craft, colors)
}
