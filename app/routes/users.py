from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.database import get_db
from passlib.context import CryptContext

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserCreate(BaseModel):
    email: str
    password: str
    date_of_birth: str = None
    sex: str = None
    bodyweight: float = None
    training_experience_years: int = None

@router.post("/users")
def create_user(user: UserCreate):
    if len(user.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Password must be 72 characters or fewer")
    
    hashed_password = pwd_context.hash(user.password)
    
    with get_db() as db:
        existing = db.execute(
            "SELECT id FROM users WHERE email = ?",
            (user.email,)
        ).fetchone()
        
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        cursor = db.execute(
            """INSERT INTO users 
            (email, password_hash, date_of_birth, sex, bodyweight, training_experience_years)
            VALUES (?, ?, ?, ?, ?, ?)""",
            (user.email, hashed_password, user.date_of_birth, 
             user.sex, user.bodyweight, user.training_experience_years)
        )
        
        return {"id": cursor.lastrowid, "email": user.email, "message": "User created successfully"}