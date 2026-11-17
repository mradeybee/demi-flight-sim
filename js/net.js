/** LAN WebSocket client for Turbo Flight Sim multiplayer. */

export function createNet({ onWelcome, onPeerJoin, onPeerLeave, onPeerState, onPeerUpdate, onChat, onStatus }) {
  let ws = null
  let you = null
  let peers = new Map()
  let closed = false
  let retryTimer = null
  let playerName = "Pilot"

  function status(text, kind = "info") {
    onStatus?.(text, kind)
  }

  function handle(msg) {
    if (msg.type === "welcome") {
      you = msg.you
      peers = new Map(msg.peers.map((p) => [p.id, p]))
      onWelcome?.(msg)
      status(`Online as ${you.name} · ${you.label}`, "ok")
      return
    }
    if (msg.type === "peer_join") {
      peers.set(msg.player.id, msg.player)
      onPeerJoin?.(msg.player)
      return
    }
    if (msg.type === "peer_leave") {
      peers.delete(msg.id)
      onPeerLeave?.(msg.id)
      return
    }
    if (msg.type === "peer_update") {
      peers.set(msg.player.id, msg.player)
      onPeerUpdate?.(msg.player)
      return
    }
    if (msg.type === "peer_state") {
      const existing = peers.get(msg.id) || { id: msg.id, name: msg.name, slot: msg.slot }
      existing.state = msg
      peers.set(msg.id, existing)
      onPeerState?.(msg)
      return
    }
    if (msg.type === "chat") {
      onChat?.(msg)
      return
    }
    if (msg.type === "renamed") {
      you = msg.you
      onWelcome?.({ you, peers: [...peers.values()], renamed: true })
    }
  }

  function connect(name) {
    playerName = name
    closed = false
    const proto = location.protocol === "https:" ? "wss" : "ws"
    const url = `${proto}://${location.host}/ws`
    status("Connecting to multiplayer…")
    try {
      ws = new WebSocket(url)
    } catch (err) {
      status("Multiplayer unavailable — flying offline.", "warn")
      onWelcome?.({ you: null, peers: [], offline: true, error: String(err) })
      return
    }
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "join", name: playerName }))
    })
    ws.addEventListener("message", (ev) => {
      try {
        handle(JSON.parse(ev.data))
      } catch { /* ignore */ }
    })
    ws.addEventListener("close", () => {
      if (closed) return
      status("Disconnected — retrying…", "warn")
      clearTimeout(retryTimer)
      retryTimer = setTimeout(() => connect(playerName), 2000)
    })
    ws.addEventListener("error", () => {
      // close handler retries
    })
  }

  function sendState(payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN || !you) return
    ws.send(JSON.stringify({ type: "state", ...payload }))
  }

  function rename(name) {
    playerName = name
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: "rename", name }))
  }

  function sendChat(text) {
    if (!ws || ws.readyState !== WebSocket.OPEN || !you) return false
    const cleaned = String(text || "").replace(/\s+/g, " ").trim().slice(0, 140)
    if (!cleaned) return false
    ws.send(JSON.stringify({ type: "chat", text: cleaned }))
    return true
  }

  function disconnect() {
    closed = true
    clearTimeout(retryTimer)
    ws?.close()
  }

  return {
    connect,
    sendState,
    sendChat,
    rename,
    disconnect,
    get you() { return you },
    get peers() { return peers },
    get online() { return !!(ws && ws.readyState === WebSocket.OPEN && you) },
  }
}
