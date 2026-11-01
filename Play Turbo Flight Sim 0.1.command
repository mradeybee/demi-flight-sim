#!/bin/bash
cd "$(dirname "$0")"
PORT=8765

# Prefer the multiplayer Node host (static + WebSocket). Fall back to python if needed.
if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  :
else
  if command -v node >/dev/null 2>&1; then
    node server/multiplayer.mjs "$PORT" >/tmp/turbo-flight-sim-0.1.log 2>&1 &
  else
    python3 -m http.server "$PORT" >/tmp/turbo-flight-sim-0.1.log 2>&1 &
  fi
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      break
    fi
    sleep 0.2
  done
fi

# Show LAN URLs in Terminal so friends can join.
echo "Turbo Flight Sim multiplayer"
echo "  Local: http://127.0.0.1:$PORT"
if command -v ipconfig >/dev/null 2>&1; then
  for ip in $(ipconfig getifaddr en0 2>/dev/null; ipconfig getifaddr en1 2>/dev/null); do
    echo "  LAN:   http://$ip:$PORT"
  done
fi
echo "Open the LAN link on phones/laptops on the same Wi-Fi."
echo ""

open "http://127.0.0.1:$PORT/?v=82"
