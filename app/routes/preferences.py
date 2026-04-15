from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from app.services.database import get_db
from app.services.auth import get_current_user

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
        pref = db.execute(
            "SELECT id FROM user_exercise_preferences WHERE id = ? AND user_id = ?",
            (preference_id, current_user["id"])
        ).fetchone()

        if not pref:
            raise HTTPException(status_code=404, detail="Preference not found")

        fields = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [preference_id]

        db.execute(
            f"UPDATE user_exercise_preferences SET {fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            values
        )

        updated = db.execute(
            "SELECT * FROM user_exercise_preferences WHERE id = ?",
            (preference_id,)
        ).fetchone()

        return dict(updated)