import sqlite3
import os

def init_db():
    db_path = "database/asymptote.db"
    schema_path = "database/schema.sql"
    
    with open(schema_path, "r") as f:
        schema = f.read()
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.executescript(schema)
    conn.commit()
    conn.close()
    
    print("Database initialized successfully")

if __name__ == "__main__":
    init_db()