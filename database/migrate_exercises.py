import sqlite3

DB_PATH = "database/asymptote.db"

updates = [
    ("Bench Press", "weighted", 1),
    ("Squat", "weighted", 1),
    ("Deadlift", "weighted", 1),
    ("Overhead Press", "weighted", 1),
    ("Barbell Row", "weighted", 1),
    ("Pull Up", "bodyweight", 0),
    ("Dip", "bodyweight", 0),
    ("Romanian Deadlift", "weighted", 0),
    ("Leg Press", "weighted", 0),
    ("Incline Bench Press", "weighted", 0),
    ("Cable Row", "weighted", 0),
    ("Lateral Raise", "weighted", 0),
    ("Bicep Curl", "weighted", 0),
    ("Tricep Pushdown", "weighted", 0),
    ("Face Pull", "weighted", 0),
]

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    for name, exercise_type, supports_1rm in updates:
        cursor.execute(
            """UPDATE exercises 
            SET exercise_type = ?, supports_1rm = ?
            WHERE name = ?""",
            (exercise_type, supports_1rm, name)
        )
        print(f"Updated: {name}")

    conn.commit()
    conn.close()
    print("Migration complete")

if __name__ == "__main__":
    migrate()