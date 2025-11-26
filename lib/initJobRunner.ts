import { startJobRunner } from './jobRunner';

// Auto-start the job runner when this module is imported
// This ensures the runner is always active in the Next.js app
let initialized = false;

export function initializeJobRunner() {
  if (!initialized) {
    console.log('[Init] Starting job runner...');
    startJobRunner({
      pollInterval: 3000, // check every 3 seconds
    });
    initialized = true;
  }
}

// Auto-initialize on import
if (typeof window === 'undefined') {
  // Only run on server side
  initializeJobRunner();
}
