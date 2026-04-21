from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from app.services.database import get_db
from app.services.auth import get_current_user
from app.services.algorithm import generate_schedule

router = APIRouter()

class PreferenceUpdate(BaseModel):
    target_sets_per_session: Optional[int] = None
    target_sessions_per_week: Optional[int] = None
    estimated_1rm: Optional[float] = None

class PreferenceCreate(BaseModel):
    exercise_id: int
    target_sets_per_session: int
    target_sessions_per_week: int
    estimated_1rm: Optional[float] = None

@router.post("/preferences")
def create_preference(preference: PreferenceCreate, current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        exercise = db.execute(
            "SELECT id FROM exercises WHERE id = ?",
            (preference.exercise_id,)
        ).fetchone()

        if not exercise:
            raise HTTPException(status_code=404, detail="Exercise not found")

        cursor = db.execute(
            """INSERT INTO user_exercise_preferences
            (user_id, exercise_id, target_sets_per_session, target_sessions_per_week, estimated_1rm)
            VALUES (?, ?, ?, ?, ?)""",
            (current_user["id"], preference.exercise_id, preference.target_sets_per_session,
             preference.target_sessions_per_week, preference.estimated_1rm)
        )

        new_preference = db.execute(
            """SELECT * FROM user_exercise_preferences WHERE id = ?""",
            (cursor.lastrowid,)
        ).fetchone()

        generate_schedule(db, current_user["id"])

        return dict(new_preference)

@router.get("/preferences")
def get_preferences(current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        preferences = db.execute(
            """SELECT uep.*, e.name as exercise_name, e.muscle_group
            FROM user_exercise_preferences uep
            JOIN exercises e ON uep.exercise_id = e.id
            WHERE uep.user_id = ?
            ORDER BY uep.created_at DESC""",
            (current_user["id"],)
        ).fetchall()

        return [dict(p) for p in preferences]

@router.patch("/preferences/{preference_id}")
def update_preference(preference_id: int, body: PreferenceUpdate, current_user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided")

    with get_db() as db:
        existing = db.execute(
            "SELECT * FROM user_exercise_preferences WHERE id = ? AND user_id = ?",
            (preference_id, current_user["id"])
        ).fetchone()

        if not existing:
            raise HTTPException(status_code=404, detail="Preference not found")

        merged = {
            "target_sets_per_session": updates.get("target_sets_per_session", existing["target_sets_per_session"]),
            "target_sessions_per_week": updates.get("target_sessions_per_week", existing["target_sessions_per_week"]),
            "estimated_1rm": updates.get("estimated_1rm", existing["estimated_1rm"]),
        }

        cursor = db.execute(
            """INSERT INTO user_exercise_preferences
            (user_id, exercise_id, target_sets_per_session, target_sessions_per_week, estimated_1rm)
            VALUES (?, ?, ?, ?, ?)""",
            (current_user["id"], existing["exercise_id"],
             merged["target_sets_per_session"], merged["target_sessions_per_week"], merged["estimated_1rm"])
        )

        new_pref = db.execute(
            "SELECT * FROM user_exercise_preferences WHERE id = ?",
            (cursor.lastrowid,)
        ).fetchone()

        generate_schedule(db, current_user["id"])

        return dict(new_pref)

@router.delete("/preferences/{exercise_id}")
def delete_preference(exercise_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        result = db.execute(
            "DELETE FROM user_exercise_preferences WHERE user_id = ? AND exercise_id = ?",
            (current_user["id"], exercise_id)
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Preference not found")
        generate_schedule(db, current_user["id"])
    return {"deleted": True}