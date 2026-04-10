-- Users
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    date_of_birth DATE,
    sex TEXT,
    bodyweight REAL,
    training_experience_years INTEGER,
    onboarding_complete BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Exercises
CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    target_rep_min INTEGER NOT NULL,
    target_rep_max INTEGER NOT NULL,
    muscle_group TEXT NOT NULL,
    created_by_user_id INTEGER,
    is_verified BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- User Exercise Preferences
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

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date DATE NOT NULL,
    sequence_number INTEGER NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Sets
CREATE TABLE IF NOT EXISTS sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    set_number INTEGER NOT NULL,
    weight_recommended REAL,
    weight_used REAL NOT NULL,
    reps_target_min INTEGER NOT NULL,
    reps_target_max INTEGER NOT NULL,
    reps_completed INTEGER NOT NULL,
    rpe REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

-- Planned Sets
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

-- User Exercise Metrics
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