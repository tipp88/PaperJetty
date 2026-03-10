import type { DocumentPage } from '../../types/document';

interface PagePreviewModalProps {
  page: DocumentPage;
  pageNumber: number;
  onClose: () => void;
  onDelete: () => void;
  onRetake: () => void;
  onRotate: () => void;
}

const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

// Removed unused icons here

const RealRotateIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10a8 8 0 0114.32-4.906l1.474-1.474A1 1 0 0120 4.327V9a1 1 0 01-1 1h-4.673a1 1 0 01-.707-1.707l1.09-1.09A6 6 0 1018 10h2a8 8 0 11-17 0z" />
  </svg>
);


export function PagePreviewModal({
  page,
  pageNumber,
  onClose,
  onDelete,
  onRetake,
  onRotate,
}: PagePreviewModalProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-950/95 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-carbon-800/80 text-carbon-300 hover:bg-carbon-700 hover:text-carbon-100 transition-colors"
      >
        <CloseIcon />
      </button>

      {/* Page number badge */}
      <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-lg bg-carbon-800/80 text-carbon-200 font-display text-sm">
        Page {pageNumber}
      </div>

      {/* Main content */}
      <div className="flex flex-col items-center max-w-4xl w-full mx-4">
        {/* Image container */}
        <div className="relative w-full max-h-[70vh] flex items-center justify-center mb-6">
          <img
            src={page.processedImage}
            alt={`Page ${pageNumber}`}
            className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-2xl transition-transform duration-300"
            style={{ transform: `rotate(${page.rotation}deg)` }}
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onRetake}
            className="btn btn-secondary"
          >
            <RefreshIcon />
            <span>Retake</span>
          </button>
          <button
            onClick={onRotate}
            className="btn btn-secondary"
          >
            <RealRotateIcon />
            <span>Rotate</span>
          </button>
          <button
            onClick={handleDelete}
            className="btn btn-danger"
          >
            <TrashIcon />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
