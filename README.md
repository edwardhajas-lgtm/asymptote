# Asymptote

A strength training app that works around your life, not the other way around.

## What it is

Asymptote removes the planning burden from working out. Set up your exercises once, log your numbers when you train, and the app handles everything else — scheduling, weight progression, and recovery.

There are no calendars, no missed workout reminders, and no subscription fees. Miss three weeks, open the app, and it shows you exactly what to do next. No judgment, no record of absence.

## The problem it solves

Rigid scheduling creates a record of failure. When you miss planned workouts, most apps show you empty sessions as a reminder of what you didn't do. That visual record of failure is a barrier to coming back.

Asymptote eliminates this with a rolling queue — not a calendar. There's no "Monday is chest day." There's just what's next, whenever you're ready.

## How it works

The app maintains a rolling queue of exercises based on your frequency settings. Each exercise shows the recommended weight and rep range calculated from your previous performance.

Two actions per exercise:
- **Log it** — enter weight and reps, exercise gets rescheduled automatically
- **Push it** — move it to next time, no input needed

The algorithm adjusts recommended weights after every logged session. It works with just weight and reps, and gets smarter with optional RPE input.

## Tech stack

- Backend: Python, FastAPI, SQLite
- Frontend: Plain HTML, CSS, JavaScript
- Auth: JWT
- Self hosted

## Philosophy

- The app works around the user's life, not the other way around
- Minimal required input — log weight and reps, the app handles everything else
- No advertisements, no subscription fees, no upsells
- Never overwhelm the user with choices
- A missed workout is irrelevant — the queue always shows what's next