from fastapi import APIRouter, Depends, HTTPException
from app.services.database import get_db
from app.services.auth import get_current_user
from app.services.queue import generate_queue

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

@router.patch("/queue/{planned_set_id}/complete")
def complete_queue_item(planned_set_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        planned_set = db.execute(
            "SELECT id FROM planned_sets WHERE id = ? AND user_id = ?",
            (planned_set_id, current_user["id"])
        ).fetchone()

        if not planned_set:
            raise HTTPException(status_code=404, detail="Queue entry not found")

        db.execute(
            "UPDATE planned_sets SET completed = 1 WHERE id = ?",
            (planned_set_id,)
        )

        generate_queue(db, current_user["id"])

        return {"message": "Queue entry marked complete"}