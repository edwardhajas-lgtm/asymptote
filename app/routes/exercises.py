from fastapi import APIRouter
from app.services.database import get_db

router = APIRouter()

@router.get("/exercises")
def get_exercises():
    with get_db() as db:
        exercises = db.execute("SELECT * FROM exercises").fetchall() #selects all exercises for the user
        return [dict(row) for row in exercises] #list comprehension, for each row in exercises convert it with dict(row) and collect all results to new list
    