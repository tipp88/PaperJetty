# DocuScan Project Guide

## Summary
- DocuScan is a privacy-first, mobile-first document scanning web app.
- Frontend: Vite + React + TypeScript, OpenCV.js for edge detection and perspective correction.
- Backend: FastAPI for PDF generation and Paperless-ngx integration.
- Primary workflow: camera capture -> edge detection -> corner adjustment -> enhancement -> export PDF / upload.

## Key Features
- Real-time edge detection with OpenCV.js and temporal smoothing.
- Manual corner adjustment with draggable handles.
- Perspective correction and image enhancement modes.
- Multi-page document workflow and PDF export.
- Paperless-ngx upload with metadata (tags, correspondent, document type).

## Repo Structure
- `frontend/`: React app (Vite, PWA, OpenCV.js in `public/opencv/`).
- `backend/`: FastAPI app (routers + services).
- `docker-compose.yml`: Separate frontend + backend.
- `docker-compose.standalone.yml`: Single container deployment with HTTPS.

## Local Development
Frontend:
```
cd frontend
npm install
npm run dev
```

Backend:
```
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m app.main
```

## Important Endpoints
- `GET /health`
- `POST /api/pdf/generate`
- `POST /api/pdf/estimate-size`
- `POST /api/paperless/upload`
- `GET /api/paperless/tags`
- `GET /api/paperless/correspondents`
- `GET /api/paperless/document-types`
- `GET/POST /api/settings`

## Configuration
- Backend settings via `.env` or environment variables in `backend/app/config.py`.
- Paperless integration via `PAPERLESS_URL`, `PAPERLESS_TOKEN`, `PAPERLESS_ENABLED`.
- Frontend API proxy set in `frontend/vite.config.ts` (`/api` -> backend).

## Notes
- OpenCV.js is loaded via `<script>` in `frontend/index.html` for reliability.
- Settings are stored in JSON on the backend (`/app/data/settings.json`).
- Version displayed in Settings modal comes from `frontend/package.json`.
