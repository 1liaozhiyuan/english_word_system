# English Word System

A full-stack English vocabulary learning system with word books, spaced review,
quizzes, mistake review, favorites, speech practice, AI assistance, and data
backup/export tools.

## Stack

- Backend: FastAPI, SQLModel, PostgreSQL
- Database: Docker PostgreSQL for local development
- Frontend: React, Vite, TypeScript, Tailwind CSS

## Features

- User auth: register, login, password reset, and logged-in password change
- Word books: CSV import preview, import/export, pagination, search, edit, delete, and batch management
- Learning workflow: new word study, due review, configurable daily limits, auto advance, and answer delay
- Speech practice: browser text-to-speech, auto play, example reading, and US/UK accent preference
- Study modes: English-to-Chinese, Chinese-to-English, listening, and spelling
- Spaced review: mastery level, review interval, next review time, leech detection, and review history
- Mistakes and favorites: mistake notebook, batch practice, resolve mistakes, and favorite words
- Quiz: practice/formal mode, choice/spelling/mixed questions, and question sources from review/new/mistakes/favorites
- Statistics: overview metrics, activity heatmap, weekly accuracy, study history, and learning diagnosis
- Data tools: JSON backup export/import and Anki-compatible TSV export
- Optional AI: word explanation, example generation, mistake analysis, and quiz generation with streaming output

## Quick Start

### Database

```powershell
docker compose up -d postgres
```

Default database connection:

```text
postgresql+psycopg://postgres:postgres@localhost:5432/english_words
```

The backend reads database and app settings from:

```text
backend/.env
```

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

When the database schema changes, create a new migration:

```powershell
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

Backend API docs:

```text
http://127.0.0.1:8000/docs
```

Run backend tests:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m pytest
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://127.0.0.1:5173
```

Build frontend:

```powershell
cd frontend
npm run build
```

## Frontend Routes

```text
/login       Login page
/register    Registration page
/forgot-password Password reset request
/reset-password  Password reset page
/dashboard   Home and today's task overview
/word-books  Word book selection and CSV import
/word-books/:id Word book detail, word list, and word management
/study       New word learning workflow
/review      Due review workflow
/mistakes    Mistake notebook
/favorites   Favorite words
/quiz        Choice and spelling quiz
/stats       Learning statistics
/learning-settings Daily learning plan, speech, and account settings
/settings    Alias for learning settings
```

## Environment Variables

Create `backend/.env` from `backend/.env.example` and adjust values for your environment.

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/english_words
JWT_SECRET_KEY=change-this-secret-in-production
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
EXPOSE_RESET_TOKEN_IN_RESPONSE=true
```

For production, use a strong `JWT_SECRET_KEY` and set:

```env
EXPOSE_RESET_TOKEN_IN_RESPONSE=false
```

When this is `false`, the forgot-password API will not return the reset token in
the response. It is kept configurable so local development can still test the
reset flow before email delivery is integrated.

## AI Features

The app includes optional AI features:

- AI word explanation
- AI example generation
- AI mistake analysis
- AI quiz generation
- Streaming AI output
- In-memory AI result cache, cleared when the page is refreshed or closed

Add these values to `backend/.env`, then restart the backend:

```env
OPENAI_API_KEY=your_api_key_here
AI_MODEL=gpt-4o-mini
AI_BASE_URL=https://api.openai.com/v1
```

If you use another OpenAI-compatible provider, set `AI_BASE_URL` to that provider's `/v1` endpoint and set `AI_MODEL` to the model name it supports.

## Data Export and Restore

The stats page provides:

- JSON backup export for user settings, progress, favorites, and review logs
- JSON backup import to restore data into the current account
- Anki TSV export for importing learned words into Anki

Anki TSV columns:

```text
word, phonetic, meaning, part_of_speech, example, example_translation, note
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel + Render deployment steps.

## CSV Import Format

The CSV import feature is available on the word books page. Required columns:

```csv
word,meaning
```

Recommended full format:

```csv
word,phonetic,meaning,part_of_speech,example_sentence,example_translation,note
abandon,/əˈbændən/,放弃,v.,He abandoned the plan.,他放弃了这个计划。,常见搭配 abandon a plan
ability,/əˈbɪləti/,能力,n.,She has the ability to solve problems.,她有解决问题的能力。,名词
```

Save the file as UTF-8 CSV.

## Reset Local Database

This removes local PostgreSQL data:

```powershell
docker compose down -v
docker compose up -d postgres
cd backend
alembic upgrade head
```

## Demo Data

After the backend starts, demo words are seeded automatically if the database has no word books. Register any email and password, then select the starter word book.
