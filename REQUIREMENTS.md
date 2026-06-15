Asymptote — Product Requirements Document
Version 1.0

Product overview
Asymptote is a strength training app that removes the planning burden from working out. Users set up their exercises once, log their numbers when they train, and the app handles everything else — scheduling, weight progression, and recovery. There are no calendars, no missed workout reminders, and no subscription fees.

Mission
Most workout apps help people grow physically by keeping them on a rigid routine. Asymptote helps people grow physically without sacrificing their mental health. A missed workout is not a failure — it's just a gap. The queue picks up exactly where you left off, no guilt attached.

Target user
Someone who wants to train consistently but can't always predict their schedule. They may be dealing with work stress, mental health fluctuations, travel, or just life in general. They are not interested in optimizing every variable of their training — they want to show up, do the work, and leave. They are skeptical of subscription fees and don't want to be sold to inside an app they're already using.
They are not necessarily beginners in terms of physical capability, but they are beginners in terms of wanting simplicity. They don't want to think. They want to be told what to do next.

The core problem
Rigid scheduling creates a record of failure. When a user misses three weeks of planned workouts, every other app shows them three weeks of empty sessions. That visual record of failure is a barrier to returning. Asymptote eliminates this by having no fixed schedule — only a rolling queue of what's next. Miss three weeks, open the app, and it simply shows you what to do today. No judgment, no history of absence.

Core philosophy
The app works around the user's life, not the other way around
A missed workout is irrelevant — the queue always shows what's next
Minimal required input — log weight and reps, the app handles everything else
No advertisements, no subscription fees, no upsells
The app gets smarter the more you use it, but works well from day one
Never overwhelm the user with choices

Core features
The queue
 A rolling list of exercises the user needs to complete based on their weekly frequency settings. Always shows the current session's work. No dates shown. No calendar view. Just what to do next.
Two actions per exercise:
Log it — enter weight and reps, exercise gets rescheduled based on frequency
Push it — move it to the next session, no input required
When the user is done training they close the app. No end session button. No completion ceremony. Just done.
Auto-regulation algorithm
 Adjusts recommended weight after every logged session based on actual performance. Works with minimal input — weight and reps only — and gets more accurate with optional RPE input. Two modes:
Simple mode — user logs weight and reps only. Algorithm adjusts based on whether they hit their target rep range.
Full mode — user also logs RPE. Algorithm uses weighted RPE calculation with position-squared weighting, fatigue rate detection, and failure analysis.
Failure handling
 Two distinct responses:
Acute failure — bad session, weight was too heavy → reset to percentage of estimated 1RM
Chronic fatigue — RPE trending upward over weeks → recommend deload week
Personal records
 Automatically detected and stored after every logged set. No user input required.
Forecast
 Optional view showing upcoming exercises in queue order. Not a calendar — just the list of what's coming.

What Asymptote is not
Not a social app — no leaderboards, no sharing (friend system is a future consideration)
Not a coaching app — it doesn't tell you what exercises to do, only when and how much
Not a subscription service — free to use
Not a calendar app — no fixed dates, no missed workout tracking
Not overwhelming — every screen should feel simple enough that a first time user knows what to do without instructions

Data philosophy
Never delete user data — soft deletes only
Store everything at the raw set level — never aggregate prematurely
User data may be used in anonymized research with explicit consent
Sensitive data (menstrual cycle tracking) is strictly opt-in and stored separately

Technical requirements
Backend: Python, FastAPI, SQLite (PostgreSQL for production)
Frontend: Plain HTML, CSS, JavaScript — no framework
Authentication: JWT
Hosting: Self hosted on home server or Hetzner VPS
Mobile responsive from day one — primary use case is logging on a phone at the gym

Out of scope for version 1
Social features
Wearable integration
Menstrual cycle tracking UI (schema exists, UI deferred)
Wellness inputs (readiness, sleep, stress) — deferred until core loop is working
Shock sessions / Go Nuts feature — deferred
1RM testing workflow — deferred
Push notifications
Offline mode

Success metrics
A successful Asymptote user has been able to fit workouts around their life without having to plan their life around their workouts. They return to the app after a gap — days, weeks, or months — and pick up exactly where they left off without friction.


