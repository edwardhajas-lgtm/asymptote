from fastapi import FastAPI
from app.routes.users import router as users_router

app = FastAPI(title = "Asymptote")
app.include_router(users_router)