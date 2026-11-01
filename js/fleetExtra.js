/** 13 Turbo Flight Sim 0.1 hangar planes (procedural). */
export const EXTRA_PLANES = [
  {
    "id": "b777",
    "name": "Boeing 777",
    "group": "Airliners",
    "role": "Long-haul twin",
    "number": "TF-B770",
    "blurb": "Huge long-haul twin. Open the doors, gear, flaps, spoilers, and cargo holds.",
    "body": "#f5f8ff",
    "accent": "#023e8a",
    "metal": 0.55,
    "length": 74,
    "radius": 3.1,
    "profile": "jumbo",
    "wing": {
      "y": -0.6200000000000001,
      "z": -2.96,
      "span": 65,
      "root": 9.100000000000001,
      "tip": 2.2750000000000004,
      "sweep": 6.5,
      "dihedral": 0.07
    },
    "tail": {
      "type": "low"
    },
    "engines": [
      {
        "kind": "jet",
        "x": -10.4,
        "y": -2.17,
        "z": 0.4,
        "r": 1.395,
        "pylon": true
      },
      {
        "kind": "jet",
        "x": 10.4,
        "y": -2.17,
        "z": 0.4,
        "r": 1.395,
        "pylon": true
      }
    ],
    "gear": {
      "mode": "retract",
      "style": "tricycle",
      "height": 6.510000000000001,
      "track": 0.13,
      "fold": "in"
    },
    "openings": "doors",
    "doorCount": 6,
    "flaps": true,
    "spoilers": true,
    "cargo": "belly",
    "droop": false,
    "struts": false,
    "wingtips": true,
    "cruise": 250,
    "drag": 0.0042,
    "mass": 26,
    "pitch": 0.3,
    "roll": 0.42,
    "yaw": 0.2,
    "stability": 0.9
  },
  {
    "id": "b747",
    "name": "Boeing 747",
    "group": "Airliners",
    "role": "Queen of the skies",
    "number": "TF-B748",
    "blurb": "Queen of the skies. Doors, gear, flaps, spoilers, and cargo holds all open.",
    "body": "#f5f8ff",
    "accent": "#1d3557",
    "metal": 0.55,
    "length": 71,
    "radius": 3.4,
    "profile": "jumbo",
    "hump": "front",
    "wing": {
      "y": -0.68,
      "z": -2.84,
      "span": 64,
      "root": 8.96,
      "tip": 2.24,
      "sweep": 6.4,
      "dihedral": 0.07
    },
    "tail": {
      "type": "low"
    },
    "engines": [
      {
        "kind": "jet",
        "x": -11.52,
        "y": -2.38,
        "z": 0,
        "r": 1.632,
        "pylon": true
      },
      {
        "kind": "jet",
        "x": 11.52,
        "y": -2.38,
        "z": 0,
        "r": 1.632,
        "pylon": true
      },
      {
        "kind": "jet",
        "x": -19.2,
        "y": -2.08,
        "z": -1.5,
        "r": 1.632,
        "pylon": true
      },
      {
        "kind": "jet",
        "x": 19.2,
        "y": -2.08,
        "z": -1.5,
        "r": 1.632,
        "pylon": true
      }
    ],
    "gear": {
      "mode": "retract",
      "style": "tricycle",
      "height": 7.14,
      "track": 0.13,
      "fold": "in"
    },
    "openings": "doors",
    "doorCount": 6,
    "flaps": true,
    "spoilers": true,
    "cargo": "belly",
    "droop": false,
    "struts": false,
    "wingtips": true,
    "cruise": 250,
    "drag": 0.0042,
    "mass": 28,
    "pitch": 0.3,
    "roll": 0.42,
    "yaw": 0.2,
    "stability": 0.9
  },
  {
    "id": "atr72",
    "name": "ATR 72",
    "group": "Regional",
    "role": "Turboprop puddle-jumper",
    "number": "TF-R01",
    "blurb": "Twin turboprop. Props spin; doors, gear, and flaps work.",
    "body": "#f4f8fb",
    "accent": "#1d4e89",
    "metal": 0.4,
    "length": 27,
    "radius": 1.4,
    "profile": "twin",
    "wing": {
      "y": -0.21,
      "z": -1,
      "span": 27,
      "root": 3.2399999999999998,
      "tip": 1.08,
      "sweep": 1.2,
      "dihedral": 0.04
    },
    "tail": {
      "type": "low"
    },
    "engines": [
      {
        "kind": "prop",
        "x": -5.94,
        "y": -0.13999999999999999,
        "z": 0.8,
        "r": 1.15
      },
      {
        "kind": "prop",
        "x": 5.94,
        "y": -0.13999999999999999,
        "z": 0.8,
        "r": 1.15
      }
    ],
    "gear": {
      "mode": "retract",
      "style": "tricycle",
      "height": 2.52,
      "track": 0.18,
      "fold": "in"
    },
    "openings": "doors",
    "doorCount": 2,
    "flaps": true,
    "spoilers": false,
    "cargo": null,
    "droop": false,
    "struts": false,
    "wingtips": false,
    "cruise": 140,
    "drag": 0.008,
    "mass": 8,
    "pitch": 0.45,
    "roll": 0.6,
    "yaw": 0.35,
    "stability": 0.82
  },
  {
    "id": "c130",
    "name": "Lockheed C-130",
    "group": "Regional",
    "role": "Tactical airlifter",
    "number": "TF-R08",
    "blurb": "Military cargo plane. Open the rear cargo ramp, doors, gear, and flaps.",
    "body": "#c5d5e4",
    "accent": "#457b9d",
    "metal": 0.4,
    "length": 30,
    "radius": 2.2,
    "profile": "herc",
    "wing": {
      "y": 1.2100000000000002,
      "z": -1,
      "span": 40,
      "root": 4.8,
      "tip": 1.6,
      "sweep": 1.2,
      "dihedral": 0.04
    },
    "tail": {
      "type": "t"
    },
    "engines": [
      {
        "kind": "prop",
        "x": -7.199999999999999,
        "y": 0.77,
        "z": 1,
        "r": 1.35
      },
      {
        "kind": "prop",
        "x": 7.199999999999999,
        "y": 0.77,
        "z": 1,
        "r": 1.35
      },
      {
        "kind": "prop",
        "x": -12.8,
        "y": 0.77,
        "z": 0.6,
        "r": 1.35
      },
      {
        "kind": "prop",
        "x": 12.8,
        "y": 0.77,
        "z": 0.6,
        "r": 1.35
      }
    ],
    "gear": {
      "mode": "retract",
      "style": "tricycle",
      "height": 3.9600000000000004,
      "track": 0.18,
      "fold": "in"
    },
    "openings": "doors",
    "doorCount": 2,
    "flaps": true,
    "spoilers": false,
    "cargo": "ramp",
    "droop": false,
    "struts": false,
    "wingtips": false,
    "cruise": 150,
    "drag": 0.008,
    "mass": 14,
    "pitch": 0.45,
    "roll": 0.6,
    "yaw": 0.35,
    "stability": 0.82
  },
  {
    "id": "g650",
    "name": "Gulfstream G650",
    "group": "Business jets",
    "role": "Ultra-long-range biz",
    "number": "TF-B01",
    "blurb": "Sleek business jet. Cabin door, gear, flaps, and spoilers move.",
    "body": "#eef2f6",
    "accent": "#023e8a",
    "metal": 0.62,
    "length": 30,
    "radius": 1.3,
    "profile": "biz",
    "wing": {
      "y": -0.325,
      "z": -0.5,
      "span": 30,
      "root": 4.2,
      "tip": 1.2,
      "sweep": 3.5999999999999996,
      "dihedral": 0.05
    },
    "tail": {
      "type": "t"
    },
    "engines": [
      {
        "kind": "jet",
        "x": -1.3650000000000002,
        "y": 0.325,
        "z": -8.4,
        "r": 0.46799999999999997
      },
      {
        "kind": "jet",
        "x": 1.3650000000000002,
        "y": 0.325,
        "z": -8.4,
        "r": 0.46799999999999997
      }
    ],
    "gear": {
      "mode": "retract",
      "style": "tricycle",
      "height": 2.21,
      "track": 0.2,
      "fold": "in"
    },
    "openings": "doors",
    "doorCount": 1,
    "flaps": true,
    "spoilers": true,
    "cargo": null,
    "droop": false,
    "struts": false,
    "wingtips": true,
    "cruise": 250,
    "drag": 0.0055,
    "mass": 10,
    "pitch": 0.5,
    "roll": 0.7,
    "yaw": 0.4,
    "stability": 0.8
  },
  {
    "id": "c172",
    "name": "Cessna 172",
    "group": "General aviation",
    "role": "Skyhawk trainer",
    "number": "TF-G01",
    "blurb": "Friendly trainer. Open the door, set flaps, and go flying.",
    "body": "#ecf3f8",
    "accent": "#2a9d8f",
    "metal": 0.3,
    "checker": false,
    "length": 8.3,
    "radius": 0.7,
    "profile": "light",
    "wing": {
      "y": 0.27999999999999997,
      "z": -0.3,
      "span": 11,
      "root": 1.76,
      "tip": 0.55,
      "sweep": 0.5,
      "dihedral": 0.03
    },
    "tail": {
      "type": "low"
    },
    "engines": [
      {
        "kind": "prop",
        "x": 0,
        "y": 0,
        "z": 0.2,
        "r": 0.85
      }
    ],
    "gear": {
      "mode": "fixed",
      "style": "tricycle",
      "height": 1.0499999999999998,
      "track": 0.28,
      "fold": "in"
    },
    "openings": "doors",
    "doorCount": 1,
    "flaps": true,
    "spoilers": false,
    "cargo": null,
    "droop": false,
    "struts": false,
    "wingtips": false,
    "cruise": 60,
    "drag": 0.016,
    "mass": 2.2,
    "pitch": 0.7,
    "roll": 0.9,
    "yaw": 0.5,
    "stability": 0.7,
    "stallFrac": 0.4,
    "rotateFrac": 0.35
  },
  {
    "id": "extra330",
    "name": "Extra 330",
    "group": "Sport",
    "role": "Aerobatic knife",
    "number": "TF-G12",
    "blurb": "Aerobatic knife. Open the canopy-style door and pull hard.",
    "body": "#f8f1e7",
    "accent": "#e63946",
    "metal": 0.3,
    "checker": true,
    "length": 7,
    "radius": 0.55,
    "profile": "aerobat",
    "wing": {
      "y": 0,
      "z": -0.3,
      "span": 7.5,
      "root": 1.2,
      "tip": 0.375,
      "sweep": 0.2,
      "dihedral": 0
    },
    "tail": {
      "type": "low"
    },
    "engines": [
      {
        "kind": "prop",
        "x": 0,
        "y": 0,
        "z": 0.2,
        "r": 0.85
      }
    ],
    "gear": {
      "mode": "fixed",
      "style": "tricycle",
      "height": 0.8250000000000001,
      "track": 0.28,
      "fold": "in"
    },
    "openings": "canopy",
    "doorCount": 1,
    "flaps": false,
    "spoilers": false,
    "cargo": null,
    "droop": false,
    "struts": false,
    "wingtips": false,
    "cruise": 95,
    "drag": 0.014,
    "mass": 1.8,
    "pitch": 1.2,
    "roll": 1.8,
    "yaw": 0.9,
    "stability": 0.45,
    "stallFrac": 0.45,
    "rotateFrac": 0.35
  },
  {
    "id": "cub",
    "name": "Piper Cub",
    "group": "General aviation",
    "role": "Yellow bush plane",
    "number": "TF-G14",
    "blurb": "Yellow bush plane. Open the door, drop flaps, and cruise low.",
    "body": "#fefae0",
    "accent": "#bc6c25",
    "metal": 0.3,
    "checker": false,
    "length": 6.8,
    "radius": 0.55,
    "profile": "light",
    "wing": {
      "y": 0.22000000000000003,
      "z": -0.3,
      "span": 10.7,
      "root": 1.712,
      "tip": 0.535,
      "sweep": 0.5,
      "dihedral": 0.03
    },
    "tail": {
      "type": "low"
    },
    "engines": [
      {
        "kind": "prop",
        "x": 0,
        "y": 0,
        "z": 0.2,
        "r": 0.85
      }
    ],
    "gear": {
      "mode": "fixed",
      "style": "tricycle",
      "height": 0.8250000000000001,
      "track": 0.28,
      "fold": "in"
    },
    "openings": "doors",
    "doorCount": 1,
    "flaps": true,
    "spoilers": false,
    "cargo": null,
    "droop": false,
    "struts": true,
    "wingtips": false,
    "cruise": 45,
    "drag": 0.016,
    "mass": 1.5,
    "pitch": 0.7,
    "roll": 0.9,
    "yaw": 0.5,
    "stability": 0.7,
    "stallFrac": 0.4,
    "rotateFrac": 0.35
  },
  {
    "id": "f16",
    "name": "F-16 Fighting Falcon",
    "group": "Warplanes",
    "role": "Viper",
    "number": "TF-F01",
    "blurb": "Viper fighter. The canopy pops open; gear, flaps, and spoilers move.",
    "body": "#4a5560",
    "accent": "#f4a261",
    "metal": 0.55,
    "camo": [
      "#3d4a3a",
      "#2c3330",
      "#5a5e4a"
    ],
    "length": 15,
    "radius": 0.85,
    "profile": "fighter",
    "wing": {
      "y": 0,
      "z": -0.75,
      "span": 9.5,
      "root": 3.3249999999999997,
      "tip": 0.38,
      "sweep": 3.3249999999999997,
      "dihedral": 0.02
    },
    "tail": {
      "type": "low"
    },
    "engines": [
      {
        "kind": "jet",
        "x": 0,
        "y": 0,
        "z": -2.25,
        "r": 0.3825
      }
    ],
    "gear": {
      "mode": "retract",
      "style": "tricycle",
      "height": 1.36,
      "track": 0.22,
      "fold": "in"
    },
    "openings": "canopy",
    "doorCount": 1,
    "flaps": true,
    "spoilers": true,
    "cargo": null,
    "droop": false,
    "struts": false,
    "wingtips": false,
    "cruise": 280,
    "drag": 0.007,
    "mass": 6,
    "pitch": 1.1,
    "roll": 1.5,
    "yaw": 0.6,
    "stability": 0.5,
    "stallFrac": 0.38,
    "rotateFrac": 0.32
  },
  {
    "id": "a10",
    "name": "A-10 Thunderbolt II",
    "group": "Warplanes",
    "role": "Warthog",
    "number": "TF-F14",
    "blurb": "Warthog. Canopy opens; gear, flaps, and spoilers work.",
    "body": "#4a5560",
    "accent": "#f4a261",
    "metal": 0.55,
    "camo": [
      "#3d4a3a",
      "#2c3330",
      "#5a5e4a"
    ],
    "length": 16,
    "radius": 1.1,
    "profile": "fighter",
    "wing": {
      "y": -0.11000000000000001,
      "z": -0.8,
      "span": 17.5,
      "root": 3.85,
      "tip": 0.7000000000000001,
      "sweep": 3.15,
      "dihedral": 0.02
    },
    "tail": {
      "type": "low"
    },
    "engines": [
      {
        "kind": "jet",
        "x": -0.9900000000000001,
        "y": 0.55,
        "z": -4,
        "r": 0.44000000000000006
      },
      {
        "kind": "jet",
        "x": 0.9900000000000001,
        "y": 0.55,
        "z": -4,
        "r": 0.44000000000000006
      }
    ],
    "gear": {
      "mode": "retract",
      "style": "tricycle",
      "height": 1.7600000000000002,
      "track": 0.22,
      "fold": "in"
    },
    "openings": "canopy",
    "doorCount": 1,
    "flaps": true,
    "spoilers": true,
    "cargo": null,
    "droop": false,
    "struts": false,
    "wingtips": false,
    "cruise": 180,
    "drag": 0.007,
    "mass": 8,
    "pitch": 1.1,
    "roll": 1.5,
    "yaw": 0.6,
    "stability": 0.5,
    "stallFrac": 0.38,
    "rotateFrac": 0.32
  },
  {
    "id": "spitfire",
    "name": "Supermarine Spitfire",
    "group": "Warbirds",
    "role": "WWII icon",
    "number": "TF-F17",
    "blurb": "WWII icon. Slide the canopy, drop gear and flaps, then fly.",
    "body": "#c5d5e4",
    "accent": "#bc4749",
    "metal": 0.45,
    "camo": null,
    "length": 9.1,
    "radius": 0.7,
    "profile": "warbird",
    "wing": {
      "y": 0,
      "z": -0.5,
      "span": 11.2,
      "root": 2.464,
      "tip": 0.44799999999999995,
      "sweep": 2.016,
      "dihedral": 0.02
    },
    "tail": {
      "type": "low"
    },
    "engines": [
      {
        "kind": "prop",
        "x": 0,
        "y": 0,
        "z": 0.2,
        "r": 1
      }
    ],
    "gear": {
      "mode": "retract",
      "style": "taildragger",
      "height": 1.12,
      "track": 0.22,
      "fold": "out"
    },
    "openings": "canopy",
    "canopy": "slide",
    "doorCount": 1,
    "flaps": true,
    "spoilers": false,
    "cargo": null,
    "droop": false,
    "struts": false,
    "wingtips": false,
    "decal": "raf",
    "cruise": 140,
    "drag": 0.012,
    "mass": 3,
    "pitch": 0.8,
    "roll": 1,
    "yaw": 0.6,
    "stability": 0.6,
    "stallFrac": 0.38,
    "rotateFrac": 0.32
  },
  {
    "id": "c17",
    "name": "Boeing C-17",
    "group": "Cargo & tankers",
    "role": "Strategic airlifter",
    "number": "TF-C01",
    "blurb": "Giant airlifter. Rear cargo ramp opens, plus doors, gear, and flaps.",
    "body": "#d8e2dc",
    "accent": "#1d3557",
    "metal": 0.5,
    "length": 53,
    "radius": 3.2,
    "profile": "herc",
    "wing": {
      "y": -0.48,
      "z": -2,
      "span": 52,
      "root": 8.32,
      "tip": 2.08,
      "sweep": 4.16,
      "dihedral": 0.05
    },
    "tail": {
      "type": "t"
    },
    "engines": [
      {
        "kind": "jet",
        "x": -9.36,
        "y": -2.08,
        "z": 0.2,
        "r": 1.344,
        "pylon": true
      },
      {
        "kind": "jet",
        "x": 9.36,
        "y": -2.08,
        "z": 0.2,
        "r": 1.344,
        "pylon": true
      },
      {
        "kind": "jet",
        "x": -15.6,
        "y": -1.78,
        "z": -1.3,
        "r": 1.344,
        "pylon": true
      },
      {
        "kind": "jet",
        "x": 15.6,
        "y": -1.78,
        "z": -1.3,
        "r": 1.344,
        "pylon": true
      }
    ],
    "gear": {
      "mode": "retract",
      "style": "tricycle",
      "height": 7.040000000000001,
      "track": 0.12,
      "fold": "in"
    },
    "openings": "doors",
    "doorCount": 2,
    "flaps": true,
    "spoilers": true,
    "cargo": "ramp",
    "droop": false,
    "struts": false,
    "wingtips": false,
    "cruise": 220,
    "drag": 0.0055,
    "mass": 22,
    "pitch": 0.28,
    "roll": 0.35,
    "yaw": 0.18,
    "stability": 0.92
  },
  {
    "id": "concorde",
    "name": "Concorde",
    "group": "Classics",
    "role": "Supersonic airliner",
    "number": "TF-X01",
    "blurb": "Supersonic classic. Droop the nose, open the doors, and raise the gear.",
    "body": "#f4f8fb",
    "accent": "#0a9396",
    "metal": 0.48,
    "length": 62,
    "radius": 1.6,
    "profile": "concorde",
    "wing": {
      "y": -0.48,
      "z": -3.1,
      "span": 25.6,
      "root": 11.520000000000001,
      "tip": 1.024,
      "sweep": 14.080000000000002,
      "dihedral": 0.03
    },
    "tail": {
      "type": "none"
    },
    "engines": [
      {
        "kind": "jet",
        "x": -4.608,
        "y": -0.6400000000000001,
        "z": -2,
        "r": 0.8800000000000001,
        "buried": true
      },
      {
        "kind": "jet",
        "x": 4.608,
        "y": -0.6400000000000001,
        "z": -2,
        "r": 0.8800000000000001,
        "buried": true
      }
    ],
    "gear": {
      "mode": "retract",
      "style": "tricycle",
      "height": 3.04,
      "track": 0.15,
      "fold": "in"
    },
    "openings": "doors",
    "doorCount": 2,
    "flaps": false,
    "spoilers": false,
    "cargo": null,
    "droop": true,
    "struts": false,
    "wingtips": false,
    "cruise": 380,
    "drag": 0.0035,
    "mass": 18,
    "pitch": 0.35,
    "roll": 0.45,
    "yaw": 0.25,
    "stability": 0.85
  }
]
