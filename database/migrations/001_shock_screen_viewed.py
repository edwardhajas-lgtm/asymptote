import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "asymptote.db")

conn = sqlite3.connect(DB_PATH)
try:
    conn.execute("ALTER TABLE sessions ADD COLUMN shock_screen_viewed BOOLEAN DEFAULT 0")
    conn.commit()
    print("Migration 001: added shock_screen_viewed to sessions")
except Exception as e:
    print(f"Migration 001 skipped or failed: {e}")
finally:
    conn.close()
