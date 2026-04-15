from fastapi import FastAPI
from app.routes.health import router as health_router
from app.routes.users import router as users_router
from app.routes.exercises import router as exercises_router
from app.routes.preferences import router as preferences_router
from app.routes.sessions import router as sessions_router
from app.routes.settings import router as settings_router
from app.routes.metrics import router as metrics_router

app = FastAPI(title="Asymptote")

app.include_router(health_router)
app.include_router(users_router)
app.include_router(exercises_router)
app.include_router(preferences_router)
app.include_router(sessions_router)
app.include_router(settings_router)
app.include_router(metrics_router)