# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.9] - 2026-07-08

### Fixed
- Fixed an issue where the image processing mode selected in the Settings dialog (e.g. "Color") was ignored when adding or replacing pages, causing the app to always fall back to an auto-detected grayscale filter. The document store now correctly queries the backend API for the default enhancement setting instead of checking the stale local storage.

## [1.3.8] - 2026-06-18

### Fixed
- Fixed extreme aspect ratio distortion ("stur rechteckig" text stretching) when processing trapezoidal documents. The perspective algorithm now uses the maximum edge lengths instead of averages, which correctly un-tilts the document without squishing the text.
- Fixed document rotation and mapping errors by replacing the flawed y-x corner sorting algorithm in the edge detector with a robust centroid-based method.
- Added a 2500px maximum resolution limit to the perspective transform to prevent silent OpenCV Out-Of-Memory fallback crops on high-resolution smartphone photos.

## [1.3.7] - 2026-06-11

### Changed
- Configured root wrapper container to use Dynamic Viewport Height (`h-[100dvh]`) to prevent browser nav bars from pushing the bottom UI out of bounds.
- Increased spacing-bottom (`pb-36`) in the scrollable containers for Review and Queue views to ensure bottom action buttons are scrollable clear of system home indicator bars.
- Applied responsive horizontal padding (`px-6 py-4 sm:px-8`) across Review, Queue, and Export screens to ensure a neat margin on mobile phones with curved screen edges.

## [1.3.6] - 2026-06-11

### Changed
- Refined edge detection confidence score to use shape rectangularity (solidity/extent) and soft area scaling rather than global frame area ratio, ensuring long/narrow receipts score high confidence.
- Decreased `AUTO_CAPTURE_MARGIN_RATIO` from 4% to 1.5% to allow auto-capture to trigger even when a long document spans almost the entire height of the viewport.

## [1.3.5] - 2026-06-11

### Changed
- Improved OpenCV edge detection for long receipts by adding a convex hull pre-pass to ignore crumpled paper folds and overlay text.
- Added a rotated bounding box (`minAreaRect`) fallback logic to extract clean quadrilaterals when standard approximation yields >4 vertices.
- Integrated adaptive thresholding as a third fallback pipeline to trace documents on low-contrast or unevenly-lit backgrounds.
- Implemented area-based Shoelace outlier rejection in the temporal filter, eliminating frame-to-frame tracking wobbles.

### Fixed
- Fixed LocalStorage `QuotaExceededError` that broke image processing and capture reset actions by migrating Zustand storage to IndexedDB.
- Optimized portrait mobile navigation layout to ensure the Settings gear icon is fully visible and not cut off on narrow viewports.

## [1.3.4] - 2026-06-11

### Added
- Multi-document upload queue allowing sequential page capture to be grouped into distinct documents.
- Batch upload mechanism to send queued documents to Paperless-ngx sequentially with progress indicators.
- "Finish Doc & New" button in crop view to immediately finalize a document and continue scanning.
- Interactive Queue dashboard tab with title and tag editors.
- Mock HTML5 Canvas camera stream fallback for desktop development and test runs.

## [1.3.3] - 2026-06-11

### Changed
- Improved crop magnifier positioning near the top of the screen by shifting it horizontally (to the left or right) instead of directly below the finger, avoiding touch hand occlusion.

## [1.3.2] - 2026-06-11

### Fixed
- Fixed bug where `minArea` check was not scaled down for the resized image, causing all document edge contours to be rejected.

## [1.3.1] - 2026-06-11

### Added
- Floating corner magnifier for precise boundary adjustment when dragging crop handles in preview
- Settings modal shows the current frontend version (migrated from unreleased)

### Changed
- Downscaled image processing for real-time edge detection, reducing CPU/memory overhead by up to 50x
- Dual edge detection pipeline combining Canny edge detection and Otsu's thresholding for improved lighting resilience
- Robust clockwise corner sorting to prevent duplicate coordinates and off-screen handles

## [1.1.1] - 2026-01-13

### Added
- Auto-capture now enforces confidence, stability, and on-screen bounds before triggering
- Corner normalization clamps detected points so handles always remain draggable

### Changed
- Auto-capture uses a short delay after stable detection to reduce premature captures

