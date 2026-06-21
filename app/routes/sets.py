from fastapi import APIRouter, Depends, HTTPException
from app.services.database import get_db
from pydantic import BaseModel
from app.services.auth import get_current_user
from app.services.algorithm import calculate_weight_recommendation
from typing import Optional

router = APIRouter()

class SetCreate(BaseModel):
    exercise_id: int
    set_number: int
    weight_used: float
    reps_completed: int
    rpe: Optional[int] = None
    planned_set_id: Optional[int] = None

@router.post("/sets")
def create_set(set_data: SetCreate, current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        existing = db.execute(
            "SELECT id FROM exercises WHERE id = ?",
            (set_data.exercise_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=400, detail="Exercise does not exist")
        preference = db.execute(
            """SELECT target_rep_min, target_rep_max FROM user_exercise_preferences
            WHERE user_id = ? AND exercise_id = ?
            ORDER BY created_at DESC
            LIMIT 1""",
            (current_user["id"], set_data.exercise_id)
        ).fetchone()
        if not preference:
            raise HTTPException(status_code=400, detail="preferences must be set before logging a set")
        cursor = db.execute(
            """INSERT INTO sets (user_id, exercise_id, set_number, weight_used, reps_target_min, reps_target_max, reps_completed, rpe, planned_set_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (current_user["id"], set_data.exercise_id, set_data.set_number, set_data.weight_used, preference["target_rep_min"], preference["target_rep_max"], set_data.reps_completed, set_data.rpe, set_data.planned_set_id)
        )
        new_weight = calculate_weight_recommendation(
            db,
            current_user["id"],
            set_data.exercise_id,
            set_data.weight_used,
            set_data.reps_completed,
            preference["target_rep_min"],
            preference["target_rep_max"]
        )
        return {"id": cursor.lastrowid, "exercise_id": set_data.exercise_id, "weight_recommended_next": new_weight, "message": "Set logged successfully"}