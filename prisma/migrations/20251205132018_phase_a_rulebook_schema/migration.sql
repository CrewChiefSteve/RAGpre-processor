-- CreateTable
CREATE TABLE "Rulebook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "series" TEXT,
    "year" INTEGER,
    "version" TEXT,
    "sourceUrl" TEXT,
    "fileKey" TEXT NOT NULL,
    "pageCount" INTEGER,
    "ingestionJobId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Rulebook_ingestionJobId_fkey" FOREIGN KEY ("ingestionJobId") REFERENCES "Job" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rulebookId" TEXT NOT NULL,
    "label" TEXT,
    "title" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "parentSectionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Section_rulebookId_fkey" FOREIGN KEY ("rulebookId") REFERENCES "Rulebook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Section_parentSectionId_fkey" FOREIGN KEY ("parentSectionId") REFERENCES "Section" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rulebookId" TEXT NOT NULL,
    "sectionId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT,
    "text" TEXT NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Rule_rulebookId_fkey" FOREIGN KEY ("rulebookId") REFERENCES "Rulebook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Rule_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Diagram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rulebookId" TEXT NOT NULL,
    "sectionId" TEXT,
    "ruleId" TEXT,
    "page" INTEGER,
    "boundingBox" TEXT,
    "imageKey" TEXT NOT NULL,
    "publicUrl" TEXT,
    "caption" TEXT,
    "explanation" TEXT,
    "tags" TEXT,
    "refersToRuleCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Diagram_rulebookId_fkey" FOREIGN KEY ("rulebookId") REFERENCES "Rulebook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Diagram_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Diagram_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Table" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rulebookId" TEXT NOT NULL,
    "sectionId" TEXT,
    "ruleId" TEXT,
    "page" INTEGER,
    "boundingBox" TEXT,
    "jsonData" TEXT,
    "markdown" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Table_rulebookId_fkey" FOREIGN KEY ("rulebookId") REFERENCES "Rulebook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Table_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Table_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Chunk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rulebookId" TEXT NOT NULL,
    "sectionId" TEXT,
    "ruleId" TEXT,
    "diagramId" TEXT,
    "tableId" TEXT,
    "type" TEXT NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "text" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "embedding" BLOB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Chunk_rulebookId_fkey" FOREIGN KEY ("rulebookId") REFERENCES "Rulebook" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Chunk_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Chunk_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Chunk_diagramId_fkey" FOREIGN KEY ("diagramId") REFERENCES "Diagram" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Chunk_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Rulebook_ingestionJobId_idx" ON "Rulebook"("ingestionJobId");

-- CreateIndex
CREATE INDEX "Section_rulebookId_idx" ON "Section"("rulebookId");

-- CreateIndex
CREATE INDEX "Section_label_rulebookId_idx" ON "Section"("label", "rulebookId");

-- CreateIndex
CREATE INDEX "Section_parentSectionId_idx" ON "Section"("parentSectionId");

-- CreateIndex
CREATE INDEX "Rule_rulebookId_idx" ON "Rule"("rulebookId");

-- CreateIndex
CREATE INDEX "Rule_code_rulebookId_idx" ON "Rule"("code", "rulebookId");

-- CreateIndex
CREATE INDEX "Rule_sectionId_idx" ON "Rule"("sectionId");

-- CreateIndex
CREATE INDEX "Diagram_rulebookId_idx" ON "Diagram"("rulebookId");

-- CreateIndex
CREATE INDEX "Diagram_ruleId_idx" ON "Diagram"("ruleId");

-- CreateIndex
CREATE INDEX "Diagram_sectionId_idx" ON "Diagram"("sectionId");

-- CreateIndex
CREATE INDEX "Table_rulebookId_idx" ON "Table"("rulebookId");

-- CreateIndex
CREATE INDEX "Table_ruleId_idx" ON "Table"("ruleId");

-- CreateIndex
CREATE INDEX "Table_sectionId_idx" ON "Table"("sectionId");

-- CreateIndex
CREATE INDEX "Chunk_rulebookId_idx" ON "Chunk"("rulebookId");

-- CreateIndex
CREATE INDEX "Chunk_ruleId_idx" ON "Chunk"("ruleId");

-- CreateIndex
CREATE INDEX "Chunk_diagramId_idx" ON "Chunk"("diagramId");

-- CreateIndex
CREATE INDEX "Chunk_tableId_idx" ON "Chunk"("tableId");

-- CreateIndex
CREATE INDEX "Chunk_type_idx" ON "Chunk"("type");

-- CreateIndex
CREATE INDEX "Chunk_sectionId_idx" ON "Chunk"("sectionId");
