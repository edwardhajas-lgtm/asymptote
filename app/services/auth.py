from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import HTTPException, Header
from app.services.database import get_db

SECRET_KEY = "asymptote-secret-key-change-this-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

def create_access_token(user_id: int, email: str):
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": expire
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(authorization: str = Header(...)):
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        
        with get_db() as db:
            user = db.execute(
                "SELECT id, email FROM users WHERE id = ? AND deleted_at IS NULL",
                (user_id,)
            ).fetchone()
            
            if not user:
                raise HTTPException(status_code=401, detail="User not found")
            
            return dict(user)
    
    except (JWTError, ValueError, AttributeError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")