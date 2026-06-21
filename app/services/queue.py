def generate_queue(db, user_id):
    db.execute(
        "DELETE FROM planned_sets WHERE user_id = ? AND completed = 0",
        (user_id,)
    )

    preferences = db.execute(
        """SELECT * FROM user_exercise_preferences
        WHERE user_id = ?
        AND id IN (
            SELECT MAX(id) FROM user_exercise_preferences
            WHERE user_id = ?
            GROUP BY exercise_id
        )
        ORDER BY target_sessions_per_week DESC""",
        (user_id, user_id)
    ).fetchall()
    order = 0
    for pref in preferences:
        for i in range(pref["target_sessions_per_week"]):
            db.execute(
                """INSERT INTO planned_sets (user_id, planned_order, exercise_id)
                VALUES (?, ?, ?)""",
                (user_id, order, pref["exercise_id"])
            )
            order += 1