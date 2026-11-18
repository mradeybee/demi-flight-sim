#!/usr/bin/env node
/**
 * LAN host: static files + WebSocket multiplayer for Turbo Flight Sim.
 * Usage: node server/multiplayer.mjs [port]
 */
import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { fileURLToPath } from "node:url"
import { WebSocketServer } from "ws"
import {
  PAD_LOCAL,
  slotOrigin,
  sanitizeName,
  airportLabel,
} from "../js/airportSlots.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const PORT = Number(process.argv[2] || process.env.PORT || 8765)

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".command": "text/plain; charset=utf-8",
}

const players = new Map() // id -> { id, name, slot, ws, state }
let nextId = 1
const usedSlots = new Set()

function allocateSlot() {
  let slot = 0
  while (usedSlots.has(slot)) slot += 1
  usedSlots.add(slot)
  return slot
}

function sanitizeOrigin(x, z) {
  const nx = Number(x)
  const nz = Number(z)
  if (!Number.isFinite(nx) || !Number.isFinite(nz)) return null
  const limit = 88000
  const dist = Math.hypot(nx, nz)
  if (dist > limit) {
    const scale = limit / dist
    return { x: Math.round(nx * scale), z: Math.round(nz * scale) }
  }
  return { x: Math.round(nx), z: Math.round(nz) }
}

function publicPlayer(p) {
  const origin = p.origin || slotOrigin(p.slot)
  return {
    id: p.id,
    name: p.name,
    slot: p.slot,
    origin,
    pad: { x: origin.x + PAD_LOCAL.x, z: origin.z + PAD_LOCAL.z },
    label: airportLabel(p.name),
    state: p.state || null,
  }
}

function broadcast(msg, exceptId = null) {
  const raw = JSON.stringify(msg)
  for (const p of players.values()) {
    if (p.id === exceptId) continue
    if (p.ws.readyState === 1) p.ws.send(raw)
  }
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(JSON.stringify(msg))
}

function lanAddresses() {
  const list = []
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const n of nets || []) {
      if (n.family === "IPv4" && !n.internal) list.push(n.address)
    }
  }
  return list
}

function sanitizeChat(raw) {
  return String(raw || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140)
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`)
    let pathname = decodeURIComponent(url.pathname)
    if (pathname === "/lan.json") {
      const urls = lanAddresses().map((ip) => `http://${ip}:${PORT}`)
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-cache",
      })
      res.end(JSON.stringify({ urls }))
      return
    }
    if (pathname === "/") pathname = "/index.html"
    if (pathname.includes("..")) {
      res.writeHead(403)
      res.end("Forbidden")
      return
    }
    const filePath = path.join(ROOT, pathname)
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403)
      res.end("Forbidden")
      return
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404)
      res.end("Not found")
      return
    }
    const ext = path.extname(filePath).toLowerCase()
    const headers = { "Content-Type": MIME[ext] || "application/octet-stream" }
    // Keep hangar JS/CSS fresh so GLB preload + aircraft share one module cache.
    if (ext === ".js" || ext === ".css" || ext === ".html" || ext === ".mjs") {
      headers["Cache-Control"] = "no-cache"
    }
    res.writeHead(200, headers)
    fs.createReadStream(filePath).pipe(res)
  } catch (err) {
    res.writeHead(500)
    res.end(String(err))
  }
})

const wss = new WebSocketServer({ server, path: "/ws" })

wss.on("connection", (ws) => {
  let me = null

  ws.on("message", (buf) => {
    let msg
    try {
      msg = JSON.parse(String(buf))
    } catch {
      return
    }

    if (msg.type === "join") {
      if (me) return
      const name = sanitizeName(msg.name)
      const id = `p${nextId++}`
      const slot = allocateSlot()
      const origin = sanitizeOrigin(msg.x, msg.z) || slotOrigin(slot)
      me = { id, name, slot, origin, ws, state: null }
      players.set(id, me)
      send(ws, {
        type: "welcome",
        you: publicPlayer(me),
        peers: [...players.values()].filter((p) => p.id !== id).map(publicPlayer),
        joinUrlHint: lanAddresses().map((ip) => `http://${ip}:${PORT}`),
      })
      broadcast({ type: "peer_join", player: publicPlayer(me) }, id)
      console.log(`[join] ${name} slot=${slot} (${players.size} online)`)
      return
    }

    if (!me) return

    if (msg.type === "rename") {
      me.name = sanitizeName(msg.name)
      broadcast({ type: "peer_update", player: publicPlayer(me) })
      send(ws, { type: "renamed", you: publicPlayer(me) })
      return
    }

    if (msg.type === "state") {
      me.state = {
        planeId: msg.planeId || "b737",
        x: Number(msg.x) || 0,
        y: Number(msg.y) || 0,
        z: Number(msg.z) || 0,
        qx: Number(msg.qx) || 0,
        qy: Number(msg.qy) || 0,
        qz: Number(msg.qz) || 0,
        qw: Number(msg.qw) || 1,
        throttle: Number(msg.throttle) || 0,
        gear: Number(msg.gear) ?? 1,
        flaps: Number(msg.flaps) || 0,
        doors: Number(msg.doors) || 0,
        lights: Number(msg.lights) || 0,
        spoilers: Number(msg.spoilers) || 0,
        outside: !!msg.outside,
        mode: msg.mode || "menu",
      }
      broadcast({
        type: "peer_state",
        id: me.id,
        name: me.name,
        slot: me.slot,
        ...me.state,
      }, me.id)
      return
    }

    if (msg.type === "chat") {
      const text = sanitizeChat(msg.text)
      if (!text) return
      const now = Date.now()
      if (me.lastChatAt && now - me.lastChatAt < 350) return
      me.lastChatAt = now
      const payload = {
        type: "chat",
        id: me.id,
        name: me.name,
        text,
        at: now,
      }
      // Echo to sender so everyone sees the same stream.
      send(ws, payload)
      broadcast(payload, me.id)
    }
  })

  ws.on("close", () => {
    if (!me) return
    players.delete(me.id)
    usedSlots.delete(me.slot)
    broadcast({ type: "peer_leave", id: me.id })
    console.log(`[leave] ${me.name} (${players.size} online)`)
    me = null
  })
})

server.listen(PORT, "0.0.0.0", () => {
  const ips = lanAddresses()
  console.log(`Turbo Flight Sim multiplayer on port ${PORT}`)
  console.log(`  Local:  http://127.0.0.1:${PORT}`)
  for (const ip of ips) console.log(`  LAN:    http://${ip}:${PORT}`)
  console.log("Friends on the same Wi-Fi open a LAN URL, enter a name, and get their own airport.")
})
