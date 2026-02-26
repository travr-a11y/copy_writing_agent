# CopyWrite - Production Deployment Guide

## Error Fix: Backend Startup

**Issue:** `ModuleNotFoundError: No module named 'pkg_resources'`

The `textstat` package (used for readability scoring) depends on `pkg_resources` from `setuptools`. In Python 3.12+ with newer setuptools, this can fail. **Fix:** `setuptools>=70.0.0,<71.0.0` has been added to `backend/requirements.txt`.

**Local fix:** Run `pip install "setuptools>=70.0.0,<71.0.0"` in your backend venv, or reinstall: `pip install -r requirements.txt`.

---

## Deploy to Railway

### 1. Push to GitHub

```bash
git add .
git commit -m "Production ready: fix pkg_resources, add Railway config"
git remote add origin https://github.com/YOUR_USERNAME/copy_write_MVP.git
git push -u origin main
```

### 2. Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. **New Project** → **Deploy from GitHub repo**
3. Select your `copy_write_MVP` repository
4. Railway will auto-detect the Dockerfile and deploy

### 3. Configure Environment Variables

In Railway → your service → **Variables**, add:

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |
| `GEMINI_API_KEY` | No | For research features |
| `PERPLEXITY_API_KEY` | No | For research features |

### 4. Generate Domain

1. In your service → **Settings** → **Networking**
2. Click **Generate Domain**
3. Your app will be live at `https://your-app.up.railway.app`

### 5. Data Persistence (Optional)

Railway uses ephemeral storage by default. For persistent SQLite/ChromaDB:

1. Add a **Volume** to your service
2. Mount path: `/app/backend/data`
3. This persists campaigns, documents, and embeddings across deploys

---

## Architecture

- **Single service:** Backend (FastAPI) serves the built React frontend
- **Build:** Docker multi-stage – Node builds frontend, Python runs backend
- **API:** `/api/*` routes; static SPA at `/`
- **Health check:** `/api/health`

---

## Local Production Build (Test)

```bash
# Build Docker image
docker build -t copywrite .

# Run (set ANTHROPIC_API_KEY)
docker run -p 8000:8000 -e ANTHROPIC_API_KEY=your-key copywrite

# Open http://localhost:8000
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails on `npm ci` | Ensure `frontend/package-lock.json` exists; run `npm install` in frontend |
| `pkg_resources` error | Reinstall: `pip install -r requirements.txt` |
| API timeout in browser | Backend not running; check Railway logs |
| CORS errors | Backend CORS includes `*.railway.app`; verify your domain |
