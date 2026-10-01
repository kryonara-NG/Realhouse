#!/usr/bin/env python3
"""Import catalog output produced by Aditya-0011/Scrapper into Realhouse.

Usage:
  python scripts/import_scrapper.py --films ../Scrapper/films.txt --series ../Scrapper/series.txt

This consumes catalog/page-link output only; it does not extract or download video streams.
"""
from __future__ import annotations
import argparse, json
from pathlib import Path
from datetime import datetime, timezone

def parse_file(path: Path, kind: str) -> list[dict]:
    if not path.exists():
        return []
    rows, current = [], {}
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line:
            if current.get("title"):
                current["kind"] = kind; rows.append(current); current = {}
            continue
        if ":" not in line:
            continue
        label, value = line.split(":", 1)
        label, value = label.strip().lower(), value.strip()
        if label == "title":
            if current.get("title"):
                current["kind"] = kind; rows.append(current); current = {}
            current["title"] = value
        elif label.startswith("tinyzonetv link"):
            current["tinyzoneUrl"] = value
        elif label.startswith("hdtoday link"):
            current["hdtodayUrl"] = value
    if current.get("title"):
        current["kind"] = kind; rows.append(current)
    return rows

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--films", default="../Scrapper/films.txt")
    parser.add_argument("--series", default="../Scrapper/series.txt")
    parser.add_argument("--output", default="public/data/scrapper-catalog.json")
    args = parser.parse_args()
    catalog = {
        "source": "Aditya-0011/Scrapper",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "movies": parse_file(Path(args.films), "movie"),
        "series": parse_file(Path(args.series), "series"),
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Imported {len(catalog['movies'])} movies and {len(catalog['series'])} series -> {output}")

if __name__ == "__main__":
    main()
