from app.services.database import get_db
from datetime import datetime, timedelta
import random

K_FATIGUE_MODIFIER = 0
TARGET_FATIGUE_RATE = 0.75
RESET_PERCENTAGE = 0.70
SIMPLE_MODE_INCREASE = 1.03
SIMPLE_MODE_DECREASE = 0.95
SIMPLE_MODE_INCREASE_AGGRESSIVE = 1.06

BASE_RECOVERY_HOURS = {
    "legs": 72,
    "back": 48,
    "chest": 48,
    "shoulders": 48,
    "arms": 24,
    "core": 24,
}
RECOVERY_HOURS_DEFAULT = 48
RECOVERY_BAD_SESSION_BONUS = 12

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

def calculate_weight_recommendation(weight_used, weighted_rpe, fatigue_rate, tracking_preset,
                                    reps_completed=None, reps_target_min=None, reps_target_max=None):
    if tracking_preset == "simple" or weighted_rpe is None:
        if reps_completed is not None and reps_target_min is not None:
            if reps_target_max is not None and reps_completed > reps_target_max:
                return round(weight_used * SIMPLE_MODE_INCREASE_AGGRESSIVE, 2)
            if reps_completed < reps_target_min:
                return round(weight_used * SIMPLE_MODE_DECREASE, 2)
        return round(weight_used * SIMPLE_MODE_INCREASE, 2)
    base_multiplier = get_rpe_multiplier(weighted_rpe)
    fatigue_modifier = 0
    if fatigue_rate is not None:
        fatigue_modifier = (TARGET_FATIGUE_RATE - fatigue_rate) * K_FATIGUE_MODIFIER
    final_multiplier = base_multiplier * (1 + fatigue_modifier)
    return round(weight_used * final_multiplier, 2)

def store_metric(db, user_id, exercise_id, metric_type, value):
    db.execute(
        """INSERT INTO user_exercise_metrics 
        (user_id, exercise_id, metric_type, value)
        VALUES (?, ?, ?, ?)""",
        (user_id, exercise_id, metric_type, value)
    )

def check_rep_failure(sets, reps_target_min):
    for s in sets:
        if s["reps_completed"] is not None:
            if s["reps_completed"] < reps_target_min:
                return True
    return False

def check_bad_session(session):
    readiness = session.get("readiness_score")
    stress = session.get("stress_level")
    sleep_quality = session.get("sleep_quality")
    if readiness == 3:
        return True
    if readiness == 2 and stress == 3:
        return True
    if sleep_quality == 3 and stress == 3:
        return True
    return False

def check_rpe_drift(db, user_id, exercise_id, lookback_weeks=5, threshold=0.5):
    rows = db.execute(
        """SELECT AVG(m.value) as avg_rpe,
        strftime("%Y-%W", se.session_datetime) as week
        FROM user_exercise_metrics m
        JOIN sets s ON m.exercise_id = s.exercise_id AND m.user_id = se.user_id
        JOIN sessions se ON s.session_id = se.id
        WHERE m.user_id = ?
        AND m.exercise_id = ?
        AND m.metric_type = "weighted_rpe"
        AND se.session_datetime >= datetime("now", ? || " days")
        AND se.session_type = "normal"
        GROUP BY week
        ORDER BY week ASC""",
        (user_id, exercise_id, -(lookback_weeks * 7))
    ).fetchall()
    if len(rows) < 3:
        return False
    weekly_rpes = [row["avg_rpe"] for row in rows]
    consecutive_increases = 0
    for i in range(1, len(weekly_rpes)):
        if weekly_rpes[i] - weekly_rpes[i-1] >= threshold:
            consecutive_increases += 1
        else:
            consecutive_increases = 0
        if consecutive_increases >= 2:
            return True
    return False

def get_user_algorithm_setting(db, user_id, setting_name, default):
    row = db.execute(
        """SELECT value FROM user_algorithm_settings
        WHERE user_id = ? AND setting_name = ?
        ORDER BY updated_at DESC, id DESC LIMIT 1""",
        (user_id, setting_name)
    ).fetchone()
    if row:
        try:
            return type(default)(row["value"])
        except:
            return default
    return default

