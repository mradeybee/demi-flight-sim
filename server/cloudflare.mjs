/**
 * Cloudflare host: static files via the ASSETS binding, multiplayer on /ws.
 * One FlightRoom Durable Object is the shared lobby (same job as server/multiplayer.mjs).
 */
import { DurableObject } from "cloudflare:workers"
import {
  slotOrigin,
  padForSlot,
  sanitizeName,
  airportLabel,
} from "../js/airportSlots.js"

function sanitizeChat(raw) {
  return String(raw || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140)
}

function publicPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    slot: p.slot,
    origin: slotOrigin(p.slot),
    pad: padForSlot(p.slot),
    label: airportLabel(p.name),
    state: p.state || null,
  }
}

function readState(msg) {
  return {
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
}

export class FlightRoom extends DurableObject {
  players() {
    const list = []
    for (const ws of this.ctx.getWebSockets()) {
      const data = ws.deserializeAttachment()
      if (data?.id) list.push(data)
    }
    return list
  }

  send(ws, msg) {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      /* socket already closing */
    }
  }

  broadcast(msg, except = null) {
    const raw = JSON.stringify(msg)
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue
      try {
        ws.send(raw)
      } catch {
        /* socket already closing */
      }
    }
  }

  allocateSlot() {
    const used = new Set(this.players().map((p) => p.slot))
    let slot = 0
    while (used.has(slot)) slot += 1
    return slot
  }

  async allocateId() {
    const next = (await this.ctx.storage.get("nextId")) || 1
    await this.ctx.storage.put("nextId", next + 1)
    return `p${next}`
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 })
    }
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    const origin = new URL(request.url).origin
    server.serializeAttachment({ origin })
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws, message) {
    let msg
    try {
      const text = typeof message === "string" ? message : new TextDecoder().decode(message)
      msg = JSON.parse(text)
    } catch {
      return
    }

    if (msg.type === "join") {
      await this.ctx.blockConcurrencyWhile(() => this.join(ws, msg))
      return
    }

    const me = ws.deserializeAttachment()
    if (!me?.id) return

    if (msg.type === "rename") {
      me.name = sanitizeName(msg.name)
      ws.serializeAttachment(me)
      const player = publicPlayer(me)
      this.broadcast({ type: "peer_update", player })
      this.send(ws, { type: "renamed", you: player })
      return
    }

    if (msg.type === "state") {
      me.state = readState(msg)
      ws.serializeAttachment(me)
      this.broadcast({
        type: "peer_state",
        id: me.id,
        name: me.name,
        slot: me.slot,
        ...me.state,
      }, ws)
      return
    }

    if (msg.type === "chat") {
      const text = sanitizeChat(msg.text)
      if (!text) return
      const now = Date.now()
      if (me.lastChatAt && now - me.lastChatAt < 350) return
      me.lastChatAt = now
      ws.serializeAttachment(me)
      const payload = {
        type: "chat",
        id: me.id,
        name: me.name,
        text,
        at: now,
      }
      this.send(ws, payload)
      this.broadcast(payload, ws)
    }
  }

  async join(ws, msg) {
    const prior = ws.deserializeAttachment()
    if (prior?.id) return
    const name = sanitizeName(msg.name)
    const id = await this.allocateId()
    const slot = this.allocateSlot()
    const me = {
      id,
      name,
      slot,
      state: null,
      lastChatAt: 0,
      origin: prior?.origin || "",
    }
    ws.serializeAttachment(me)
    const you = publicPlayer(me)
    const peers = this.players().filter((p) => p.id !== id).map(publicPlayer)
    this.send(ws, {
      type: "welcome",
      you,
      peers,
      joinUrlHint: me.origin ? [me.origin] : [],
    })
    this.broadcast({ type: "peer_join", player: you }, ws)
  }

  async webSocketClose(ws) {
    const me = ws.deserializeAttachment()
    if (!me?.id) return
    this.broadcast({ type: "peer_leave", id: me.id }, ws)
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === "/ws") {
      const id = env.FLIGHT_ROOM.idFromName("lobby")
      return env.FLIGHT_ROOM.get(id).fetch(request)
    }
    return env.ASSETS.fetch(request)
  },
}
