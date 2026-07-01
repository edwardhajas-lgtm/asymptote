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

        result = []
        for item in queue:
            item_dict = dict(item)

            preference = db.execute(
                """SELECT training_split, target_rep_min, target_rep_max, target_sets_per_session FROM user_exercise_preferences
                WHERE user_id = ? AND exercise_id = ?
                ORDER BY created_at DESC
                LIMIT 1""",
                (current_user["id"], item_dict["exercise_id"])
            ).fetchone()

            if preference:
                item_dict["training_split"] = preference["training_split"]
                item_dict["target_rep_min"] = preference["target_rep_min"]
                item_dict["target_rep_max"] = preference["target_rep_max"]
                item_dict["target_sets_per_session"] = preference["target_sets_per_session"]
            else:
                item_dict["training_split"] = None
                item_dict["target_rep_min"] = None
                item_dict["target_rep_max"] = None
                item_dict["target_sets_per_session"] = None

            result.append(item_dict)

        return result

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

@router.patch("/queue/{planned_set_id}/push")
def push_queue_item(planned_set_id: int, current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        planned_set = db.execute(
            "SELECT id FROM planned_sets WHERE id = ? AND user_id = ?",
            (planned_set_id, current_user["id"])
        ).fetchone()

        if not planned_set:
            raise HTTPException(status_code=404, detail="Queue entry not found")

        highest = db.execute(
            "SELECT MAX(planned_order) as max_order FROM planned_sets WHERE user_id = ? AND completed = 0",
            (current_user["id"],)
        ).fetchone()

        new_order = highest["max_order"] + 1

        db.execute(
            "UPDATE planned_sets SET planned_order = ? WHERE id = ?",
            (new_order, planned_set_id)
        )

        return {"message": "Queue entry pushed to back"}