def check_and_store_pr(db, user_id, exercise_id, weight_used, reps_completed):
    if not weight_used or not reps_completed:
        return None
    metric_type = f"pr_{reps_completed}rm"
    existing_pr = db.execute(
        """SELECT value FROM user_exercise_metrics
        WHERE user_id = ? AND exercise_id = ? AND metric_type = ?
        ORDER BY value DESC LIMIT 1""",
        (user_id, exercise_id, metric_type)
    ).fetchone()
    if not existing_pr or weight_used > existing_pr["value"]:
        store_metric(db, user_id, exercise_id, metric_type, weight_used)
        return {
            "new_pr": True,
            "reps": reps_completed,
            "weight": weight_used,
            "metric_type": metric_type
        }
    return None

def check_estimated_1rm_pr(db, user_id, exercise_id, estimated_1rm):
    if not estimated_1rm:
        return False
    existing = db.execute(
        """SELECT MAX(value) as max_value FROM user_exercise_metrics
        WHERE user_id = ? AND exercise_id = ? AND metric_type = 'estimated_1rm'""",
        (user_id, exercise_id)
    ).fetchone()
    if not existing or not existing["max_value"]:
        return True
    return estimated_1rm > existing["max_value"]

def supports_1rm_tracking(db, user_id, exercise_id):
    exercise = db.execute(
        "SELECT supports_1rm FROM exercises WHERE id = ?",
        (exercise_id,)
    ).fetchone()
    if exercise and exercise["supports_1rm"]:
        return True
    override = get_user_algorithm_setting(
        db, user_id, f"1rm_tracking_exercise_{exercise_id}", 0
    )
    return bool(int(override))

def get_avg_tonnage(db, user_id, exercise_id, weeks=5):
    row = db.execute(
        """SELECT AVG(value) as avg_tonnage FROM user_exercise_metrics
        WHERE user_id = ? AND exercise_id = ? AND metric_type = 'tonnage'
        AND calculated_at >= datetime('now', ? || ' days')""",
        (user_id, exercise_id, -(weeks * 7))
    ).fetchone()
    if row and row["avg_tonnage"]:
        return row["avg_tonnage"]
    return None

def estimate_recovery_hours(muscle_group, weighted_rpe, tonnage, avg_tonnage, bad_session):
    base = BASE_RECOVERY_HOURS.get(muscle_group, RECOVERY_HOURS_DEFAULT)

    rpe_modifier = 1.0
    if weighted_rpe is not None:
        rpe_modifier = max(0.8, min(1.3, 0.8 + (weighted_rpe - 6) * 0.125))

    tonnage_modifier = 1.0
    if tonnage and avg_tonnage:
        ratio = tonnage / avg_tonnage
        tonnage_modifier = max(0.7, min(1.4, 1.0 + (ratio - 1.0) * 0.4))

    recovery = base * rpe_modifier * tonnage_modifier
    if bad_session:
        recovery += RECOVERY_BAD_SESSION_BONUS

    return round(recovery, 1)

