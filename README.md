# Fluent in 120 Days

A two-level English course, 30 minutes a day, for learners going from beginner/intermediate to upper-intermediate.
No backend, no install, no writing homework: all progress is saved in your browser's `localStorage`.

## Run it
Open `index.html`, or serve the folder:

```
python -m http.server 5174
```
then open http://localhost:5174

## Levels
- **Level 1 (Days 1–60):** review 3 · vocabulary 7 · grammar 8 · speaking 8 · quiz 4
- **Level 2 (Days 61–120):** review 3 · vocabulary 6 · grammar + quiz 6 · listening 6 · speaking 9

Listening audio uses your browser's built-in text-to-speech.

## Structure
- `data/lessons-1..4.js` – Level 1 lessons
- `data/lessons-5..8.js` – Level 2 lessons
- `app.js` – dashboard, day view, timer, quizzes, streaks, backup/import
- `styles.css`, `index.html`

Back up your progress from the dashboard (Export backup) because clearing browser data erases it.
