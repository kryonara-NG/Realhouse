# Realhouse TMDB catalog

Realhouse can use the public Kaggle TMDB Movies Dataset as a local indexed catalog while keeping the large source file out of the frontend bundle and Git history.

## Source

Kaggle dataset: `asaniczka/tmdb-movies-dataset-2023-930k-movies`

The importer is pinned to dataset version `1076`.

## Local import

Install the importer dependency:

```bash
python -m pip install -r scripts/requirements-kaggle.txt
```

Then:

```bash
npm run catalog:kaggle
```

This downloads the selected Kaggle version through KaggleHub, finds the TMDB CSV, and creates:

```
data/tmdb_catalog.sqlite3
```

The SQLite database is intentionally ignored from the web bundle/Git repository. It is designed to be mounted separately for the backend.

## API

When `TMDB_CATALOG_DB` points at the generated database:

- `GET /api/catalog/health`
- `GET /api/catalog/search?q=inception`
- `GET /api/catalog/discover?sort=popularity&page=1`
- `GET /api/catalog/discover?genre=Action`
- `GET /api/catalog/discover?year=2024`
- `GET /api/catalog/discover?min_rating=8`

The frontend uses the local catalog first for movie discovery/search and falls back to live TMDB when the catalog is unavailable.

## Production storage

Do not commit the 500MB+ source CSV or generated SQLite database to GitHub/Vercel. A production deployment should mount the generated database from durable storage or migrate the normalized rows into a queryable database such as D1/Postgres.

The dataset can then become the basis of a future public Realhouse catalog API without coupling the frontend directly to Kaggle.
