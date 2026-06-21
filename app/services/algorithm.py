def calculate_weight_recommendation(db, user_id, exercise_id, weight_used, reps_completed, reps_target_min, reps_target_max):
    if reps_completed >= reps_target_max:
        new_weight = weight_used + (weight_used * 0.05)
    elif reps_completed < reps_target_min:
        new_weight = weight_used - (weight_used * 0.10)
    else:
        new_weight = weight_used
    db.execute(
        """INSERT INTO user_exercise_metrics (user_id, exercise_id, metric_type, value)
        VALUES (?, ?, ?, ?)""",
        (user_id, exercise_id, "weight_recommended", new_weight)
    )
    return new_weight