# DocuScan - Privacy-First Document Scanner

A self-hosted, mobile-first web application for scanning documents with real-time edge detection, manual corner adjustment, perspective correction, and seamless integration with Paperless-ngx.

![Design Preview](https://img.shields.io/badge/Design-Precision_Instrument-fbbf24?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Active-5cb576?style=for-the-badge)
![Version](https://img.shields.io/badge/Version-1.3.4-blue?style=for-the-badge)

---

## 🌟 Key Features

### 📸 Smart Capture & Processing
- **High-Resolution Scanning**: High-quality document captures using device camera streams up to 4K.
- **Smart Auto-Capture**: Computer vision-based automatic capture triggered when document boundary stability and confidence thresholds are sustained.
- **Occlusion-Free Corner Magnifier**: Draggable corner adjustment handles displaying a zoomed preview. To avoid hand occlusion near the top boundary, the magnifier shifts horizontally to the side and clamps strictly to the screen margin.
- **Clockwise Normalized Corners**: Draggable boundary markers are ordered and clamped inside the frame coordinates to prevent duplicate points or handles slipping off-screen.
- **OpenCV.js Processing**: Warp perspective transformation, contrast correction, and image enhancements executed client-side.

### 📚 Multi-Document Batch Queue
- **"Finish Doc & New" Workflow**: Save pages to the active document and immediately queue it, instantly returning to the camera feed to capture the next file.
- **Batch Uploader**: Progress-tracked sequential batch uploader. Individual upload errors are reported on-screen, allowing the batch process to continue for the remaining items.
- **Metadata Editor**: Assign unique titles, modify tags, download individual PDFs, or delete elements from the persistent queue list.
- **Zustand Persistence**: Queue items are stored in the browser's local state via a Zustand compatibility layer, safeguarding scanned documents against accidental page reloads or tab closures.

### 🔒 Privacy-First & Self-Hosted
- **Local Network execution**: All scanning, cropping, and PDF compilation occurs on your browser and local network. Documents are never transmitted to third-party clouds.
- **PWA Ready**: Can be installed directly on mobile home screens as a Progressive Web App (PWA) with offline asset caching.

---

## 🛠️ Architecture Overview

DocuScan is structured to run as lightweight, stateless containerized services:
- **Frontend**: Single-page application built on Vite + React + TypeScript. Heavy computer vision tasks (contour finding, warping) are delegated to OpenCV.js.
- **Backend**: Python FastAPI service providing PDF assembly (using `reportlab` and `pdf-lib`) and secure proxies for Paperless-ngx.
- **Database/Storage**: Stateless backend; settings are saved in a JSON file locally, and the document queue is stored client-side.

---

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ (optional, for local development)
- Python 3.11+ (optional, for local development)

### 1. Production Docker Deploy (Recommended)
For production environments, run the pre-built single-container Docker image containing built-in HTTPS support (required by modern mobile browsers for camera API permissions):

```bash
# Pull the latest release
docker pull ghcr.io/tipp88/docu_scan:latest

# Deploy container with persistent volume mapping
docker run -d \
  -p 8443:443 \
  -p 8080:80 \
  -v /opt/docuscan-data:/app/data \
  --name docuscan \
  --restart unless-stopped \
  ghcr.io/tipp88/docu_scan:latest
```

> [!IMPORTANT]
> Because mobile browsers restrict camera access (getUserMedia) to secure origins, you must access the app using HTTPS (`https://<your-server-ip>:8443`). You will be prompted with a self-signed certificate warning; select "Proceed" to continue.

---

## ⚙️ Configuration

### Environment Variables
Configure the application by creating a `.env` file from the template:
```bash
cp .env.example .env
```

#### Backend Settings
- `BACKEND_HOST`: Local interface to bind backend server (e.g. `0.0.0.0`)
- `BACKEND_PORT`: Port to run backend (e.g. `8080`)
- `BACKEND_CORS_ORIGINS`: Allowed client origins (e.g. `http://localhost:5173`)

#### Paperless-ngx Settings
- `PAPERLESS_ENABLED`: Set to `true` to enable direct uploading.
- `PAPERLESS_URL`: Full address of your Paperless-ngx instance (e.g., `http://192.168.178.113:8000`).
- `PAPERLESS_TOKEN`: Your Paperless API token (generated from Paperless → Settings → API Tokens).
- `PAPERLESS_DEFAULT_TAGS`: Comma-separated fallback tags to apply to scans.

---

## 💻 Local Development

### 1. Frontend Setup
1. Download OpenCV.js to the public folder for local use:
   ```bash
   mkdir -p frontend/public/opencv/
   curl -L https://docs.opencv.org/4.8.0/opencv.js -o frontend/public/opencv/opencv.js
   ```
2. Start the Vite development server:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

> [!TIP]
> **No Webcam?** DocuScan automatically detects if camera hardware is missing or inaccessible, falling back to a simulated HTML5 Canvas camera feed. This allows you to test real-time edge detection, manual adjustment, and the queue workflow on a desktop without camera hardware.

### 2. Backend Setup
1. Configure python virtual environment:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
2. Run the development API server:
   ```bash
   python -m app.main
   ```

---

## 🧭 Troubleshooting

### "Camera Error: No camera found on this device"
- **SSL restriction**: Ensure you are accessing the app over HTTPS (`https://...`). Chrome and Safari do not expose camera media devices over HTTP connections unless resolving to `localhost`.
- **Browser permissions**: Check browser site settings to ensure camera permissions have not been blocked.

### Webhook/Upload connection refused
- Verify the container has network access to the Paperless-ngx server.
- Ensure the API token in Settings or `.env` is correct.
- Check backend logs:
  ```bash
  docker logs docuscan
  ```

---

## 🗺️ Roadmap & Status

### Completed ✅
- [x] Camera capture with 4K resolution support
- [x] Real-time automatic edge detection with temporal smoothing
- [x] Smart auto-capture based on boundary stability and confidence
- [x] Manual corner adjustment with a floating crop magnifier to avoid touch occlusion
- [x] Image enhancement filters (color, grayscale, B&W, enhanced)
- [x] Multi-page document workflow and PDF compilation
- [x] **Multi-Document Queue**: Scanned documents management with local persistence
- [x] **Batch uploading** to Paperless-ngx with granular progress updates
- [x] PWA support with offline caching
- [x] **Mock Camera Fallback** for local desktop development
- [x] Single container production deployment with built-in HTTPS proxy

### Planned 📋
- [ ] Network share storage integrations (WebDAV/SMB/FTP)
- [ ] Local OCR integration and text extraction
- [ ] Custom enhancement presets

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for details.
