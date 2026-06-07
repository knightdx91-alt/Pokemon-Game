"""
Extract wild encounter tables from pokefirered and pokeemerald into JSON.
Usage: python3 tools/extract_encounters.py
Output: data/encounters/kanto.json, data/encounters/hoenn.json
"""

import json
import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = os.path.join(REPO_ROOT, "source")
OUT_DIR = os.path.join(REPO_ROOT, "data", "encounters")


def find_encounter_file(repo_name):
    candidates = [
        os.path.join(SOURCE_DIR, repo_name, "src", "data", "wild_encounters.json"),
        os.path.join(SOURCE_DIR, repo_name, "src", "data", "wild_encounter.json"),
    ]
    for path in candidates:
        if os.path.isfile(path):
            return path

    # Fall back: search for it
    for root, dirs, files in os.walk(os.path.join(SOURCE_DIR, repo_name, "src")):
        for f in files:
            if "wild_encounter" in f and f.endswith(".json"):
                return os.path.join(root, f)
    return None


def extract_encounters(repo_name, region):
    path = find_encounter_file(repo_name)
    if not path:
        print(f"[{repo_name}] No wild encounter JSON found.", file=sys.stderr)
        return

    with open(path) as f:
        raw = json.load(f)

    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f"{region}.json")
    with open(out_path, "w") as f:
        json.dump(raw, f, indent=2)

    map_count = len(raw.get("wild_encounter_groups", [{}])[0].get("encounters", []))
    print(f"[{repo_name}] Extracted encounters for {map_count} maps → data/encounters/{region}.json")


if __name__ == "__main__":
    extract_encounters("pokefirered", "kanto")
    extract_encounters("pokeemerald", "hoenn")
