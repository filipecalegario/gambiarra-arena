CREATE TABLE "story_competitions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "seedText" TEXT NOT NULL,
    "canonText" TEXT NOT NULL,
    "totalChapters" INTEGER NOT NULL,
    "currentChapter" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "maxTokens" INTEGER NOT NULL DEFAULT 500,
    "temperature" REAL NOT NULL DEFAULT 0.9,
    "deadlineMs" INTEGER NOT NULL DEFAULT 120000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "story_competitions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "story_chapters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "winningParticipantId" TEXT,
    "winningNickname" TEXT,
    "winningContent" TEXT,
    "winningScore" REAL,
    "winningVotes" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canonicalizedAt" DATETIME,
    CONSTRAINT "story_chapters_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "story_competitions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "story_chapters_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "rounds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "story_chapters_roundId_key" ON "story_chapters"("roundId");
CREATE UNIQUE INDEX "story_chapters_storyId_index_key" ON "story_chapters"("storyId", "index");
