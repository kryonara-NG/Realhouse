# Realhouse catalog importer

This folder bridges the separate Python Scrapper project and Realhouse.

## Run Scrapper

Keep the repositories beside each other:

    projects/
      Realhouse/
      Scrapper/

Inside `Scrapper/`:

    python -m pip install -r requirements.txt
    python main.py both

This creates `films.txt` and/or `series.txt`.

## Import into Realhouse

From the Realhouse root:

    python scripts/import_scrapper.py

Or provide explicit paths:

    python scripts/import_scrapper.py --films /path/to/Scrapper/films.txt --series /path/to/Scrapper/series.txt

The generated catalog is `public/data/scrapper-catalog.json` and is available to the frontend as `/data/scrapper-catalog.json`.

This bridge imports catalog/page-link metadata only. It does not extract, download, proxy, or re-host third-party video streams.
