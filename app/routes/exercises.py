from fastapi import APIRouter, Depends, HTTPException
from app.services.database import get_db
from pydantic import BaseModel
from app.services.auth import get_current_user

router = APIRouter()

class ExerciseCreate(BaseModel):
    name: str
    muscle_group: str

@router.get("/exercises")
def get_exercises():
    with get_db() as db:
        exercises = db.execute("SELECT * FROM exercises").fetchall() #selects all exercises for the user
        return [dict(row) for row in exercises] #list comprehension, for each row in exercises convert it with dict(row) and collect all results to new list

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
            """INSERT INTO exercises (name, muscle_group, exercise_type, supports_1rm, created_by_user_id, is_verified) 
            VALUES (?, ?, ?, ?, ?, ?)""",
            (exercise.name, exercise.muscle_group, "weighted", 0, current_user["id"], 0)
        )
        return {"id": cursor.lastrowid, "name": exercise.name, "message": "Exercise created successfully"}