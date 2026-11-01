/** Shared airport layout math for client + LAN host. */

/**
 * First pads stay close on North America so friends can see each other's planes.
 * Later slots spread to other continents.
 */
export const SLOT_ORIGINS = [
  { x: 0, z: 0 },             // NA home
  { x: -1600, z: 900 },       // NA ~1.8 km
  { x: -1600, z: -900 },      // NA
  { x: 1400, z: -1200 },      // NA
  { x: 1400, z: 1200 },       // NA
  { x: -2800, z: 0 },         // NA
  { x: 0, z: 2200 },          // NA
  { x: 0, z: -2200 },         // NA
  { x: 11000, z: -7000 },     // Europe
  { x: 9000, z: 9000 },       // Africa
  { x: 30000, z: -2000 },     // Asia
  { x: 34000, z: 20000 },     // Australia
  { x: -9000, z: 18000 },     // South America
  { x: -4000, z: 18000 },     // South America inland
  { x: 25000, z: 6000 },      // India
  { x: 15000, z: -10000 },    // Europe north
]

export const AIRPORT_SPACING = 1800
export const PAD_LOCAL = { x: -170, z: 220 }
export const TOWER_LOCAL = { x: 115, y: 48, z: 160 }
export const RUNWAY_LOCAL = { x: 0, z0: 0, z1: 2000, halfWidth: 24 }

export function slotOrigin(slot) {
  const s = Math.max(0, Math.floor(Number(slot) || 0))
  if (s < SLOT_ORIGINS.length) return { ...SLOT_ORIGINS[s] }
  // Overflow: compact ring around home field (still on land).
  const extra = s - SLOT_ORIGINS.length
  const ring = Math.floor(extra / 8) + 1
  const step = extra % 8
  const ang = (step / 8) * Math.PI * 2
  const radius = 2600 + ring * 1400
  return {
    x: Math.cos(ang) * radius,
    z: Math.sin(ang) * radius,
  }
}

export function padForSlot(slot) {
  const o = slotOrigin(slot)
  return { x: o.x + PAD_LOCAL.x, z: o.z + PAD_LOCAL.z }
}

export function towerForSlot(slot) {
  const o = slotOrigin(slot)
  return { x: o.x + TOWER_LOCAL.x, y: TOWER_LOCAL.y, z: o.z + TOWER_LOCAL.z }
}

export function sanitizeName(raw) {
  const cleaned = String(raw || "")
    .replace(/[^\w\s\-'.]/g, "")
    .trim()
    .slice(0, 16)
  return cleaned.length >= 2 ? cleaned : "Pilot"
}

export function airportLabel(name) {
  const n = sanitizeName(name)
  return `${n}'s Airport`
}