def generate_deload_plan(db, user_id, session_id):
    volume_reduction = get_user_algorithm_setting(
        db, user_id, "deload_volume_reduction", 0.5
    )
    intensity_reduction = get_user_algorithm_setting(
        db, user_id, "deload_intensity_reduction", 0.2
    )

    sets = db.execute(
        """SELECT s.exercise_id, s.weight_used, s.reps_target_min, s.reps_target_max, s.id as set_id
        FROM sets s
        WHERE s.session_id = ?
        ORDER BY s.exercise_id, s.set_number""",
        (session_id,)
    ).fetchall()

    exercise_ids = list(dict.fromkeys(s["exercise_id"] for s in sets))
    base_date = datetime.now().date() + timedelta(days=1)
    planned = []

    for exercise_id in exercise_ids:
        exercise_sets = [s for s in sets if s["exercise_id"] == exercise_id]
        last_set = exercise_sets[-1]
        deload_weight = round((last_set["weight_used"] or 0) * (1 - intensity_reduction), 2)

        pref = db.execute(
            """SELECT target_sets_per_session, target_sessions_per_week
            FROM user_exercise_preferences
            WHERE user_id = ? AND exercise_id = ?
            ORDER BY created_at DESC LIMIT 1""",
            (user_id, exercise_id)
        ).fetchone()

        if pref:
            num_sets = max(1, round(pref["target_sets_per_session"] * (1 - volume_reduction)))
            sessions_per_week = pref["target_sessions_per_week"]
        else:
            num_sets = 1
            sessions_per_week = 1

        interval = 7 / sessions_per_week
        for session_num in range(sessions_per_week):
            planned_date = base_date + timedelta(days=round(session_num * interval))
            for set_num in range(1, num_sets + 1):
                cursor = db.execute(
                    """INSERT INTO planned_sets
                    (user_id, planned_date, exercise_id, set_number,
                    weight_recommended, reps_target_min, reps_target_max,
                    generated_from_set_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (user_id, planned_date.isoformat(), exercise_id, set_num,
                     deload_weight, last_set["reps_target_min"], last_set["reps_target_max"],
                     last_set["set_id"])
                )
                planned.append({
                    "id": cursor.lastrowid,
                    "exercise_id": exercise_id,
                    "planned_date": planned_date.isoformat(),
                    "set_number": set_num,
                    "weight_recommended": deload_weight,
                    "reps_target_min": last_set["reps_target_min"],
                    "reps_target_max": last_set["reps_target_max"],
                })

    return planned

SHOCK_RECOVERY_MULTIPLIER = 1.5

SHOCK_FORMATS = ["high_volume", "alternating", "pyramid", "reverse_pyramid", "drop_sets"]

SHOCK_FORMAT_DESCRIPTIONS = {
    "high_volume": "10 sets × 25-30 reps at moderate weight. Pure volume overload.",
    "alternating": "Alternating heavy (3-5 reps) and light (15-20 reps) sets. Full rep range stimulus.",
    "pyramid": "Ascending weight, descending reps. Start light, finish heavy.",
    "reverse_pyramid": "Start heavy, get lighter each set. Peak intensity first.",
    "drop_sets": "Start at near-max weight, drop 20% each set until failure.",
}


def _generate_sets_for_format(format_name, one_rm):
    sets = []
    if format_name == "high_volume":
        w = round(one_rm * 0.40, 2)
        for i in range(1, 11):
            sets.append({"set_number": i, "weight_recommended": w, "reps_target_min": 25, "reps_target_max": 30})
    elif format_name == "alternating":
        for i in range(1, 7):
            if i % 2 == 1:
                sets.append({"set_number": i, "weight_recommended": round(one_rm * 0.85, 2), "reps_target_min": 3, "reps_target_max": 5})
            else:
                sets.append({"set_number": i, "weight_recommended": round(one_rm * 0.50, 2), "reps_target_min": 15, "reps_target_max": 20})
    elif format_name == "pyramid":
        for i, (pct, rmin, rmax) in enumerate([(0.60, 12, 12), (0.70, 10, 10), (0.80, 8, 8), (0.85, 6, 6), (0.90, 4, 4)], 1):
            sets.append({"set_number": i, "weight_recommended": round(one_rm * pct, 2), "reps_target_min": rmin, "reps_target_max": rmax})
    elif format_name == "reverse_pyramid":
        for i, (pct, rmin, rmax) in enumerate([(0.90, 4, 5), (0.80, 6, 8), (0.70, 10, 12), (0.60, 13, 15)], 1):
            sets.append({"set_number": i, "weight_recommended": round(one_rm * pct, 2), "reps_target_min": rmin, "reps_target_max": rmax})
    elif format_name == "drop_sets":
        w = round(one_rm * 0.85, 2)
        for i in range(1, 5):
            sets.append({"set_number": i, "weight_recommended": round(w, 2), "reps_target_min": 1, "reps_target_max": 30})
            w = round(w * 0.80, 2)
    return sets


def generate_shock_plan(db, user_id):
    preferences = db.execute(
        """SELECT uep.exercise_id, uep.estimated_1rm,
        e.name, e.muscle_group
        FROM user_exercise_preferences uep
        JOIN exercises e ON uep.exercise_id = e.id
        WHERE uep.user_id = ?
        ORDER BY uep.created_at DESC""",
        (user_id,)
    ).fetchall()

    seen = set()
    unique_prefs = []
    for p in preferences:
        if p["exercise_id"] not in seen:
            seen.add(p["exercise_id"])
            unique_prefs.append(dict(p))

    if not unique_prefs:
        return {
            "format": None,
            "exercises": [],
            "message": "No exercise preferences found. Set up preferences first."
        }

    format_name = random.choice(SHOCK_FORMATS)
    exercises = []

    for pref in unique_prefs:
        one_rm = pref["estimated_1rm"]
        if not one_rm:
            last_set = db.execute(
                """SELECT s.weight_used FROM sets s
                JOIN sessions se ON s.session_id = se.id
                WHERE se.user_id = ? AND s.exercise_id = ? AND s.weight_used IS NOT NULL
                ORDER BY se.session_datetime DESC LIMIT 1""",
                (user_id, pref["exercise_id"])
            ).fetchone()
            if last_set:
                one_rm = last_set["weight_used"] / 0.70
            else:
                continue

        sets = _generate_sets_for_format(format_name, one_rm)
        exercises.append({
            "exercise_id": pref["exercise_id"],
            "exercise_name": pref["name"],
            "muscle_group": pref["muscle_group"],
            "sets": sets
        })

    return {
        "format": format_name,
        "format_description": SHOCK_FORMAT_DESCRIPTIONS.get(format_name, ""),
        "exercises": exercises
    }


def check_shock_suggestion(db, user_id):
    reasons = []

    rpe_row = db.execute(
        """SELECT AVG(value) as avg_rpe FROM user_exercise_metrics
        WHERE user_id = ? AND metric_type = 'weighted_rpe'
        AND calculated_at >= datetime('now', '-35 days')""",
        (user_id,)
    ).fetchone()

    if rpe_row and rpe_row["avg_rpe"] is not None and rpe_row["avg_rpe"] < 6.5:
        reasons.append("Your RPE has been consistently low — your body may have adapted to current loads.")

    recent_sets = db.execute(
        """SELECT s.reps_completed FROM sets s
        JOIN sessions se ON s.session_id = se.id
        WHERE se.user_id = ? AND s.reps_completed IS NOT NULL
        AND se.session_type = 'normal' AND se.completed_at IS NOT NULL
        ORDER BY se.session_datetime DESC
        LIMIT 30""",
        (user_id,)
    ).fetchall()

    if len(recent_sets) >= 10:
        reps = [r["reps_completed"] for r in recent_sets]
        avg = sum(reps) / len(reps)
        variance = sum((r - avg) ** 2 for r in reps) / len(reps)
        if variance < 4.0:
            reasons.append("You've been hitting the same rep range consistently — time to mix it up.")

    return {"suggested": len(reasons) > 0, "reasons": reasons}


def estimate_shock_recovery(db, user_id, session_id):
    sets = db.execute(
        """SELECT s.*, e.muscle_group FROM sets s
        JOIN exercises e ON s.exercise_id = e.id
        WHERE s.session_id = ?""",
        (session_id,)
    ).fetchall()
    sets = [dict(s) for s in sets]

    exercise_ids = list(dict.fromkeys(s["exercise_id"] for s in sets))
    recovery_by_muscle = {}

    for exercise_id in exercise_ids:
        exercise_sets = [s for s in sets if s["exercise_id"] == exercise_id]
        muscle_group = exercise_sets[0]["muscle_group"]

        weighted_rpe = calculate_weighted_rpe(exercise_sets)
        tonnage = sum((s["weight_used"] or 0) * (s["reps_completed"] or 0) for s in exercise_sets)
        avg_tonnage = get_avg_tonnage(db, user_id, exercise_id)

        base_recovery = estimate_recovery_hours(muscle_group, weighted_rpe, tonnage, avg_tonnage, bad_session=False)
        shock_recovery = round(base_recovery * SHOCK_RECOVERY_MULTIPLIER, 1)

        store_metric(db, user_id, exercise_id, "recovery_hours", shock_recovery)

        if muscle_group not in recovery_by_muscle or shock_recovery > recovery_by_muscle[muscle_group]:
            recovery_by_muscle[muscle_group] = shock_recovery

    return recovery_by_muscle


def process_session(session_id: int, user_id: int):
    with get_db() as db:
        user = db.execute(
            "SELECT tracking_preset FROM users WHERE id = ?",
            (user_id,)
        ).fetchone()
        tracking_preset = user["tracking_preset"] if user else "simple"

        session_data = db.execute(
            "SELECT * FROM sessions WHERE id = ?",
            (session_id,)
        ).fetchone()

        if session_data and session_data["session_type"] == "shock":
            return {"session_type": "shock", "skipped": True, "reason": "shock sessions excluded from algorithm"}

        sets = db.execute(
            """SELECT s.*, e.exercise_type, e.muscle_group FROM sets s
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
                    weight_used, weighted_rpe, fatigue_rate, tracking_preset,
                    reps_completed=reps_completed,
                    reps_target_min=last_set["reps_target_min"],
                    reps_target_max=last_set["reps_target_max"]
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
            if tonnage:
                store_metric(db, user_id, exercise_id, "tonnage", tonnage)

            estimated_1rm_pr = False
            if supports_1rm_tracking(db, user_id, exercise_id) and estimated_1rm:
                estimated_1rm_pr = check_estimated_1rm_pr(
                    db, user_id, exercise_id, estimated_1rm
                )

            if estimated_1rm:
                store_metric(db, user_id, exercise_id, "estimated_1rm", estimated_1rm)

            prs = []
            for s in exercise_sets:
                if s["weight_used"] and s["reps_completed"]:
                    pr = check_and_store_pr(
                        db, user_id, exercise_id,
                        s["weight_used"], s["reps_completed"]
                    )
                    if pr:
                        prs.append(pr)

            failure_detected = False
            bad_session = False
            deload_recommended = False
            final_weight = next_weight

            exercise_data = db.execute(
                "SELECT target_rep_min FROM exercises WHERE id = ?",
                (exercise_id,)
            ).fetchone()

            if exercise_data and reps_completed:
                failure_detected = check_rep_failure(
                    exercise_sets,
                    exercise_data["target_rep_min"]
                )

            if failure_detected:
                bad_session = check_bad_session(dict(session_data))
                if bad_session:
                    final_weight = weight_used
                else:
                    lookback_weeks = get_user_algorithm_setting(
                        db, user_id, "deload_lookback_weeks", 5
                    )
                    deload_recommended = check_rpe_drift(
                        db, user_id, exercise_id, lookback_weeks
                    )
                    if not deload_recommended:
                        reset_pct = get_user_algorithm_setting(
                            db, user_id, "reset_percentage", RESET_PERCENTAGE
                        )
                        estimated_1rm_value = estimated_1rm or weight_used
                        final_weight = round(estimated_1rm_value * reset_pct, 2)

            if not failure_detected:
                lookback_weeks = get_user_algorithm_setting(
                    db, user_id, "deload_lookback_weeks", 5
                )
                deload_recommended = check_rpe_drift(
                    db, user_id, exercise_id, lookback_weeks
                )

            muscle_group = exercise_sets[0].get("muscle_group")
            avg_tonnage = get_avg_tonnage(db, user_id, exercise_id)
            recovery_hours = estimate_recovery_hours(
                muscle_group, weighted_rpe, tonnage, avg_tonnage, bad_session
            )
            store_metric(db, user_id, exercise_id, "recovery_hours", recovery_hours)

            results[exercise_id] = {
                "weighted_rpe": weighted_rpe,
                "fatigue_rate": fatigue_rate,
                "estimated_1rm": estimated_1rm,
                "next_weight_recommended": final_weight,
                "tonnage": tonnage,
                "failure_detected": failure_detected,
                "bad_session": bad_session,
                "deload_recommended": deload_recommended,
                "personal_records": prs,
                "estimated_1rm_pr": estimated_1rm_pr,
                "recovery_hours": recovery_hours
            }

        return results
