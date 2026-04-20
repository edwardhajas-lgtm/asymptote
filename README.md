Project: Asymptote
GitHub: edwardhajas-lgtm/asymptote
What it is:
An auto-regulation strength training app that adjusts workout recommendations based on actual performance, not a fixed program. The name reflects the concept that your 1RM is an asymptote — a theoretical maximum you perpetually approach but never reach.

Core philosophy:

Algorithm always works from real data only — what the user actually lifted, never what was planned
Fully functional with minimal input — just weight and reps is enough
Every additional input (RPE, readiness, stress, sleep) makes it smarter but is never required
The app suggests, the user decides — every default is overridable
Never delete data — soft deletes only, full history preserved forever
Store everything now, use it later


Tech stack:

Backend: Python, FastAPI, SQLite (PostgreSQL when self hosted)
Auth: JWT via OAuth2PasswordBearer
Self hosted on Hetzner VPS with Nginx, Let's Encrypt SSL, systemd
Frontend: not yet built, mobile responsive from day one


Database schema — 9 tables:
sqlusers:
- id, email, password_hash, date_of_birth, sex, bodyweight
- training_experience_years, onboarding_complete
- tracking_preset (simple/full/custom), training_goal (strength/fitness/movement)
- is_public, menstrual_tracking_enabled, data_research_consent
- created_at, deleted_at

exercises:
- id, name, target_rep_min, target_rep_max, muscle_group
- exercise_type (weighted/bodyweight/timed)
- supports_1rm (boolean — true for main compound lifts)
- created_by_user_id (null = global), is_verified, created_at

user_exercise_preferences:
- id, user_id, exercise_id
- target_sets_per_session, target_sessions_per_week, estimated_1rm
- created_at, updated_at
- Always insert new records, never overwrite — full history preserved

sessions:
- id, user_id, session_datetime, sequence_number
- session_type (normal/deload/shock/1rm_attempt)
- readiness_score (1/2/3 — both in it / one or other / neither)
- stress_level (1/2/3), sleep_hours, sleep_quality (1/2/3)
- notes, completed_at, created_at

sets:
- id, session_id, exercise_id, set_number
- weight_recommended, weight_used
- reps_target_min, reps_target_max, reps_completed
- duration_seconds (for timed exercises)
- rpe, fatigue_index, failed_reps, pain_flag
- created_at

planned_sets:
- id, user_id, planned_date, exercise_id, set_number
- weight_recommended, reps_target_min, reps_target_max
- generated_from_set_id, completed, actual_set_id, generated_at

user_exercise_metrics:
- id, user_id, exercise_id, metric_type, value, calculated_at
- Flexible key-value store for all calculated metrics
- metric_types include: estimated_1rm, measured_1rm, weighted_rpe,
  fatigue_rate, tonnage, personal_record, pr_Nrm, estimated_1rm_pr,
  recovery_hours, rpe_drift

user_algorithm_settings:
- id, user_id, setting_name, value, updated_at
- Flexible key-value store for all user overrides
- setting_names include: deload_lookback_weeks (default 5),
  deload_rpe_threshold (default 0.5), deload_volume_reduction (default 0.5),
  deload_intensity_reduction (default 0.2), reset_percentage (default 0.70),
  1rm_tracking_exercise_{id} (per exercise 1RM override),
  track_rpe, track_readiness, track_failed_reps, track_measured_1rm

menstrual_cycle_log:
- id, user_id, cycle_start_date, cycle_length_days, phase, notes, created_at
- Strictly opt-in, stored separately, independent deletion capability

Algorithm — app/services/algorithm.py:
Tunable constants (all at top of file):
pythonK_FATIGUE_MODIFIER = 0        # inert until tuned with real data
TARGET_FATIGUE_RATE = 0.75
RESET_PERCENTAGE = 0.70
SIMPLE_MODE_INCREASE = 1.03
SIMPLE_MODE_DECREASE = 0.95
RPE multiplier curve:
pythonRPE_MULTIPLIERS = {
    5: 2.0,
    6: 1.5,
    7: 1.15,
    8: 1.05,
    9: 1.01,
    10: 0.90
}
Session aggregation formula:

Position-squared weighting: set 1 weight=1, set 2 weight=4, set 3 weight=9, set 4 weight=16
weighted_rpe = sum(rpe × position²) / sum(position²)
fatigue_rate = (last_rpe - first_rpe) / number_of_sets
final_multiplier = base_multiplier × (1 + (target_fatigue_rate - actual_fatigue_rate) × K)
next_weight = weight_used × final_multiplier (always weight_used, never estimated_1rm)

Two modes:

Simple mode (tracking_preset = 'simple' or no RPE logged) → weight_used × SIMPLE_MODE_INCREASE
Full mode → RPE weighted calculation

Failure detection — three scenarios:

Bad session: any set below reps_target_min + readiness=3, or (readiness=2 and stress=3), or (sleep_quality=3 and stress=3) → hold weight steady
Genuine failure: reps missed + wellness fine + no RPE drift → reset to RESET_PERCENTAGE of estimated_1rm
Chronic fatigue: reps missed + RPE drift detected → recommend deload (not a reset)

