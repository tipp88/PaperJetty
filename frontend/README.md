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
background. Sharpness only ranks candidates within a burst; there is no absolute
minimum that could block sparse or low-contrast pages. Automatic capture uses
the stable preview position as its initial reference and tolerates small drift
between the more widely spaced burst frames. Manual capture can also save pages
without detected corners. Only the working frame and best frame are retained at
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
blank page via automatic capture and leaving the camera during capture. Real
camera timing, noise and focus behavior still need device testing.
