from app.services.database import get_db

K_FATIGUE_MODIFIER = 0
TARGET_FATIGUE_RATE = 0.75
RESET_PERCENTAGE = 0.70
SIMPLE_MODE_INCREASE = 1.03
SIMPLE_MODE_DECREASE = 0.95

RPE_MULTIPLIERS = {
    5: 2.0,
    6: 1.5,
    7: 1.15,
    8: 1.05,
    9: 1.01,
    10: 0.90
}

def get_rpe_multiplier(weighted_rpe: float) -> float:
    lower = int(weighted_rpe)
    upper = lower + 1
    if lower <= 5:
        return RPE_MULTIPLIERS[5]
    if upper >= 10:
        return RPE_MULTIPLIERS[10]
    lower_mult = RPE_MULTIPLIERS.get(lower, 1.0)
    upper_mult = RPE_MULTIPLIERS.get(upper, 1.0)
    fraction = weighted_rpe - lower
    return lower_mult + (upper_mult - lower_mult) * fraction

def calculate_weighted_rpe(sets: list) -> float:
    total_weight = 0
    weighted_sum = 0
    for s in sets:
        if s["rpe"] is None:
            continue
        position = s["set_number"]
        weight = position ** 2
        weighted_sum += s["rpe"] * weight
        total_weight += weight
    if total_weight == 0:
        return None
    return weighted_sum / total_weight

def calculate_fatigue_rate(sets: list) -> float:
    sets_with_rpe = [s for s in sets if s["rpe"] is not None]
    if len(sets_with_rpe) < 2:
        return None
    first_rpe = sets_with_rpe[0]["rpe"]
    last_rpe = sets_with_rpe[-1]["rpe"]
    return (last_rpe - first_rpe) / len(sets_with_rpe)

def calculate_fatigue_index(sets: list) -> list:
    sets_with_rpe = [s for s in sets if s["rpe"] is not None]
    if not sets_with_rpe:
        return sets
    baseline_rpe = sets_with_rpe[0]["rpe"]
    result = []
    for s in sets:
        s = dict(s)
        if s["rpe"] is not None and baseline_rpe > 0:
            s["fatigue_index"] = round((s["rpe"] - baseline_rpe) / baseline_rpe, 3)
        else:
            s["fatigue_index"] = 0.0
        result.append(s)
    return result

def calculate_epley_1rm(weight: float, reps: int) -> float:
    if reps == 1:
        return weight
    return round(weight * (1 + reps / 30), 2)

def calculate_weight_recommendation(
    weight_used: float,
    weighted_rpe: float,
    fatigue_rate: float,
    tracking_preset: str
) -> float:
    if tracking_preset == 'simple' or weighted_rpe is None:
        return round(weight_used * SIMPLE_MODE_INCREASE, 2)

    base_multiplier = get_rpe_multiplier(weighted_rpe)

    fatigue_modifier = 0
    if fatigue_rate is not None:
        fatigue_modifier = (TARGET_FATIGUE_RATE - fatigue_rate) * K_FATIGUE_MODIFIER

    final_multiplier = base_multiplier * (1 + fatigue_modifier)
    return round(weight_used * final_multiplier, 2)

def store_metric(db, user_id: int, exercise_id: int, metric_type: str, value: float):
    db.execute(
        """INSERT INTO user_exercise_metrics 
        (user_id, exercise_id, metric_type, value)
        VALUES (?, ?, ?, ?)""",
        (user_id, exercise_id, metric_type, value)
    )

def process_session(session_id: int, user_id: int):
    with get_db() as db:
        user = db.execute(
            "SELECT tracking_preset FROM users WHERE id = ?",
            (user_id,)
        ).fetchone()

        tracking_preset = user["tracking_preset"] if user else "simple"

        sets = db.execute(
            """SELECT s.*, e.exercise_type FROM sets s
            JOIN exercises e ON s.exercise_id = e.id
            WHERE s.session_id = ?
            ORDER BY s.exercise_id, s.set_number""",
            (session_id,)
        ).fetchall()

        sets = [dict(s) for s in sets]

        exercise_ids = list(set(s["exercise_id"] for s in sets))

        results = {}

        for exercise_id in exercise_ids:
            exercise_sets = [s for s in sets if s["exercise_id"] == exercise_id]

            exercise_sets = calculate_fatigue_index(exercise_sets)
            for s in exercise_sets:
                if s["fatigue_index"] is not None:
                    db.execute(
                        "UPDATE sets SET fatigue_index = ? WHERE id = ?",
                        (s["fatigue_index"], s["id"])
                    )

            weighted_rpe = calculate_weighted_rpe(exercise_sets)
            fatigue_rate = calculate_fatigue_rate(exercise_sets)

            last_set = exercise_sets[-1]
            weight_used = last_set["weight_used"]
            reps_completed = last_set["reps_completed"]

            next_weight = None
            estimated_1rm = None

            if weight_used and reps_completed:
                next_weight = calculate_weight_recommendation(
                    weight_used, weighted_rpe, fatigue_rate, tracking_preset
                )
                estimated_1rm = calculate_epley_1rm(weight_used, reps_completed)

            tonnage = sum(
                (s["weight_used"] or 0) * (s["reps_completed"] or 0)
                for s in exercise_sets
            )

            if weighted_rpe:
                store_metric(db, user_id, exercise_id, "weighted_rpe", weighted_rpe)
            if fatigue_rate is not None:
                store_metric(db, user_id, exercise_id, "fatigue_rate", fatigue_rate)
            if estimated_1rm:
                store_metric(db, user_id, exercise_id, "estimated_1rm", estimated_1rm)
            if tonnage:
                store_metric(db, user_id, exercise_id, "tonnage", tonnage)

            results[exercise_id] = {
                "weighted_rpe": weighted_rpe,
                "fatigue_rate": fatigue_rate,
                "estimated_1rm": estimated_1rm,
                "next_weight_recommended": next_weight,
                "tonnage": tonnage
            }

        return results