from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from app.services.database import get_db
from app.services.auth import get_current_user

router = APIRouter()

class CycleLogCreate(BaseModel):
    cycle_start_date: str
    cycle_length_days: Optional[int] = None
    phase: Optional[str] = None
    notes: Optional[str] = None

def require_menstrual_tracking(current_user: dict, db):
    user = db.execute(
        "SELECT menstrual_tracking_enabled FROM users WHERE id = ?",
        (current_user["id"],)
    ).fetchone()
    if not user or not user["menstrual_tracking_enabled"]:
        raise HTTPException(status_code=403, detail="Menstrual tracking is not enabled for this account")

@router.post("/menstrual-cycle")
def log_cycle(entry: CycleLogCreate, current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        require_menstrual_tracking(current_user, db)

        cursor = db.execute(
            """INSERT INTO menstrual_cycle_log
            (user_id, cycle_start_date, cycle_length_days, phase, notes)
            VALUES (?, ?, ?, ?, ?)""",
            (current_user["id"], entry.cycle_start_date, entry.cycle_length_days,
             entry.phase, entry.notes)
        )

        new_entry = db.execute(
            "SELECT * FROM menstrual_cycle_log WHERE id = ?",
            (cursor.lastrowid,)
        ).fetchone()

        return dict(new_entry)

@router.get("/menstrual-cycle")
def get_cycle_log(current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        require_menstrual_tracking(current_user, db)

        entries = db.execute(
            """SELECT * FROM menstrual_cycle_log
            WHERE user_id = ?
            ORDER BY cycle_start_date DESC""",
            (current_user["id"],)
        ).fetchall()

        return [dict(e) for e in entries]
