from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.services.database import get_db
from app.services.auth import get_current_user
from app.services.algorithm import supports_1rm_tracking

router = APIRouter()

class OnermTrackingUpdate(BaseModel):
    enabled: bool

class ExerciseCreate(BaseModel):
    name: str
    target_rep_min: int
    target_rep_max: int
    muscle_group: str

@router.get("/exercises")
def get_exercises():
    with get_db() as db:
        exercises = db.execute(
            "SELECT id, name, target_rep_min, target_rep_max, muscle_group, is_verified FROM exercises ORDER BY name"
        ).fetchall()
        return [dict(e) for e in exercises]

@router.get("/exercises/{exercise_id}")
def get_exercise(exercise_id: int):
    with get_db() as db:
        exercise = db.execute(
            "SELECT id, name, target_rep_min, target_rep_max, muscle_group, is_verified FROM exercises WHERE id = ?",
            (exercise_id,)
        ).fetchone()
        
        if not exercise:
            raise HTTPException(status_code=404, detail="Exercise not found")
        
        return dict(exercise)

@router.post("/exercises")
def create_exercise(exercise: ExerciseCreate, current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        existing = db.execute(
            "SELECT id FROM exercises WHERE name = ?",
            (exercise.name,)
        ).fetchone()
        
        if existing:
            raise HTTPException(status_code=400, detail="Exercise already exists")
        
        cursor = db.execute(
            """INSERT INTO exercises 
            (name, target_rep_min, target_rep_max, muscle_group, created_by_user_id, is_verified)
            VALUES (?, ?, ?, ?, ?, 0)""",
            (exercise.name, exercise.target_rep_min, exercise.target_rep_max,
             exercise.muscle_group, current_user["id"])
        )
        
        return {"id": cursor.lastrowid, "name": exercise.name, "message": "Exercise created successfully"}

@router.patch("/exercises/{exercise_id}/1rm-tracking")
def set_1rm_tracking(exercise_id: int, body: OnermTrackingUpdate, current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        exercise = db.execute(
            "SELECT id, supports_1rm FROM exercises WHERE id = ?",
            (exercise_id,)
        ).fetchone()

        if not exercise:
            raise HTTPException(status_code=404, detail="Exercise not found")

        db.execute(
            """INSERT INTO user_algorithm_settings (user_id, setting_name, value)
            VALUES (?, ?, ?)""",
            (current_user["id"], f"1rm_tracking_exercise_{exercise_id}", int(body.enabled))
        )

        effective = supports_1rm_tracking(db, current_user["id"], exercise_id)
        source = "exercise_default" if exercise["supports_1rm"] else "user_override"

    return {
        "exercise_id": exercise_id,
        "enabled": effective,
        "source": source
    }