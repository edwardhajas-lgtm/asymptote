from fastapi import FastAPI
from app.routes.health import router as health_router
from app.routes.users import router as users_router
from app.routes.exercises import router as exercises_router
from app.routes.preferences import router as preferences_router

app = FastAPI(title="Asymptote")

app.include_router(health_router)
app.include_router(users_router)
app.include_router(exercises_router)
app.include_router(preferences_router)