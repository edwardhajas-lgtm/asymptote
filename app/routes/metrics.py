from fastapi import APIRouter, HTTPException, Depends
from app.services.database import get_db
from app.services.auth import get_current_user
from app.services.algorithm import supports_1rm_tracking

router = APIRouter()

HISTORY_METRIC_TYPES = ["weighted_rpe", "tonnage", "estimated_1rm", "recovery_hours"]


@router.get("/metrics/prs")
def get_prs(current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        rows = db.execute(
            """SELECT m.exercise_id, e.name as exercise_name, m.metric_type, MAX(m.value) as best_value
            FROM user_exercise_metrics m
            JOIN exercises e ON m.exercise_id = e.id
            WHERE m.user_id = ?
            AND (m.metric_type LIKE 'pr_%rm' OR m.metric_type IN ('estimated_1rm', 'measured_1rm'))
            GROUP BY m.exercise_id, m.metric_type
            ORDER BY m.exercise_id, m.metric_type""",
            (current_user["id"],)
        ).fetchall()

        exercises = {}
        for row in rows:
            ex_id = row["exercise_id"]
            if ex_id not in exercises:
                exercises[ex_id] = {
                    "exercise_id": ex_id,
                    "exercise_name": row["exercise_name"],
                    "rep_records": [],
                    "estimated_1rm_pr": None,
                    "measured_1rm_pr": None,
                }

            if row["metric_type"] == "estimated_1rm":
                exercises[ex_id]["estimated_1rm_pr"] = row["best_value"]
            elif row["metric_type"] == "measured_1rm":
                exercises[ex_id]["measured_1rm_pr"] = row["best_value"]
            elif row["metric_type"].startswith("pr_") and row["metric_type"].endswith("rm"):
                try:
                    reps = int(row["metric_type"][3:-2])
                    exercises[ex_id]["rep_records"].append({"reps": reps, "weight": row["best_value"]})
                except ValueError:
                    pass

        result = list(exercises.values())
        for ex in result:
            ex["rep_records"].sort(key=lambda x: x["reps"])

        return result


@router.get("/metrics/{exercise_id}")
def get_metrics(exercise_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        exercise = db.execute(
            "SELECT id, name, muscle_group FROM exercises WHERE id = ?",
            (exercise_id,)
        ).fetchone()

        if not exercise:
            raise HTTPException(status_code=404, detail="Exercise not found")

        latest_rows = db.execute(
            """SELECT metric_type, value, calculated_at
            FROM user_exercise_metrics
            WHERE user_id = ? AND exercise_id = ?
            AND (metric_type, calculated_at) IN (
                SELECT metric_type, MAX(calculated_at)
                FROM user_exercise_metrics
                WHERE user_id = ? AND exercise_id = ?
                GROUP BY metric_type
            )""",
            (current_user["id"], exercise_id, current_user["id"], exercise_id)
        ).fetchall()

        latest = {row["metric_type"]: row["value"] for row in latest_rows}

        history = {}
        for metric_type in HISTORY_METRIC_TYPES:
            rows = db.execute(
                """SELECT value, calculated_at FROM user_exercise_metrics
                WHERE user_id = ? AND exercise_id = ? AND metric_type = ?
                ORDER BY calculated_at DESC LIMIT 10""",
                (current_user["id"], exercise_id, metric_type)
            ).fetchall()
            if rows:
                history[metric_type] = [
                    {"value": r["value"], "calculated_at": r["calculated_at"]}
                    for r in rows
                ]

        return {
            "exercise_id": exercise_id,
            "exercise_name": exercise["name"],
            "muscle_group": exercise["muscle_group"],
            "1rm_tracking_enabled": supports_1rm_tracking(db, current_user["id"], exercise_id),
            "latest": latest,
            "history": history,
        }
