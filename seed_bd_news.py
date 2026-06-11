import sys
from pathlib import Path

# Add backend directory to sys.path
sys.path.append(str(Path("backend").resolve()))

from database import get_db

def seed():
    db = get_db()
    
    sources = [
        # Technology
        ('technology', 'https://www.thedailystar.net/tech-startup', 'The Daily Star Tech', 'web', 0.8),
        ('technology', 'https://www.dhakatribune.com/technology', 'Dhaka Tribune Tech', 'web', 0.8),
        ('technology', 'https://en.prothomalo.com/science-tech', 'Prothom Alo Tech', 'web', 0.8),
        ('technology', 'https://bdnews24.com/technology', 'BDNews24 Tech', 'web', 0.8),
        ('technology', 'https://www.tbsnews.net/tech', 'TBS Tech', 'web', 0.8),
        
        # World News (general)
        ('general', 'https://www.thedailystar.net/world', 'The Daily Star World', 'web', 0.8),
        ('general', 'https://www.dhakatribune.com/world', 'Dhaka Tribune World', 'web', 0.8),
        ('general', 'https://en.prothomalo.com/world', 'Prothom Alo World', 'web', 0.8),
        ('general', 'https://bdnews24.com/world', 'BDNews24 World', 'web', 0.8),
        ('general', 'https://www.newagebd.net/category/world', 'New Age World', 'web', 0.8),
        
        # Business
        ('business', 'https://thefinancialexpress.com.bd', 'Financial Express BD', 'web', 0.8),
        ('business', 'https://www.tbsnews.net/economy', 'TBS Economy', 'web', 0.8),
        ('business', 'https://www.thedailystar.net/business', 'The Daily Star Business', 'web', 0.8),
        ('business', 'https://www.dhakatribune.com/business', 'Dhaka Tribune Business', 'web', 0.8),
        ('business', 'https://en.prothomalo.com/business', 'Prothom Alo Business', 'web', 0.8),
    ]

    try:
        db.execute_many(
            '''
            INSERT IGNORE INTO news_sources 
            (category_id, source_url, source_name, source_type, reliability_score)
            VALUES (%s, %s, %s, %s, %s)
            ''',
            sources
        )
        print("Successfully inserted sources.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    seed()
