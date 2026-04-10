from fastapi import APIRouter
from app.services.database import get_db

router = APIRouter()

@router.get("/health")
def health_check():
    with get_db() as db:
        db.execute("SELECT 1")
    return {"status": "ok", "app": "Asymptote", "database": "connected"}