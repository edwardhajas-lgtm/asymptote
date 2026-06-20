from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.database import get_db
from passlib.context import CryptContext

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserCreate(BaseModel):
    email: str
    password: str

@router.post("/users")
def create_user(user: UserCreate):
    with get_db() as db:
        existing = db.execute(
            "SELECT id FROM users WHERE email = ?",
            (user.email,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        hashed_password = pwd_context.hash(user.password)
        cursor = db.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            (user.email, hashed_password)
        )
        return {"id": cursor.lastrowid, "email": user.email, "message": "User registered successfully"}