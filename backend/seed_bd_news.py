"""
Seed additional Bangladeshi news sources into the database.

Idempotent: existing (category, url) pairs are skipped, so it is safe to run
more than once. These sources also ship in database_schema.sql; this script is
a convenience for topping up an already-initialised database.

Run from anywhere:  python backend/seed_bd_news.py
"""

import sys
from pathlib import Path

# Resolve imports relative to this file so the script runs from any CWD
sys.path.insert(0, str(Path(__file__).resolve().parent))

from database import get_db
from models import Category

# (category_id slug as defined in database_schema.sql, source_url, source_name)
SOURCES = [
    # Technology
    ('technology', 'https://www.thedailystar.net/tech-startup', 'The Daily Star Tech'),
    ('technology', 'https://www.dhakatribune.com/technology', 'Dhaka Tribune Tech'),
    ('technology', 'https://en.prothomalo.com/science-tech', 'Prothom Alo Tech'),
    ('technology', 'https://bdnews24.com/technology', 'BDNews24 Tech'),
    ('technology', 'https://www.tbsnews.net/tech', 'TBS Tech'),
    # World News
    ('world_news', 'https://www.thedailystar.net/world', 'The Daily Star World'),
    ('world_news', 'https://www.dhakatribune.com/world', 'Dhaka Tribune World'),
    ('world_news', 'https://en.prothomalo.com/world', 'Prothom Alo World'),
    ('world_news', 'https://bdnews24.com/world', 'BDNews24 World'),
    ('world_news', 'https://www.newagebd.net/category/world', 'New Age World'),
    # Business
    ('business', 'https://thefinancialexpress.com.bd', 'Financial Express BD'),
    ('business', 'https://www.tbsnews.net/economy', 'TBS Economy'),
    ('business', 'https://www.thedailystar.net/business', 'The Daily Star Business'),
    ('business', 'https://www.dhakatribune.com/business', 'Dhaka Tribune Business'),
    ('business', 'https://en.prothomalo.com/business', 'Prothom Alo Business'),
]


def seed():
    db = get_db()
    inserted = 0
    skipped = 0
    for category_slug, url, name in SOURCES:
        category = Category.get_by_category_id(category_slug)
        if not category:
            print(f"  skip (no category '{category_slug}'): {url}")
            continue

        existing = db.execute_query(
            "SELECT id FROM news_sources WHERE category_id = %s AND source_url = %s",
            (category['id'], url),
        )
        if existing:
            skipped += 1
            continue

        db.execute_update(
            """
            INSERT INTO news_sources
            (category_id, source_url, source_name, source_type, reliability_score)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (category['id'], url, name, 'web', 0.8),
        )
        inserted += 1

    print(f"Seed complete: {inserted} inserted, {skipped} already present.")


if __name__ == "__main__":
    seed()
