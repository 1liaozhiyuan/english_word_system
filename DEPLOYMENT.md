# Deployment Guide

This project has three deployable parts:

- Frontend: React + Vite
- Backend: FastAPI
- Database: PostgreSQL

Recommended beginner-friendly deployment:

- Frontend: Vercel
- Backend: Render
- Database: Render PostgreSQL

## 1. Push To GitHub

Create a GitHub repository and push this project.

Do not commit local secrets:

- `backend/.env`
- frontend local `.env`
- `.venv`
- `node_modules`
- `dist`

## 2. Deploy Backend On Render

Create a PostgreSQL database on Render first.

Then create a Web Service:

- Root Directory: `backend`
- Runtime: `Python`
- Build Command:

```bash
pip install -r requirements.txt
```

- Start Command:

```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Set these environment variables:

```env
DATABASE_URL=your_render_postgres_external_or_internal_url
JWT_SECRET_KEY=replace-with-a-long-random-secret
CORS_ORIGINS=https://your-frontend.vercel.app
OPENAI_API_KEY=
AI_MODEL=gpt-4o-mini
AI_BASE_URL=https://api.openai.com/v1
```

Notes:

- The backend accepts `postgres://`, `postgresql://`, and `postgresql+psycopg://` URLs.
- `JWT_SECRET_KEY` must be changed before production use.
- `CORS_ORIGINS` must contain your final frontend URL.

After deploy, open:

```text
https://your-backend.onrender.com/health
```

Expected response:

```json
{"status":"ok"}
```

## 3. Deploy Frontend On Vercel

Create a new Vercel project from the same GitHub repository.

Settings:

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Build Command:

```bash
npm run build
```

- Output Directory:

```text
dist
```

Set this environment variable:

```env
VITE_API_BASE_URL=https://your-backend.onrender.com
```

The included `frontend/vercel.json` makes React Router pages work after refresh.

## 4. Update Backend CORS

After Vercel gives you the frontend URL, copy it into Render:

```env
CORS_ORIGINS=https://your-project.vercel.app
```

Redeploy or restart the backend.

## 5. Test Online

Test in this order:

1. Open the Vercel frontend URL.
2. Register a new account.
3. Log in.
4. Select a word book.
5. Start learning words.
6. Refresh the page and check that data remains.
7. Import a CSV word book.
8. Delete a word book.
9. If AI is configured, test AI explanation and AI quiz generation.

## 6. Optional Custom Domain

You can use the free Vercel domain first.

Later, bind a custom domain:

- Frontend: `https://www.yourdomain.com`
- Backend: `https://api.yourdomain.com`

If you add a custom frontend domain, update backend `CORS_ORIGINS`.
