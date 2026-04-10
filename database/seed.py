import sqlite3

DB_PATH = "database/asymptote.db"

exercises = [
    ("Bench Press", 4, 8, "chest"),
    ("Squat", 4, 8, "legs"),
    ("Deadlift", 3, 6, "back"),
    ("Overhead Press", 4, 8, "shoulders"),
    ("Barbell Row", 4, 8, "back"),
    ("Pull Up", 4, 8, "back"),
    ("Dip", 6, 12, "chest"),
    ("Romanian Deadlift", 6, 10, "legs"),
    ("Leg Press", 8, 12, "legs"),
    ("Incline Bench Press", 6, 10, "chest"),
    ("Cable Row", 8, 12, "back"),
    ("Lateral Raise", 10, 15, "shoulders"),
    ("Bicep Curl", 8, 12, "arms"),
    ("Tricep Pushdown", 8, 12, "arms"),
    ("Face Pull", 12, 15, "shoulders"),
]

def seed():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    for name, rep_min, rep_max, muscle_group in exercises:
        existing = cursor.execute(
            "SELECT id FROM exercises WHERE name = ?", (name,)
        ).fetchone()

        if not existing:
            cursor.execute(
                """INSERT INTO exercises 
                (name, target_rep_min, target_rep_max, muscle_group, is_verified)
                VALUES (?, ?, ?, ?, 1)""",
                (name, rep_min, rep_max, muscle_group)
            )
            print(f"Added: {name}")
        else:
            print(f"Skipped (already exists): {name}")

    conn.commit()
    conn.close()
    print("Seeding complete")

if __name__ == "__main__":
    seed()