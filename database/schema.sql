CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    date_of_birth DATE,
    sex TEXT,
    bodyweight REAL,
    training_experience_years INTEGER,
    onboarding_complete BOOLEAN DEFAULT 0,
    tracking_preset TEXT DEFAULT 'simple',
    training_goal TEXT DEFAULT 'fitness',
    is_public BOOLEAN DEFAULT 0,
    menstrual_tracking_enabled BOOLEAN DEFAULT 0,
    data_research_consent BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    target_rep_min INTEGER NOT NULL,
    target_rep_max INTEGER NOT NULL,
    muscle_group TEXT NOT NULL,
    exercise_type TEXT DEFAULT 'weighted',
    supports_1rm BOOLEAN DEFAULT 0,
    created_by_user_id INTEGER,
    is_verified BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_exercise_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    target_sets_per_session INTEGER NOT NULL DEFAULT 3,
    target_sessions_per_week INTEGER NOT NULL DEFAULT 1,
    estimated_1rm REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_datetime TIMESTAMP NOT NULL,
    sequence_number INTEGER NOT NULL,
    session_type TEXT DEFAULT 'normal',
    readiness_score INTEGER,
    stress_level INTEGER,
    sleep_hours REAL,
    sleep_quality INTEGER,
    notes TEXT,
    completed_at TIMESTAMP,
    shock_screen_viewed BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    set_number INTEGER NOT NULL,
    weight_recommended REAL,
    weight_used REAL,
    reps_target_min INTEGER NOT NULL,
    reps_target_max INTEGER NOT NULL,
    reps_completed INTEGER,
    duration_seconds INTEGER,
    rpe REAL,
    fatigue_index REAL,
    failed_reps INTEGER DEFAULT 0,
    pain_flag BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

CREATE TABLE IF NOT EXISTS planned_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    planned_date DATE,
    exercise_id INTEGER NOT NULL,
    set_number INTEGER NOT NULL,
    weight_recommended REAL,
    reps_target_min INTEGER NOT NULL,
    reps_target_max INTEGER NOT NULL,
    generated_from_set_id INTEGER,
    completed BOOLEAN DEFAULT 0,
    actual_set_id INTEGER,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (exercise_id) REFERENCES exercises(id),
    FOREIGN KEY (generated_from_set_id) REFERENCES sets(id),
    FOREIGN KEY (actual_set_id) REFERENCES sets(id)
);

CREATE TABLE IF NOT EXISTS user_exercise_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    metric_type TEXT NOT NULL,
    value REAL NOT NULL,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

CREATE TABLE IF NOT EXISTS user_algorithm_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    setting_name TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS menstrual_cycle_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    cycle_start_date DATE NOT NULL,
    cycle_length_days INTEGER,
    phase TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);