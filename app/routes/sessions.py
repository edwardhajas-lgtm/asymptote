from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from app.services.database import get_db
from app.services.auth import get_current_user
from app.services.algorithm import (
    process_session, generate_deload_plan,
    generate_shock_plan, check_shock_suggestion, estimate_shock_recovery,
)

router = APIRouter()

class SessionCreate(BaseModel):
    session_datetime: str
    session_type: str = 'normal'
    readiness_score: Optional[int] = None
    stress_level: Optional[int] = None
    sleep_hours: Optional[float] = None
    sleep_quality: Optional[int] = None
    notes: Optional[str] = None

class MeasuredOnerm(BaseModel):
    exercise_id: int
    weight: float

class BulkSetCreate(BaseModel):
    exercise_id: int
    set_number: int
    weight_used: Optional[float] = None
    reps_completed: Optional[int] = None
    duration_seconds: Optional[int] = None
    rpe: Optional[float] = None
    failed_reps: Optional[int] = 0
    pain_flag: Optional[bool] = False

class BulkSessionCreate(BaseModel):
    session_datetime: str
    session_type: str = "normal"
    readiness_score: Optional[int] = None
    stress_level: Optional[int] = None
    sleep_hours: Optional[float] = None
    sleep_quality: Optional[int] = None
    notes: Optional[str] = None
    completed_at: Optional[str] = None
    sets: List[BulkSetCreate] = []

class SetCreate(BaseModel):
    exercise_id: int
    set_number: int
    weight_used: Optional[float] = None
    reps_completed: Optional[int] = None
    duration_seconds: Optional[int] = None
    rpe: Optional[float] = None
    failed_reps: Optional[int] = 0
    pain_flag: Optional[bool] = False