Deload detection:

Look back N weeks (default 5, user configurable via user_algorithm_settings)
Calculate average weighted_rpe per week
If weekly average increases by 0.5+ across 3 consecutive weeks → deload_recommended = true
Deload is a notification/recommendation, never automatic
Deload prescription: same exercises, same frequency, 40-50% volume reduction, 20% intensity reduction
After deload: return to previous weights, not a reset

Readiness modulation:

Null or 1 → assume fully ready, proceed normally
2 → potential bad session signal, conservative
3 → bad session confirmed, hold weight

PR tracking:

Per rep count: pr_Nrm metric type (e.g. pr_6rm = heaviest weight for 6 reps)
Estimated 1RM PR: checked before storing new estimated_1rm, only for exercises where supports_1rm is true or user has enabled override
Measured 1RM: entered manually by user, stored separately

Metrics stored after every session:

weighted_rpe, fatigue_rate, tonnage, estimated_1rm
pr_Nrm for each set that sets a new record
estimated_1rm_pr flag when applicable
recovery_hours (to be built)

1RM attempt recommendation engine (to be built):

Suggest when: RPE trend consistently low, wave cycle at peak, readiness = 1, N weeks since last measured 1RM


Endpoints built:
POST   /users                    — register
POST   /users/login              — login (OAuth2PasswordRequestForm)
GET    /exercises                — list all exercises
GET    /exercises/{id}           — get one exercise
POST   /exercises                — create custom exercise (auth required)
GET    /preferences              — get user preferences (auth required)
POST   /preferences              — set exercise preferences (auth required)
POST   /sessions                 — create session (auth required)
GET    /sessions                 — get session history (auth required)
POST   /sessions/{id}/sets       — log a set (auth required)
GET    /sessions/{id}/sets       — get sets for session (auth required)
PATCH  /sessions/{id}/complete   — complete session, runs algorithm (auth required)
GET    /health                   — health check with db connectivity

Endpoints still to build:
PATCH  /users/me                 — update user profile
PATCH  /preferences/{id}        — update exercise preferences
POST   /settings                 — set algorithm setting
GET    /settings                 — get user algorithm settings
PATCH  /exercises/{id}/1rm-tracking — toggle 1RM tracking per exercise
GET    /metrics/{exercise_id}    — get metrics history for exercise
GET    /metrics/prs              — get all personal records
POST   /sessions/{id}/measured-1rm — log a measured 1RM attempt
GET    /forecast                 — get upcoming planned sessions
POST   /sessions/bulk            — bulk log multiple sessions sequentially
GET    /sessions/{id}/complete-shock — complete shock session (shows Tom Platz quote)

Algorithm still to build:

Simple mode rep-based adjustment (currently uses SIMPLE_MODE_INCREASE flat rate)
Recovery time estimation per muscle group
Session type awareness — shock sessions excluded from algorithm calculations
Deload prescription generation — actual planned_sets at reduced volume/intensity
Weekly schedule generation from user_exercise_preferences
Muscle group conflict avoidance in scheduling
Planned sets generation and dynamic recalculation
Bulk logging sequential processing
1RM attempt recommendation engine


Special features:

Go nuts / shock session — random high volume session to shock the system, inspired by Arnold Schwarzenegger. session_type = 'shock'. Excluded from algorithm calculations.
Tom Platz quote displayed after shock session completion: "Congratulations. Failure has been achieved. Thank God. Now, the only place to go from failure, is to win." Shown once only on first completion screen.
Forecast and print view — user can see upcoming planned sessions and print them to fill in manually, algorithm recalculates dynamically when real data comes in
Bulk logging — user logs multiple past sessions at once, processed sequentially so each session informs the next


Design decisions locked in:

Always build recommendations from weight_used, never estimated_1rm
Store every set individually, never aggregate prematurely
Soft deletes only, timestamps on everything
Algorithm defaults to state 1 (fully ready) when readiness is null — missing data never penalizes users
Deload lookback window defaults to 5 weeks, user configurable
Deload trigger: 0.5 RPE increase across 3 consecutive weeks
Deload prescription: same frequency, 40-50% volume reduction, 20% intensity reduction, opt-in notification not automatic
session_type field distinguishes normal/deload/shock/1rm_attempt — shock sessions excluded from algorithm
supports_1rm is per-exercise flag with user-level overrides in user_algorithm_settings
Dual mode algorithm: simple (weight + reps only) vs full (RPE + wellness)
Three tracking presets: simple / full / custom
Goal-based defaults (strength/fitness/movement) with full user override via user_algorithm_settings
Go nuts shock session feature — Arnold inspired, Tom Platz quote on completion
Optional sensitive wellness tracking with strict opt-in privacy controls
Menstrual cycle tracking strictly opt-in, stored separately, independent deletion
data_research_consent flag — explicit user consent for anonymized data use in research
is_public flag for future social features, default false
