#!/usr/bin/env node
/**
 * Download FlightGear (FGMEMBERS) landing-gear meshes, convert AC3D → GLB,
 * and write family kits under models/gear/<kitId>/.
 *
 * Requires: curl (via fetch), assimp, python3, node.
 */
import { spawnSync } from "child_process"
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
  rmSync,
} from "fs"
import { dirname, join, basename } from "path"
import { fileURLToPath } from "url"
import { pipeline } from "stream/promises"
import { Readable } from "stream"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const RAW = join(ROOT, "models/gear/_raw")
const OUT = join(ROOT, "models/gear")
const EXTRACT = join(__dirname, "extract-ac-gear.py")

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: "utf8", ...opts })
  if (res.status !== 0) {
    const err = (res.stderr || res.stdout || "").trim()
    throw new Error(`${cmd} ${args.join(" ")} failed: ${err.slice(0, 500)}`)
  }
  return res
}

async function download(url, dest, { force = false } = {}) {
  mkdirSync(dirname(dest), { recursive: true })
  if (!force && existsSync(dest) && readFileSync(dest).byteLength > 64) return dest
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
  return dest
}

function rawUrl(repo, path, branch = "master") {
  return `https://raw.githubusercontent.com/${repo}/${branch}/${path}`
}

function convertAc(acPath, glbPath) {
  mkdirSync(dirname(glbPath), { recursive: true })
  if (existsSync(glbPath)) rmSync(glbPath)
  run("assimp", ["export", acPath, glbPath])
  if (!existsSync(glbPath)) throw new Error(`assimp did not write ${glbPath}`)
}