### Fixed
- Premature auto-captures when edges briefly stabilize
- Off-screen corner handles that prevented manual adjustment

## [1.0.0] - 2026-01-04

### Added
- **📐 Real-time Edge Detection**: Automatic document boundary detection in camera view
  - Uses OpenCV.js Canny edge detection algorithm
  - Visual overlay shows detected corners with confidence indicator
  - Temporal filtering smooths jittery detections over 5 frames
  - Runs at 5 FPS to minimize CPU usage
  - Auto-populates corner adjuster when confidence > 50%
- **🤖 Automatic Image Enhancement**: Auto-detects best enhancement mode for each page
  - Analyzes image contrast and brightness
  - Chooses between Grayscale, B&W, or Enhanced mode
  - Optimized for OCR and readability
- **⚙️ Settings Menu**: Comprehensive settings interface
  - Configure Paperless-ngx URL, API token, and default tags
  - Set default image enhancement mode (auto or manual)
  - Settings stored in browser localStorage
  - Beautiful modal UI matching design system
- **🎨 Manual Enhancement Controls**: Per-page enhancement mode selector
  - Appears on hover over page thumbnails
  - 4 modes: Color (📸), Grayscale (⬜), B&W (⬛), Enhanced (✨)
  - Real-time reprocessing when changing modes
- Complete UI redesign with "Precision Instrument" design system
- Custom typography: Syne (display) and Outfit (body) fonts
- Warm amber accent color (#fbbf24) with deep charcoal base palette
- Animated scan line in camera view
- Amber corner markers framing document area
- Vignette overlay for visual depth
- Enhanced corner adjuster with glowing borders and numbered handles
- Precision grid lines in corner adjustment mode
- Frosted glass header with amber-glowing logo badge
- Card hover animations with lift effects
- Staggered slide-up animations for page grid
- Subtle noise texture overlay throughout UI
- Real-time upload progress tracking with XMLHttpRequest
- Export modal with refined progress bar and glow effects

### Changed
- Migrated from Tailwind CSS v3 to v4 (CSS-based configuration)
- Updated color palette from generic grays/blues to carbon/amber theme
- Improved page thumbnail design with gradient overlays
- Enhanced button styles with consistent design language
- Refined navigation tabs with active state indicators
- Updated empty states with better visual hierarchy
- Paperless tags now configurable via settings (no longer hardcoded)
- Default enhancement mode is now auto-detect (was color/no processing)

### Fixed
- Upload progress getting stuck at 30% during Paperless-ngx uploads
- Removed unused Tailwind config file (migrated to CSS @theme)
- **Image enhancement causing app freeze** - Resolved by loading OpenCV via HTML script tag
  - Root cause: async/await promise chain had a resolution bug where resolve() was called but promise never completed
  - Solution: Load OpenCV directly via `<script async>` in index.html, bypassing JavaScript promise complexity
  - Enhancement modes (grayscale, B&W, enhanced) now work reliably without freezing

## [0.2.0] - 2025-01-04

### Added
- Manual corner adjustment with interactive draggable handles
- Image enhancement filters (color, grayscale, B&W, enhanced)
- PDF generation from scanned pages
- Paperless-ngx integration with direct upload
- Multi-page document workflow
- Page reordering with drag-and-drop
- Page rotation support
- Zustand state management
- Progressive Web App (PWA) support
- Docker deployment configuration

### Changed
- Disabled automatic edge detection (now manual corner adjustment only)
- Improved camera capture with 4K resolution support
- Enhanced perspective transformation using OpenCV

### Fixed
- Camera initialization issues on mobile devices
- Edge detection causing camera crashes
- Touch detection threshold for mobile devices

## [0.1.0] - 2025-01-01

### Added
- Initial release
- Camera-based document capture
- Real-time edge detection with OpenCV.js
- Temporal filtering for stable detection
- Mobile-optimized interface
- FastAPI backend
- React + TypeScript frontend
- Vite build system
- Environment-based configuration

---

**Legend:**
- 🎨 Design / UI changes
- ✨ New features
- 🐛 Bug fixes
- 🔧 Configuration / Infrastructure
- 📝 Documentation
- ⚡ Performance improvements
