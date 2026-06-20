import sqlite3

DB_PATH = "database/asymptote.db"

exercises = [
    ("Bench Press", "chest"),
    ("Squat", "legs"),
    ("Deadlift", "back"),
    ("Overhead Press", "shoulders"),
    ("Barbell Row", "back"),
    ("Pull Up", "back"),
]

def seed():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    for name, muscle_group in exercises:
        existing = cursor.execute(
            "SELECT id FROM exercises WHERE name = ?", (name,)
        ).fetchone()

        if not existing:
            cursor.execute(
                """INSERT INTO exercises 
                (name, muscle_group, exercise_type, supports_1rm, is_verified)
                VALUES (?, ?, ?, ?, ?)""",
                (name, muscle_group, "weighted", 0, 1)
            )
            print(f"Added: {name}")
        else:
            print(f"Skipped (already exists): {name}")

    conn.commit()
    conn.close()
    print("Seeding complete")

if __name__ == "__main__":
    seed()