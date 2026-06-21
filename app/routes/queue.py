from fastapi import APIRouter, Depends
from app.services.database import get_db
from app.services.auth import get_current_user

router = APIRouter()

@router.get("/queue")
def get_queue(current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        queue = db.execute(
            """SELECT * FROM planned_sets
            WHERE user_id = ? AND completed = 0
            ORDER BY planned_order""",
            (current_user["id"],)
        ).fetchall()
        return [dict(row) for row in queue]