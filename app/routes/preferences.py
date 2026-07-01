from fastapi import APIRouter, Depends, HTTPException
from app.services.database import get_db
from pydantic import BaseModel
from app.services.auth import get_current_user
from app.services.queue import generate_queue
from typing import Optional

router = APIRouter()

class PreferenceCreate(BaseModel):
    exercise_id: int
    target_rep_min: int
    target_rep_max: int
    target_sets_per_session: int
    target_sessions_per_week: int
    estimated_1rm: Optional[float] = None
    training_split: Optional[str] = None

@router.post("/preferences")
def create_preference(preference: PreferenceCreate, current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        existing = db.execute(
            "SELECT id FROM exercises WHERE id = ?",
            (preference.exercise_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=400, detail="Exercise does not exist")
        cursor = db.execute(
            """INSERT INTO user_exercise_preferences (exercise_id, target_rep_min, target_rep_max, target_sets_per_session, target_sessions_per_week, estimated_1rm, training_split, user_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (preference.exercise_id, preference.target_rep_min, preference.target_rep_max, preference.target_sets_per_session, preference.target_sessions_per_week, preference.estimated_1rm, preference.training_split, current_user["id"])
        )
        generate_queue(db, current_user["id"])
        return {"id": cursor.lastrowid, "name": preference.exercise_id, "message": "Exercise preference updated successfully"}
    
@router.get("/preferences")
def get_preferences(current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        preferences = db.execute("SELECT * FROM user_exercise_preferences WHERE user_id = ?", (current_user["id"],)).fetchall()
        return [dict(row) for row in preferences] 
