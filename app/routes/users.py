from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.services.database import get_db
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordRequestForm
from app.services.auth import create_access_token

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

@router.post("/users/login")
def login(credentials: OAuth2PasswordRequestForm = Depends()):
    with get_db() as db:
        user = db.execute(
            "SELECT id, email, password_hash FROM users WHERE email = ?",
            (credentials.username,)
        ).fetchone()
        if not user or not pwd_context.verify(credentials.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        token = create_access_token(user["id"])
        return {"access_token": token, "token_type": "bearer"}