function extractGear(srcAc, dstAc) {
  const res = run("python3", [EXTRACT, srcAc, dstAc, "--list-textures"])
  return (res.stdout || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
}

async function fetchTextures(repo, baseDir, textures, destDir, branch = "master") {
  for (const tex of textures) {
    const name = basename(tex)
    if (existsSync(join(destDir, name)) && readFileSync(join(destDir, name)).byteLength > 16) continue
    const candidates = [
      `${baseDir}/${tex}`,
      `${baseDir}/${name}`,
      `Models/${name}`,
      `Models/Textures/${name}`,
      `Models/LandingGears/${name}`,
      `Models/LandingGears/res/${name}`,
    ]
    let ok = false
    for (const path of candidates) {
      try {
        await download(rawUrl(repo, path, branch), join(destDir, name))
        ok = true
        break
      } catch {
        /* try next */
      }
    }
    if (!ok) console.warn(`  missing texture ${tex}`)
  }
}

/**
 * Build a kit directory: models/gear/<kitId>/{parts}.glb + kit.json
 * parts: [{repo, path, label, extract?, textures?, branch?}]
 */
async function kitFromParts(kitId, parts) {
  const work = join(RAW, kitId)
  const kitDir = join(OUT, kitId)
  mkdirSync(work, { recursive: true })
  mkdirSync(kitDir, { recursive: true })

  const written = []

  for (const part of parts) {
    const label = part.label || basename(part.path, ".ac")
    const acLocal = join(work, `${label}.ac`)
    await download(rawUrl(part.repo, part.path, part.branch), acLocal)

    let convertSrc = acLocal
    if (part.extract) {
      const extracted = join(work, `${label}.gear.ac`)
      const textures = extractGear(acLocal, extracted)
      convertSrc = extracted
      await fetchTextures(part.repo, dirname(part.path), textures, work, part.branch)
      await fetchTextures(part.repo, "Models", textures, work, part.branch)
    }
    if (part.textures) {
      for (const t of part.textures) {
        const path = typeof t === "string" ? t : t.path
        await download(rawUrl(part.repo, path, part.branch), join(work, basename(path)))
      }
    }

    const glbName = `${label}.glb`
    const glbWork = join(work, glbName)
    const glbOut = join(kitDir, glbName)
    try {
      convertAc(convertSrc, glbWork)
      copyFileSync(glbWork, glbOut)
      written.push(glbName)
      console.log(`  + ${glbName} (${(readFileSync(glbOut).byteLength / 1024).toFixed(1)} KB)`)
    } catch (err) {
      console.warn(`  skip ${label}: ${err.message}`)
    }
  }

  // Ship textures next to GLBs so the runtime loader can resolve relative URIs.
  for (const name of readdirSync(work)) {
    if (!/\.(png|jpg|jpeg|webp)$/i.test(name)) continue
    const src = join(work, name)
    const dst = join(kitDir, name)
    try {
      copyFileSync(src, dst)
      console.log(`  + ${name} (texture)`)
    } catch (err) {
      console.warn(`  skip texture ${name}: ${err.message}`)
    }
  }

  if (!written.length) throw new Error(`No GLBs for kit ${kitId}`)
  writeFileSync(
    join(kitDir, "kit.json"),
    JSON.stringify({ id: kitId, parts: written }, null, 2) + "\n"
  )
  console.log(`  kit → models/gear/${kitId}/ (${written.length} parts)`)
}

async function kitFromSingleExtract(kitId, repo, path, texturesExtra = [], branch = "master") {
  await kitFromParts(kitId, [
    {
      repo,
      path,
      label: "gear",
      extract: true,
      branch,
      textures: texturesExtra,
    },
  ])
}

const KITS = {
  async a320() {
    const repo = "FGMEMBERS/A320-family"
    const base = "Models/LandingGears"
    const tex = [`${base}/NWA.png`, `${base}/mainwheel.png`]
    await kitFromParts("a320", [
      { repo, path: `${base}/a320.nlg.ac`, label: "nlg", textures: tex },
      { repo, path: `${base}/a320.nlg.tires.ac`, label: "nlg_tires", textures: tex },
      { repo, path: `${base}/a320.mlg.left.ac`, label: "mlg_left", textures: tex },
      { repo, path: `${base}/a320.mlg.right.ac`, label: "mlg_right", textures: tex },
      { repo, path: `${base}/a320.mlg.tires.ac`, label: "mlg_tires", textures: tex },
    ])
  },
  async b747() {
    const repo = "FGMEMBERS/747-400"
    await kitFromParts("b747", [
      {
        repo,
        path: "Models/747-400_gear.ac",
        label: "gear",
        textures: [
          "Models/747-400_gear.png",
          "Models/747-400_tire1.png",
          "Models/747-400_tire3.png",
        ],
      },
    ])
  },
  async b737() {
    const n737 = "FGMEMBERS/737-800"
    const a320 = "FGMEMBERS/A320-family"
    const base = "Models/LandingGears"
    const tex = [`${base}/NWA.png`, `${base}/mainwheel.png`]
    await kitFromParts("b737", [
      { repo: n737, path: "Models/nosegear.ac", label: "nlg", textures: ["Models/737-800.png"] },
      { repo: a320, path: `${base}/a320.mlg.left.ac`, label: "mlg_left", textures: tex },
      { repo: a320, path: `${base}/a320.mlg.right.ac`, label: "mlg_right", textures: tex },
      { repo: a320, path: `${base}/a320.mlg.tires.ac`, label: "mlg_tires", textures: tex },
    ])
  },
  async crj() {
    const repo = "FGMEMBERS/CRJ700-family"
    await kitFromParts("crj", [
      {
        repo,
        path: "Models/CRJ700-nosegear.ac",
        label: "nlg",
        textures: ["Models/nosegear.png", "Models/maingear.png"],
      },
      {
        repo,
        path: "Models/CRJ700-maingear.ac",
        label: "mlg",
        textures: ["Models/nosegear.png", "Models/maingear.png"],
      },
    ])
  },
  async b777() {
    await kitFromSingleExtract("b777", "FGMEMBERS/777", "Models/777-200ER.ac")
  },
  async a330() {
    await kitFromSingleExtract("a330", "FGMEMBERS/A330-200", "Models/a330-200-main.ac", [
      "Models/landing-gears.png",
    ])
  },
  async b757() {
    await kitFromSingleExtract("b757", "FGMEMBERS/757", "Models/757-200.ac")
  },
  async b787() {
    await kitFromSingleExtract("b787", "FGMEMBERS/787", "Models/787-8.ac")
  },
  async a340() {
    await kitFromSingleExtract("a340", "FGMEMBERS/A340-600", "Models/A340.ac", ["Models/gear.png"])
  },
  async beluga() {
    await kitFromSingleExtract("beluga", "FGMEMBERS/A300-600ST", "Models/A300-600ST.ac")
  },
  async citation() {
    await kitFromSingleExtract("citation", "FGMEMBERS/Citation", "Models/Citation-II.ac")
  },
  async atr42() {
    await kitFromSingleExtract("atr42", "FGMEMBERS/ATR-42-500", "Models/ATR_42-500.ac")
  },
  async q400() {
    await kitFromSingleExtract("q400", "FGMEMBERS/Dash8Q200", "Models/8q200.ac")
  },
  async ejet() {
    await kitFromSingleExtract("ejet", "FGMEMBERS/Embraer-195", "Models/Embraer_195.ac")
  },
  async heli() {
    await kitFromSingleExtract("heli", "FGMEMBERS/ec135", "Models/ec135.ac")
  },
  async light() {
    await kitFromSingleExtract("light", "FGMEMBERS/c172p", "Models/c172p.ac")
  },
  async ask21() {
    await kitFromSingleExtract("ask21", "FGMEMBERS/ASK21", "Models/ask21.ac")
  },
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  mkdirSync(RAW, { recursive: true })
  // Remove stale single-file kits from earlier attempts.
  for (const f of readdirSync(OUT)) {
    if (f.endsWith(".glb")) rmSync(join(OUT, f))
  }
  const only = process.argv.slice(2)
  const ids = only.length ? only : Object.keys(KITS)
  for (const id of ids) {
    if (!KITS[id]) {
      console.warn(`Unknown kit ${id}`)
      continue
    }
    console.log(`\n=== Building kit ${id} ===`)
    try {
      await KITS[id]()
    } catch (err) {
      console.error(`FAILED ${id}:`, err.message)
    }
  }
  console.log("\nDone. Kits:")
  for (const id of readdirSync(OUT)) {
    const dir = join(OUT, id)
    if (!existsSync(join(dir, "kit.json"))) continue
    const kit = JSON.parse(readFileSync(join(dir, "kit.json"), "utf8"))
    console.log(`  ${id}: ${kit.parts.join(", ")}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
