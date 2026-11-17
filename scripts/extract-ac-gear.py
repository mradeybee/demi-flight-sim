#!/usr/bin/env python3
"""Extract landing-gear objects from an AC3D airframe into a gear-only .ac."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

GEAR_RE = re.compile(
    r"gear|wheel|tire|tyre|strut|oleo|bogie|undercarriage|\bmlg\b|\bnlg\b|"
    r"skid|axle|torque|rim|collar|steercyl|\blink\b|scissor|trunnion|"
    r"damper|piston|fitting|uplock|geardoor|wheelwell|mgear|ngear|"
    r"main.?gr|nose.?gr|frtgear|lgear|rgear|wlg|blg",
    re.I,
)
BLOCK_RE = re.compile(
    r"landing.?light|navlight|strobe|gear.?ctl|gear.?lever|gearcontrols|"
    r"gearwarn|flap.?gear|gearpanel|panel.?gear|gear_pnl|too.?low.?gear|"
    r"trimwheel|aileron\.trim|elevator\.trim",
    re.I,
)


def parse_objects(text: str):
    lines = text.splitlines(True)
    header = []
    i = 0
    while i < len(lines):
        if lines[i].startswith("OBJECT "):
            break
        header.append(lines[i])
        i += 1

    def read_object(idx: int):
        if idx >= len(lines) or not lines[idx].startswith("OBJECT "):
            return None, idx
        obj_lines = [lines[idx]]
        idx += 1
        name = ""
        kids = 0
        while idx < len(lines):
            line = lines[idx]
            if line.startswith("OBJECT "):
                break
            obj_lines.append(line)
            m = re.match(r'name\s+"(.*)"', line)
            if m:
                name = m.group(1)
            m = re.match(r"kids\s+(\d+)", line)
            if m:
                kids = int(m.group(1))
                idx += 1
                break
            idx += 1
        children = []
        for _ in range(kids):
            child, idx = read_object(idx)
            if child:
                children.append(child)
        return {"lines": obj_lines, "name": name, "children": children}, idx

    roots = []
    while i < len(lines):
        if lines[i].startswith("OBJECT "):
            obj, i = read_object(i)
            if obj:
                roots.append(obj)
        else:
            i += 1
    return header, roots


def wants(name: str) -> bool:
    if not name:
        return False
    if BLOCK_RE.search(name):
        return False
    return bool(GEAR_RE.search(name))


def filter_tree(obj, force: bool = False):
    keep_self = force or wants(obj["name"])
    kept_children = []
    for ch in obj["children"]:
        filtered = filter_tree(ch, force=keep_self)
        if filtered:
            kept_children.append(filtered)
    if keep_self or kept_children:
        return {"lines": obj["lines"], "name": obj["name"], "children": kept_children}
    return None


def write_obj(obj):
    out = []
    kids = len(obj["children"])
    for line in obj["lines"]:
        if line.startswith("kids "):
            out.append(f"kids {kids}\n")
        else:
            out.append(line)
    for ch in obj["children"]:
        out.extend(write_obj(ch))
    return out


def collect_textures(obj, found: set[str]):
    for line in obj["lines"]:
        m = re.match(r'texture\s+"(.*)"', line)
        if m:
            found.add(m.group(1))
    for ch in obj["children"]:
        collect_textures(ch, found)


def extract(src: Path, dst: Path) -> list[str]:
    text = src.read_text(errors="ignore")
    if not text.startswith("AC3D"):
        raise SystemExit(f"Not an AC3D file: {src}")
    header, roots = parse_objects(text)
    filtered = [f for r in roots if (f := filter_tree(r))]
    if not filtered:
        raise SystemExit(f"No gear objects found in {src}")

    textures: set[str] = set()
    for obj in filtered:
        collect_textures(obj, textures)

    body = []
    # Prefer a single world wrapper so assimp gets a valid hierarchy.
    if len(filtered) == 1 and filtered[0]["lines"][0].startswith("OBJECT world"):
        body = write_obj(filtered[0])
    else:
        body = [f"OBJECT world\nkids {len(filtered)}\n"]
        for obj in filtered:
            body.extend(write_obj(obj))

    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text("".join(header) + "".join(body))
    return sorted(textures)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--list-textures", action="store_true")
    args = ap.parse_args()
    textures = extract(Path(args.src), Path(args.dst))
    if args.list_textures:
        for t in textures:
            print(t)
    print(f"Wrote {args.dst} ({len(textures)} textures referenced)", file=sys.stderr)


if __name__ == "__main__":
    main()
