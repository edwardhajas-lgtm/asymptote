from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.database import get_db
from app.services.auth import create_access_token
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

class UserLogin(BaseModel):
    email: str
    password: str

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

@router.post("/users/login")
def login(credentials: UserLogin):
    with get_db() as db:
        user = db.execute(
            "SELECT id, email, password_hash FROM users WHERE email = ? AND deleted_at IS NULL",
            (credentials.email,)
        ).fetchone()
        
        if not user or not pwd_context.verify(credentials.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        token = create_access_token(user["id"], user["email"])
        
        return {"access_token": token, "token_type": "bearer"}