-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pinHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active'
);

-- CreateTable
CREATE TABLE "participants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "runner" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "participants_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "maxTokens" INTEGER NOT NULL DEFAULT 400,
    "temperature" REAL NOT NULL DEFAULT 0.8,
    "deadlineMs" INTEGER NOT NULL DEFAULT 90000,
    "seed" INTEGER,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    CONSTRAINT "rounds_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "latencyFirstTokenMs" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "tpsAvg" REAL,
    "modelInfo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "metrics_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "rounds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "metrics_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "votes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "voterHash" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "votes_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "rounds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "votes_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "rounds_sessionId_index_key" ON "rounds"("sessionId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "metrics_roundId_participantId_key" ON "metrics"("roundId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "votes_roundId_voterHash_participantId_key" ON "votes"("roundId", "voterHash", "participantId");
