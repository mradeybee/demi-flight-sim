# Turbo Flight Sim 0.1

**This was vibe coded by a 7-year-old.**

A browser flight sim you can open on a laptop or phone. Pick a plane in the hangar, take off from an airport named after you, and fly with friends on the same Wi-Fi.

## How to start

You need [Node.js](https://nodejs.org/) installed once. From this folder:

```bash
npm install
npm start
```

Then open [http://127.0.0.1:8765](http://127.0.0.1:8765).

On a Mac you can also double-click **Play Turbo Flight Sim 0.1.command**. It starts the same server on port 8765 and opens the game. If Node is missing, that launcher falls back to a plain file server (singleplayer only — no multiplayer).

## How a flight starts

1. Type a pilot name (at least 2 letters). The airport is named after you.
2. Press **S** for singleplayer or **M** for multiplayer.
3. In the hangar, pick a plane. Settings (off to the side) hold liveries, weather, and the airport name.
4. Press **Fly**.

The hangar has airliners, regionals, and smaller aircraft: 737 and A320 families, widebodies through the A380 and 747, the Beluga and an MD-11, turboprops, regional jets, a Citation, a Piper, a glider, a helicopter, an eVTOL, and a cargo drone. Doors, gear, flaps, and a few other parts move.

## Flying

Throttle goes up the slider on the right (or **X** for full, **Z** for idle). Move the mouse, the on-screen stick, or the arrow keys to pitch and bank. **Q** and **E** are rudder. **Space** is brake. Hold **Shift** to go faster.

| Key | What it does |
| --- | --- |
| W / S or arrows | Pitch up / down |
| A / D or arrows | Bank left / right |
| Q / E | Rudder |
| X / Z | Full throttle / idle |
| Space | Brake |
| Shift | Faster |
| G | Gear |
| F | Flaps |
| O | Doors (or canopy) |
| P | Spoilers |
| U | Cargo doors |
| N | Droop the nose (planes that have it) |
| L | Lights |
| B | Autopilot on / off |
| H | Autoland back at your airport |
| J, then J again | Jump out, or get back in |
| K | Practice a failure |
| C | Next camera |
| V | Swap planes in the air |
| [ / ] | Previous / next plane |
| R | Back on the runway |
| M | Sound on / off |
| T | Chat |
| Esc | Hangar |

On a phone, use the stick, throttle, and the buttons along the bottom. The hint line under the view lists the keys for the plane you are in.

Autopilot can hold heading, altitude, and speed. **HOME** (or **H**) flies you back to your own airport.

Failures can be off, on, or hard. **Fail now** (or **K**) starts a practice problem: engine, fire, hydraulics, electrics, a jammed gear, and similar. **Clear** puts the plane back together.

Weather is chosen in Settings, or set to live weather. The same choices are on the flight weather panel.

## Playing with friends

Multiplayer is for people on the same Wi-Fi. The person who starts the server is the host. Everyone else opens the LAN address the Terminal prints.

Each pilot gets their own airport slot. Planes, chat, and position updates go over a WebSocket on the same port as the page. Chat is **T**, with an emoji picker.

## How the code fits together

The game is one web page. There is no build step. `index.html` loads `js/main.js`, which pulls in the rest.

| Piece | Job |
| --- | --- |
| `index.html`, `css/style.css` | Hangar, HUD, stick, throttle, chat, crash screen |
| `js/main.js` | The game loop: input, flight, cameras, menus |
| `js/catalog.js` | Every plane’s size, engines, and flight numbers |
| `js/aircraft.js` | Builds and animates the 3D plane |
| `js/models.js` | Loads the `.glb` models |
| `js/gearKits.js` | Landing gear that folds |
| `js/world.js` | Ground, runway, and your airport |
| `js/weather.js` | Skies, wind, rain, storms |
| `js/looks.js`, `js/airline.js` | Paint and liveries |
| `js/net.js` | Talks to the multiplayer server |
| `server/multiplayer.mjs` | Serves the files and relays players on the LAN |
| `models/` | Aircraft models. See `models/CREDITS.txt` for licenses |

Flight is a simple model: thrust, drag, lift, and stall come from each plane’s cruise speed and mass in the catalog. The renderer is [Three.js](https://threejs.org/), loaded from `node_modules` through the import map in `index.html`.

Friends show up because `server/multiplayer.mjs` keeps a list of pilots, gives each one an airport slot, and broadcasts their plane state. `js/net.js` sends your plane and draws everyone else’s.

## Aircraft models

The 3D aircraft are not original to this game. Sources and licenses are in `models/CREDITS.txt` (CC BY 4.0 and GPLv2). Moving doors, gear, flaps, and the airline paint were made for Turbo Flight Sim.
