import type { Metadata } from 'next';
import './globals.css';
import '@/lib/initJobRunner'; // Auto-start job runner
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'RAG Preprocessor Console',
  description: 'Document preprocessing pipeline for RAG applications',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                RAG Preprocessor Console
              </h1>
              <Navigation />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
