#!/usr/bin/env python3
"""Download Kaggle TMDB v1076 and emit a D1-compatible SQL import.

The generated catalog intentionally keeps only fields needed by Realhouse
movie discovery/search. This keeps the production database compact while
preserving the source dataset's movie identifiers, ratings, genres and posters.
"""
from __future__ import annotations

import csv
import hashlib
import os
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

DATASET = "asaniczka/tmdb-movies-dataset-2023-930k-movies/versions/1076"
ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / ".cache" / "kaggle-tmdb-v1076"
OUT = ROOT / "workers" / "catalog" / "catalog.sql"
BATCH = 50

def sql_text(value):
    if value is None or str(value).strip() == "":
        return "NULL"
    return "'" + str(value).replace("'", "''").replace("\\x00", "") + "'"

def sql_int(value):
    try:
        return str(int(float(str(value).strip())))
    except Exception:
        return "NULL"

def sql_real(value):
    try:
        x=float(str(value).strip())
        return "NULL" if x != x else repr(x)
    except Exception:
        return "NULL"

def download():
    WORK.mkdir(parents=True, exist_ok=True)
    import kagglehub
    path = kagglehub.dataset_download(DATASET, output_dir=str(WORK / "download"))
    return Path(path)

def find_csv(root):
    candidates=list(root.rglob("*.csv"))
    if not candidates:
        raise RuntimeError("Kaggle download contains no CSV file")
    candidates.sort(key=lambda p: (("TMDB_movie_dataset" not in p.name and "TMDB_all_movies" not in p.name), -p.stat().st_size))
    return candidates[0]

def main():
    if shutil.which("unzip") is None:
        print("unzip is not required; kagglehub handles extraction.", file=sys.stderr)
    csv_path=find_csv(download())
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp=OUT.with_suffix(".tmp.sql")
    rows=0
    with csv_path.open("r",encoding="utf-8-sig",newline="",errors="replace") as src, tmp.open("w",encoding="utf-8",newline="") as dst:
        dst.write("PRAGMA foreign_keys=OFF;\n")
        dst.write("DROP TABLE IF EXISTS movies;\n")
        dst.write("""CREATE TABLE movies (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  original_title TEXT,
  release_date TEXT,
  vote_average REAL,
  vote_count INTEGER,
  popularity REAL,
  genres TEXT,
  poster_path TEXT,
  imdb_id TEXT,
  original_language TEXT
);
""")
        dst.write("BEGIN TRANSACTION;\n")
        reader=csv.DictReader(src)
        for raw in reader:
            row={str(k).strip().lstrip("\ufeff"):v for k,v in raw.items()}
            movie_id=sql_int(row.get("id"))
            if movie_id=="NULL":
                continue
            title=(row.get("title") or "").strip()
            if not title:
                continue
            vals=[
                movie_id,sql_text(title),sql_text(row.get("original_title")),
                sql_text(row.get("release_date")),sql_real(row.get("vote_average")),
                sql_int(row.get("vote_count")),sql_real(row.get("popularity")),
                sql_text(row.get("genres")),sql_text(row.get("poster_path")),
                sql_text(row.get("imdb_id")),sql_text(row.get("original_language"))
            ]
            if rows % BATCH == 0:
                dst.write("INSERT INTO movies (id,title,original_title,release_date,vote_average,vote_count,popularity,genres,poster_path,imdb_id,original_language) VALUES\n")
            else:
                dst.write(",\n")
            dst.write("(" + ",".join(vals) + ")")
            if rows % BATCH == BATCH-1:
                dst.write(";\n")
            rows += 1
            if rows % 100000 == 0:
                print(f"exported {rows:,} rows", flush=True)
        if rows % BATCH:
            dst.write(";\n")
        dst.write("COMMIT;\n")
        dst.write("CREATE INDEX idx_movies_title ON movies(title);\n")
        dst.write("CREATE INDEX idx_movies_original_title ON movies(original_title);\n")
        dst.write("CREATE INDEX idx_movies_release_date ON movies(release_date);\n")
        dst.write("CREATE INDEX idx_movies_vote_average ON movies(vote_average);\n")
        dst.write("CREATE INDEX idx_movies_vote_count ON movies(vote_count);\n")
        dst.write("CREATE INDEX idx_movies_popularity ON movies(popularity);\n")
        dst.write("CREATE INDEX idx_movies_imdb_id ON movies(imdb_id);\n")
        dst.write("CREATE INDEX idx_movies_original_language ON movies(original_language);\n")
    tmp.replace(OUT)
    size=OUT.stat().st_size
    print(f"generated {OUT} with {rows:,} rows ({size/1024/1024:.1f} MiB)")
    if size > 5*1024*1024*1024:
        raise RuntimeError("Generated SQL exceeds Cloudflare D1's 5 GiB import limit")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