@router.post("/sessions")
def create_session(session: SessionCreate, current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        last_session = db.execute(
            """SELECT MAX(sequence_number) as max_seq 
            FROM sessions WHERE user_id = ?""",
            (current_user["id"],)
        ).fetchone()

        sequence_number = (last_session["max_seq"] or 0) + 1

        cursor = db.execute(
            """INSERT INTO sessions 
            (user_id, session_datetime, sequence_number, session_type, readiness_score, 
            stress_level, sleep_hours, sleep_quality, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (current_user["id"], session.session_datetime, sequence_number,
            session.session_type, session.readiness_score, session.stress_level,
            session.sleep_hours, session.sleep_quality, session.notes)
        )

        new_session = db.execute(
            "SELECT * FROM sessions WHERE id = ?",
            (cursor.lastrowid,)
        ).fetchone()

        return dict(new_session)

@router.post("/sessions/{session_id}/sets")
def log_set(session_id: int, set_data: SetCreate, current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        session = db.execute(
            "SELECT id FROM sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user["id"])
        ).fetchone()

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        exercise = db.execute(
            "SELECT id, target_rep_min, target_rep_max, exercise_type FROM exercises WHERE id = ?",
            (set_data.exercise_id,)
        ).fetchone()

        if not exercise:
            raise HTTPException(status_code=404, detail="Exercise not found")

        preference = db.execute(
            """SELECT estimated_1rm FROM user_exercise_preferences 
            WHERE user_id = ? AND exercise_id = ?
            ORDER BY created_at DESC LIMIT 1""",
            (current_user["id"], set_data.exercise_id)
        ).fetchone()

        weight_recommended = None
        if preference and preference["estimated_1rm"]:
            weight_recommended = round(preference["estimated_1rm"] * 0.70, 2)

        cursor = db.execute(
            """INSERT INTO sets 
            (session_id, exercise_id, set_number, weight_recommended, weight_used,
            reps_target_min, reps_target_max, reps_completed, duration_seconds,
            rpe, failed_reps, pain_flag)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (session_id, set_data.exercise_id, set_data.set_number,
            weight_recommended, set_data.weight_used,
            exercise["target_rep_min"], exercise["target_rep_max"],
            set_data.reps_completed, set_data.duration_seconds,
            set_data.rpe, set_data.failed_reps, set_data.pain_flag)
        )

        new_set = db.execute(
            "SELECT * FROM sets WHERE id = ?",
            (cursor.lastrowid,)
        ).fetchone()

        return dict(new_set)

@router.patch("/sessions/{session_id}/complete")
def complete_session(session_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        session = db.execute(
            "SELECT id FROM sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user["id"])
        ).fetchone()

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        db.execute(
            """UPDATE sessions SET completed_at = CURRENT_TIMESTAMP 
            WHERE id = ?""",
            (session_id,)
        )

    results = process_session(session_id, current_user["id"])

    return {
        "message": "Session completed",
        "session_id": session_id,
        "algorithm_results": results
    }

@router.get("/sessions")
def get_sessions(current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        sessions = db.execute(
            """SELECT * FROM sessions WHERE user_id = ?
            ORDER BY sequence_number DESC""",
            (current_user["id"],)
        ).fetchall()

        return [dict(s) for s in sessions]

@router.get("/sessions/{session_id}")
def get_session(session_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        session = db.execute(
            "SELECT * FROM sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user["id"])
        ).fetchone()

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        return dict(session)

@router.get("/sessions/{session_id}/sets")
def get_sets(session_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        session = db.execute(
            "SELECT id FROM sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user["id"])
        ).fetchone()

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        sets = db.execute(
            """SELECT s.*, e.name as exercise_name, e.exercise_type
            FROM sets s
            JOIN exercises e ON s.exercise_id = e.id
            WHERE s.session_id = ?
            ORDER BY s.set_number""",
            (session_id,)
        ).fetchall()

        return [dict(s) for s in sets]

@router.post("/sessions/{session_id}/generate-deload")
def generate_deload(session_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        session = db.execute(
            "SELECT id FROM sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user["id"])
        ).fetchone()

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        planned = generate_deload_plan(db, current_user["id"], session_id)

    return {
        "message": "Deload plan generated",
        "session_id": session_id,
        "planned_sets": planned
    }

@router.get("/sessions/shock-suggestion")
def get_shock_suggestion(current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        return check_shock_suggestion(db, current_user["id"])

@router.get("/sessions/shock-plan")
def get_shock_plan(current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        return generate_shock_plan(db, current_user["id"])

@router.get("/sessions/{session_id}/complete-shock")
def complete_shock_screen(session_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        session = db.execute(
            "SELECT * FROM sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user["id"])
        ).fetchone()

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        session = dict(session)

        if session["session_type"] != "shock":
            raise HTTPException(status_code=400, detail="This endpoint is only for shock sessions")

        show_quote = not bool(session.get("shock_screen_viewed", False))
        if show_quote:
            db.execute(
                "UPDATE sessions SET shock_screen_viewed = 1 WHERE id = ?",
                (session_id,)
            )

        sets = db.execute("SELECT * FROM sets WHERE session_id = ?", (session_id,)).fetchall()
        sets = [dict(s) for s in sets]

        total_volume = sum((s["weight_used"] or 0) * (s["reps_completed"] or 0) for s in sets)
        sets_completed = len([s for s in sets if s["reps_completed"] is not None])

        duration_minutes = None
        if session.get("completed_at") and session.get("session_datetime"):
            from datetime import datetime
            try:
                fmt = "%Y-%m-%d %H:%M:%S"
                start = datetime.strptime(session["session_datetime"][:19], fmt)
                end = datetime.strptime(session["completed_at"][:19], fmt)
                duration_minutes = round((end - start).total_seconds() / 60, 1)
            except Exception:
                pass

        recovery = estimate_shock_recovery(db, current_user["id"], session_id)

    return {
        "show_quote": show_quote,
        "quote": "Congratulations. Failure has been achieved. Thank God. Now, the only place to go from failure, is to win.",
        "quote_attribution": "Tom Platz",
        "summary": {
            "total_volume": total_volume,
            "sets_completed": sets_completed,
            "duration_minutes": duration_minutes,
        },
        "recovery": recovery,
    }

@router.post("/sessions/{session_id}/measured-1rm")
def log_measured_1rm(session_id: int, body: MeasuredOnerm, current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        session = db.execute(
            "SELECT id FROM sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user["id"])
        ).fetchone()

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        exercise = db.execute(
            "SELECT id FROM exercises WHERE id = ?",
            (body.exercise_id,)
        ).fetchone()

        if not exercise:
            raise HTTPException(status_code=404, detail="Exercise not found")

        db.execute(
            """INSERT INTO user_exercise_metrics (user_id, exercise_id, metric_type, value)
            VALUES (?, ?, 'measured_1rm', ?)""",
            (current_user["id"], body.exercise_id, body.weight)
        )

        pref = db.execute(
            """SELECT id, estimated_1rm FROM user_exercise_preferences
            WHERE user_id = ? AND exercise_id = ?
            ORDER BY created_at DESC LIMIT 1""",
            (current_user["id"], body.exercise_id)
        ).fetchone()

        if pref and (not pref["estimated_1rm"] or body.weight > pref["estimated_1rm"]):
            db.execute(
                """UPDATE user_exercise_preferences
                SET estimated_1rm = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?""",
                (body.weight, pref["id"])
            )

    return {
        "exercise_id": body.exercise_id,
        "measured_1rm": body.weight,
        "session_id": session_id,
    }

@router.get("/forecast")
def get_forecast(current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        rows = db.execute(
            """SELECT ps.*, e.name as exercise_name, e.muscle_group
            FROM planned_sets ps
            JOIN exercises e ON ps.exercise_id = e.id
            WHERE ps.user_id = ? AND ps.completed = 0
            AND ps.planned_date >= date('now')
            ORDER BY ps.planned_date, ps.exercise_id, ps.set_number""",
            (current_user["id"],)
        ).fetchall()

        by_date = {}
        for row in rows:
            date = row["planned_date"]
            if date not in by_date:
                by_date[date] = []
            by_date[date].append(dict(row))

        return [{"date": date, "sets": sets} for date, sets in sorted(by_date.items())]

@router.patch("/planned-sets/{planned_set_id}/complete")
def complete_planned_set(planned_set_id: int, actual_set_id: Optional[int] = None, current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        planned_set = db.execute(
            "SELECT * FROM planned_sets WHERE id = ? AND user_id = ?",
            (planned_set_id, current_user["id"])
        ).fetchone()

        if not planned_set:
            raise HTTPException(status_code=404, detail="Planned set not found")

        if actual_set_id is not None:
            actual_set = db.execute(
                "SELECT id FROM sets WHERE id = ?",
                (actual_set_id,)
            ).fetchone()
            if not actual_set:
                raise HTTPException(status_code=404, detail="Actual set not found")

        db.execute(
            """UPDATE planned_sets SET completed = 1, actual_set_id = ?
            WHERE id = ?""",
            (actual_set_id, planned_set_id)
        )

        updated = db.execute(
            "SELECT * FROM planned_sets WHERE id = ?",
            (planned_set_id,)
        ).fetchone()

        return dict(updated)

@router.post("/sessions/bulk")
def bulk_create_sessions(sessions_data: List[BulkSessionCreate], current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        last_seq = db.execute(
            "SELECT MAX(sequence_number) as max_seq FROM sessions WHERE user_id = ?",
            (current_user["id"],)
        ).fetchone()
    sequence_number = (last_seq["max_seq"] or 0) + 1

    created = []
    for s in sessions_data:
        with get_db() as db:
            cursor = db.execute(
                """INSERT INTO sessions
                (user_id, session_datetime, sequence_number, session_type,
                readiness_score, stress_level, sleep_hours, sleep_quality, notes, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (current_user["id"], s.session_datetime, sequence_number, s.session_type,
                s.readiness_score, s.stress_level, s.sleep_hours, s.sleep_quality,
                s.notes, s.completed_at)
            )
            session_id = cursor.lastrowid
            sequence_number += 1

            sets_created = 0
            for set_data in s.sets:
                exercise = db.execute(
                    "SELECT target_rep_min, target_rep_max FROM exercises WHERE id = ?",
                    (set_data.exercise_id,)
                ).fetchone()
                if not exercise:
                    continue
                db.execute(
                    """INSERT INTO sets
                    (session_id, exercise_id, set_number, weight_used,
                    reps_target_min, reps_target_max, reps_completed,
                    duration_seconds, rpe, failed_reps, pain_flag)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (session_id, set_data.exercise_id, set_data.set_number, set_data.weight_used,
                    exercise["target_rep_min"], exercise["target_rep_max"],
                    set_data.reps_completed, set_data.duration_seconds,
                    set_data.rpe, set_data.failed_reps, set_data.pain_flag)
                )
                sets_created += 1

        algorithm_results = None
        if s.completed_at:
            algorithm_results = process_session(session_id, current_user["id"])

        created.append({
            "id": session_id,
            "sequence_number": sequence_number - 1,
            "sets_created": sets_created,
            "algorithm_results": algorithm_results,
        })

    return {"sessions_created": len(created), "sessions": created}