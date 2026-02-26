# Stage 1: Frontend build
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend + serve frontend
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
RUN mkdir -p data/chroma data/uploads

WORKDIR /app/backend

ENV PORT=8000
EXPOSE 8000

CMD sh -c 'uvicorn app.main:app --host 0.0.0.0 --port ${PORT}'
