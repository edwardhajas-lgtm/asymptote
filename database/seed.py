import sqlite3

DB_PATH = "database/asymptote.db"

exercises = [
    ("Bench Press", 4, 8, "chest", "weighted", 1),
    ("Squat", 4, 8, "legs", "weighted", 1),
    ("Deadlift", 3, 6, "back", "weighted", 1),
    ("Overhead Press", 4, 8, "shoulders", "weighted", 1),
    ("Barbell Row", 4, 8, "back", "weighted", 1),
    ("Pull Up", 4, 8, "back", "bodyweight", 0),
    ("Dip", 6, 12, "chest", "bodyweight", 0),
    ("Romanian Deadlift", 6, 10, "legs", "weighted", 0),
    ("Leg Press", 8, 12, "legs", "weighted", 0),
    ("Incline Bench Press", 6, 10, "chest", "weighted", 0),
    ("Cable Row", 8, 12, "back", "weighted", 0),
    ("Lateral Raise", 10, 15, "shoulders", "weighted", 0),
    ("Bicep Curl", 8, 12, "arms", "weighted", 0),
    ("Tricep Pushdown", 8, 12, "arms", "weighted", 0),
    ("Face Pull", 12, 15, "shoulders", "weighted", 0),
    ("Plank", 1, 1, "core", "timed", 0),
    ("Push Up", 10, 20, "chest", "bodyweight", 0),
    ("Power Clean", 3, 5, "full_body", "weighted", 1),
]

def seed():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    for name, rep_min, rep_max, muscle_group, exercise_type, supports_1rm in exercises:
        existing = cursor.execute(
            "SELECT id FROM exercises WHERE name = ?", (name,)
        ).fetchone()

        if not existing:
            cursor.execute(
                """INSERT INTO exercises 
                (name, target_rep_min, target_rep_max, muscle_group, exercise_type, supports_1rm, is_verified)
                VALUES (?, ?, ?, ?, ?, ?, 1)""",
                (name, rep_min, rep_max, muscle_group, exercise_type, supports_1rm)
            )
            print(f"Added: {name}")
        else:
            print(f"Skipped (already exists): {name}")

    conn.commit()
    conn.close()
    print("Seeding complete")

if __name__ == "__main__":
    seed()