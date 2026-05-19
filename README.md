# English Word System

A simple MVP for memorizing English words.

## Stack

- Backend: FastAPI, SQLModel, PostgreSQL
- Database: Docker PostgreSQL for local development
- Frontend: React, Vite, TypeScript, Tailwind CSS

## Quick Start

### Database

```powershell
docker compose up -d postgres
```

Default database connection:

```text
postgresql+psycopg://postgres:postgres@localhost:5432/english_words
```

The backend reads this from:

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

## Frontend Routes

```text
/login       Login page
/register    Registration page
/dashboard   Home and today's task overview
/word-books  Word book selection and CSV import
/word-books/:id Word book detail, word list, and word management
/study       New word learning workflow
/review      Due review workflow
/mistakes    Mistake notebook
/quiz        Choice and spelling quiz
/stats       Learning statistics
/settings    Daily learning plan settings
```

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

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel + Render deployment steps.

## CSV Import Format

The CSV import feature is available on the word books page. Required columns:

```csv
word,meaning
```

Recommended full format:

```csv
word,phonetic,meaning,part_of_speech,example_sentence,example_translation
abandon,/əˈbændən/,放弃,v.,He abandoned the plan.,他放弃了这个计划。
ability,/əˈbɪləti/,能力,n.,She has the ability to solve problems.,她有解决问题的能力。
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
