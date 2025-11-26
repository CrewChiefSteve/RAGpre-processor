'use client';

import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

interface UploadFormProps {
  initialSettings?: {
    chunkSize: number;
    chunkOverlap: number;
    maxPages: number | null;
    enableTables: boolean;
    handwritingVision: boolean;
    captionDiagrams: boolean;
    debug: boolean;
  };
}

export default function UploadForm({ initialSettings }: UploadFormProps = {}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Configuration state - use initialSettings or fallback to defaults
  const [chunkSize, setChunkSize] = useState(initialSettings?.chunkSize ?? 800);
  const [chunkOverlap, setChunkOverlap] = useState(initialSettings?.chunkOverlap ?? 150);
  const [maxPages, setMaxPages] = useState<number | undefined>(
    initialSettings?.maxPages != null ? initialSettings.maxPages : undefined
  );
  const [enableTables, setEnableTables] = useState(initialSettings?.enableTables ?? true);
  const [handwritingVision, setHandwritingVision] = useState(
    initialSettings?.handwritingVision ?? false
  );
  const [captionDiagrams, setCaptionDiagrams] = useState(
    initialSettings?.captionDiagrams ?? false
  );
  const [debug, setDebug] = useState(initialSettings?.debug ?? false);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Validate file type
  const isValidFileType = (file: File): boolean => {
    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/heic',
    ];
    return validTypes.includes(file.type) ||
           file.name.match(/\.(pdf|jpg|jpeg|png|heic)$/i) !== null;
  };

  // Handle file selection
  const handleFileSelect = (selectedFile: File) => {
    setError(null);

    // Validate file type
    if (!isValidFileType(selectedFile)) {
      setError('Invalid file type. Please select a PDF or image file (JPG, PNG, HEIC).');
      return;
    }

    // Validate file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(`File is too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`);
      return;
    }

    setFile(selectedFile);
  };

  // Handle drag events
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Handle file input change
  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Handle click on drop zone
  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };

  // Remove selected file
  const handleRemoveFile = () => {
    setFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate file selection
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Build config object
      const config = {
        chunkSize,
        chunkOverlap,
        maxPages: maxPages != null && maxPages > 0 ? maxPages : null,
        enableTables,
        handwritingVision,
        captionDiagrams,
        debug,
      };

      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('config', JSON.stringify(config));

      // Submit to API
      const res = await fetch('/api/jobs', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        // Try to parse error message
        let errorMessage = 'Failed to create job';
        try {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = await res.text() || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Parse response
      const data = await res.json();

      // Extract job ID - handle both possible response shapes
      // Expected: { job: { id: "...", ... }, message: "..." }
      const jobId = data.job?.id ?? data.id;

      if (!jobId) {
        throw new Error('Upload succeeded but no job ID returned');
      }

      // Redirect to job detail page
      router.push(`/jobs/${jobId}`);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'An error occurred during upload');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* File Upload Area */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.heic"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {!file ? (
          <div
            onClick={handleDropZoneClick}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition ${
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            <div className="space-y-2">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="text-gray-600 dark:text-gray-400">
                Drag and drop a file here, or click to select
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Supports PDF, JPG, PNG, HEIC (max {formatFileSize(MAX_FILE_SIZE)})
              </p>
            </div>
          </div>
        ) : (
          <div className="border-2 border-gray-300 dark:border-gray-600 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <svg
                  className="h-10 w-10 text-blue-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {file.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Configuration Form */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Configuration
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Chunk Size
            </label>
            <input
              type="number"
              value={chunkSize}
              onChange={(e) => setChunkSize(parseInt(e.target.value) || 800)}
              min={100}
              max={2000}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Number of tokens per chunk (100-2000)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Chunk Overlap
            </label>
            <input
              type="number"
              value={chunkOverlap}
              onChange={(e) => setChunkOverlap(parseInt(e.target.value) || 150)}
              min={0}
              max={500}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Overlapping tokens between chunks (0-500)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Pages (optional)
            </label>
            <input
              type="number"
              value={maxPages || ''}
              onChange={(e) => setMaxPages(e.target.value ? parseInt(e.target.value) : undefined)}
              min={1}
              placeholder="No limit"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Limit processing to first N pages
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="enableTables"
              checked={enableTables}
              onChange={(e) => setEnableTables(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="enableTables" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Enable Tables (Phase C)
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="handwritingVision"
              checked={handwritingVision}
              onChange={(e) => setHandwritingVision(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="handwritingVision" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Handwriting Vision (Phase D)
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="captionDiagrams"
              checked={captionDiagrams}
              onChange={(e) => setCaptionDiagrams(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="captionDiagrams" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Caption Diagrams (Phase D)
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="debug"
              checked={debug}
              onChange={(e) => setDebug(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="debug" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Debug Mode
            </label>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-lg">
          <p className="font-medium">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {isSubmitting ? 'Processing...' : 'This may take a moment for large PDFs.'}
        </p>
        <button
          type="submit"
          disabled={isSubmitting || !file}
          className={`px-6 py-3 rounded-lg font-semibold transition ${
            isSubmitting || !file
              ? 'bg-gray-400 cursor-not-allowed text-gray-200'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isSubmitting ? 'Uploading...' : 'Start Processing'}
        </button>
      </div>
    </form>
  );
}
