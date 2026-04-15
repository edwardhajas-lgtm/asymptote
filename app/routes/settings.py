from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.services.database import get_db
from app.services.auth import get_current_user
from app.services.algorithm import get_user_algorithm_setting

router = APIRouter()

KNOWN_SETTINGS = {
    "deload_volume_reduction":    {"type": float, "min": 0.0, "max": 1.0,  "default": 0.5},
    "deload_intensity_reduction": {"type": float, "min": 0.0, "max": 1.0,  "default": 0.2},
    "reset_percentage":           {"type": float, "min": 0.0, "max": 1.0,  "default": 0.70},
    "deload_lookback_weeks":      {"type": int,   "min": 1,   "max": 52,   "default": 5},
}


class SettingUpdate(BaseModel):
    setting_name: str
    value: float


@router.post("/settings")
def update_setting(setting: SettingUpdate, current_user: dict = Depends(get_current_user)):
    if setting.setting_name not in KNOWN_SETTINGS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown setting '{setting.setting_name}'. Valid settings: {list(KNOWN_SETTINGS.keys())}"
        )

    config = KNOWN_SETTINGS[setting.setting_name]
    if not (config["min"] <= setting.value <= config["max"]):
        raise HTTPException(
            status_code=400,
            detail=f"Value must be between {config['min']} and {config['max']}"
        )

    with get_db() as db:
        db.execute(
            "INSERT INTO user_algorithm_settings (user_id, setting_name, value) VALUES (?, ?, ?)",
            (current_user["id"], setting.setting_name, str(setting.value))
        )

    return {"setting_name": setting.setting_name, "value": setting.value}


@router.get("/settings")
def get_settings(current_user: dict = Depends(get_current_user)):
    with get_db() as db:
        result = []
        for name, config in KNOWN_SETTINGS.items():
            value = get_user_algorithm_setting(db, current_user["id"], name, config["default"])
            result.append({
                "name": name,
                "value": value,
                "default": config["default"],
                "is_custom": value != config["default"],
            })
        return result
