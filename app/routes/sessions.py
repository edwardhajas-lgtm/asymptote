from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from app.services.database import get_db
from app.services.auth import get_current_user
from app.services.algorithm import process_session, generate_deload_plan

router = APIRouter()

class SessionCreate(BaseModel):
    session_datetime: str
    session_type: str = 'normal'
    readiness_score: Optional[int] = None
    stress_level: Optional[int] = None
    sleep_hours: Optional[float] = None
    sleep_quality: Optional[int] = None
    notes: Optional[str] = None

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