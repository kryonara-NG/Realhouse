#!/usr/bin/env python3
"""Download Kaggle TMDB dataset v1076 and build an indexed SQLite catalog.

This keeps the 1M+ row source dataset out of the web bundle/Git history.
The resulting SQLite database can be mounted separately and exposed through
Realhouse's /api/catalog/* endpoints.

Usage:
  python scripts/import_kaggle_tmdb.py
  python scripts/import_kaggle_tmdb.py --output data/tmdb_catalog.sqlite3
"""
from __future__ import annotations

import argparse
import csv
import sqlite3
from pathlib import Path

import kagglehub

DATASET = "asaniczka/tmdb-movies-dataset-2023-930k-movies/versions/1076"

def find_csv(root: Path) -> Path:
    files = list(root.rglob("*.csv"))
    if not files:
        raise FileNotFoundError(f"No CSV file found in {root}")
    preferred = [p for p in files if "TMDB_movie_dataset" in p.name or "TMDB_all_movies" in p.name]
    return preferred[0] if preferred else max(files, key=lambda p: p.stat().st_size)

def pick(row: dict, *names: str) -> str:
    for name in names:
        value = row.get(name)
        if value is not None:
            return str(value).strip()
    return ""

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="data/tmdb_catalog.sqlite3")
    parser.add_argument("--download-dir", default=".cache/kaggle-tmdb-v1076")
    args = parser.parse_args()

    download_dir = Path(args.download_dir)
    download_dir.mkdir(parents=True, exist_ok=True)
    print(f"Downloading Kaggle dataset: {DATASET}")
    downloaded = Path(kagglehub.dataset_download(DATASET, output_dir=str(download_dir)))
    csv_path = find_csv(downloaded)
    print(f"Using source CSV: {csv_path}")

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        output.unlink()

    conn = sqlite3.connect(output)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA temp_store=MEMORY")
    conn.execute("""
        CREATE TABLE movies (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            original_title TEXT,
            overview TEXT,
            release_date TEXT,
            vote_average REAL DEFAULT 0,
            vote_count INTEGER DEFAULT 0,
            popularity REAL DEFAULT 0,
            genres TEXT,
            poster_path TEXT,
            imdb_id TEXT,
            original_language TEXT
        )
    """)

    insert_sql = """
        INSERT OR REPLACE INTO movies
        (id,title,original_title,overview,release_date,vote_average,vote_count,
         popularity,genres,poster_path,imdb_id,original_language)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    """

    batch = []
    total = 0
    with csv_path.open("r", encoding="utf-8-sig", errors="replace", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            raw_id = pick(row, "id")
            title = pick(row, "title", "original_title")
            if not raw_id.isdigit() or not title:
                continue
            try:
                movie_id = int(raw_id)
            except ValueError:
                continue
            try:
                rating = float(pick(row, "vote_average") or 0)
            except ValueError:
                rating = 0
            try:
                votes = int(float(pick(row, "vote_count") or 0))
            except ValueError:
                votes = 0
            try:
                popularity = float(pick(row, "popularity") or 0)
            except ValueError:
                popularity = 0
            batch.append((
                movie_id, title, pick(row, "original_title"), pick(row, "overview"),
                pick(row, "release_date"), rating, votes, popularity,
                pick(row, "genres"), pick(row, "poster_path"), pick(row, "imdb_id"),
                pick(row, "original_language"),
            ))
            if len(batch) >= 5000:
                conn.executemany(insert_sql, batch)
                conn.commit()
                total += len(batch)
                batch.clear()
                if total % 100000 == 0:
                    print(f"Imported {total:,} rows...")
    if batch:
        conn.executemany(insert_sql, batch)
        total += len(batch)

    conn.executescript("""
        CREATE INDEX idx_movies_title ON movies(title COLLATE NOCASE);
        CREATE INDEX idx_movies_original_title ON movies(original_title COLLATE NOCASE);
        CREATE INDEX idx_movies_release_date ON movies(release_date);
        CREATE INDEX idx_movies_rating ON movies(vote_average DESC);
        CREATE INDEX idx_movies_votes ON movies(vote_count DESC);
        CREATE INDEX idx_movies_popularity ON movies(popularity DESC);
        CREATE INDEX idx_movies_imdb ON movies(imdb_id);
        CREATE INDEX idx_movies_language ON movies(original_language);
    """)
    conn.commit()
    conn.execute("VACUUM")
    conn.close()
    print(f"Imported {total:,} movies -> {output}")

if __name__ == "__main__":
    main()
