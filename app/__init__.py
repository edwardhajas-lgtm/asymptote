from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.users import router as users_router
from app.routes.exercises import router as exercises_router
from app.routes.preferences import router as preferences_router
from app.routes.sets import router as sets_router
from app.routes.queue import router as queue_router

app = FastAPI(title="Asymptote")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users_router)
app.include_router(exercises_router)
app.include_router(preferences_router)
app.include_router(sets_router)
app.include_router(queue_router)