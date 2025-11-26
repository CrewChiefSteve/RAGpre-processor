-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "documentType" TEXT,
    "chunkSize" INTEGER NOT NULL DEFAULT 800,
    "chunkOverlap" INTEGER NOT NULL DEFAULT 150,
    "maxPages" INTEGER,
    "enableTables" BOOLEAN NOT NULL DEFAULT true,
    "handwritingVision" BOOLEAN NOT NULL DEFAULT false,
    "captionDiagrams" BOOLEAN NOT NULL DEFAULT false,
    "debug" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "error" TEXT,
    "phasesJson" TEXT NOT NULL DEFAULT '{}',
    "outputsJson" TEXT NOT NULL DEFAULT '{}',
    "uploadedFilePath" TEXT,
    "outputDir" TEXT
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Log_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "chunkSize" INTEGER NOT NULL DEFAULT 800,
    "chunkOverlap" INTEGER NOT NULL DEFAULT 150,
    "maxPages" INTEGER,
    "enableTables" BOOLEAN NOT NULL DEFAULT true,
    "handwritingVision" BOOLEAN NOT NULL DEFAULT false,
    "captionDiagrams" BOOLEAN NOT NULL DEFAULT false,
    "debug" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Log_jobId_idx" ON "Log"("jobId");

-- CreateIndex
CREATE INDEX "Log_phase_idx" ON "Log"("phase");
