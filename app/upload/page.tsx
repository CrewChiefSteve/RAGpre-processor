import UploadForm from '@/components/UploadForm';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function UploadPage() {
  // Fetch global settings to use as defaults
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {}, // uses Prisma defaults from schema
  });

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Upload Document
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Upload a PDF or image. The preprocessor will normalize, analyze, and chunk it for RAG using your default settings.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <UploadForm
          initialSettings={{
            chunkSize: settings.chunkSize,
            chunkOverlap: settings.chunkOverlap,
            maxPages: settings.maxPages,
            enableTables: settings.enableTables,
            handwritingVision: settings.handwritingVision,
            captionDiagrams: settings.captionDiagrams,
            debug: settings.debug,
          }}
        />
      </div>
    </main>
  );
}
