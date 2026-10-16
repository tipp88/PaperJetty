# DocuScan Frontend

React + TypeScript + Vite frontend for DocuScan.

## Development

```bash
npm install
npm run dev
```

The dev server proxies `/api` to the backend (see `frontend/vite.config.ts`).

## Capture quality

The preview checks corner movement across fresh detections. Once stationary,
capture compares up to seven frames over approximately 700 ms and saves the
sharpest suitable frame at the existing camera resolution and JPEG quality.
Manual capture adds a 120 ms settling delay after tapping the shutter.

Sharpness is measured inside the detected page, excluding the border and
background. Automatic capture requires a confident, stationary page with some
image detail. Manual capture can also save pages without detected corners or
with very little detail. Only the working frame and best frame are retained at
full resolution; corners are detected on the exact frame that is saved.

Run regression tests with Node.js 24+ (native TypeScript support and experimental
module mocking), and compile the app:

```bash
npm test
npm run build
```

Tests cover movement, lost tracking, sharpness ranking, background exclusion,
frame/corner correspondence, manual fallback, cancellation, and stalled cameras.
On a phone, compare scans of the same printed page in good and dim light, with
small hand movements, using both automatic and manual capture. Also check a
blank page via manual capture and leaving the camera during capture. The detail
threshold is deliberately conservative; real camera noise and focus behavior
still need device testing.
