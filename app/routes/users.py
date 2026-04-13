from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.services.database import get_db
from app.services.auth import create_access_token
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordRequestForm
from typing import Optional
from app.services.auth import get_current_user

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

class UserUpdate(BaseModel):
    date_of_birth: Optional[str] = None
    sex: Optional[str] = None
    bodyweight: Optional[float] = None
    training_experience_years: Optional[int] = None
    tracking_preset: Optional[str] = None
    training_goal: Optional[str] = None

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
def login(credentials: OAuth2PasswordRequestForm = Depends()):
    with get_db() as db:
        user = db.execute(
            "SELECT id, email, password_hash FROM users WHERE email = ? AND deleted_at IS NULL",
            (credentials.username,)
        ).fetchone()
        
        if not user or not pwd_context.verify(credentials.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        token = create_access_token(user["id"], user["email"])
        
        return {"access_token": token, "token_type": "bearer"}

@router.patch("/users/me")
def update_user(user: UserUpdate, current_user: dict = Depends(get_current_user)):
    updates = {k: v for k, v in user.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail = "No fields provided")
    fields = ", ".join(f"{k} = ?" for k in updates)                              
    values = list(updates.values()) + [current_user["id"]]
                                                                                   
    with get_db() as db:
        db.execute(f"UPDATE users SET {fields} WHERE id = ?", values)
        updated = db.execute(                                                    
            "SELECT id, email, date_of_birth, sex, bodyweight, training_experience_years, tracking_preset, training_goal FROM users WHERE id = ?",             
            (current_user["id"],)                                                
        ).fetchone()
        return dict(updated)