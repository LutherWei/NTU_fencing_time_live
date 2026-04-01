-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "pouleId" TEXT,
    "victories" INTEGER NOT NULL DEFAULT 0,
    "defeats" INTEGER NOT NULL DEFAULT 0,
    "touchesScored" INTEGER NOT NULL DEFAULT 0,
    "touchesReceived" INTEGER NOT NULL DEFAULT 0,
    "indicator" INTEGER NOT NULL DEFAULT 0,
    "winRate" REAL NOT NULL DEFAULT 0,
    "seedRank" INTEGER,
    "pouleRank" INTEGER,
    "finalRank" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Team_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Team_pouleId_fkey" FOREIGN KEY ("pouleId") REFERENCES "Poule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EliminationMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bracketId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "fencer1Id" TEXT,
    "fencer2Id" TEXT,
    "team1Id" TEXT,
    "team2Id" TEXT,
    "fencer1SeedRank" INTEGER,
    "fencer2SeedRank" INTEGER,
    "score1" INTEGER,
    "score2" INTEGER,
    "winnerId" TEXT,
    "winnerTeamId" TEXT,
    "isBye" BOOLEAN NOT NULL DEFAULT false,
    "isThirdPlace" BOOLEAN NOT NULL DEFAULT false,
    "prevMatch1Id" TEXT,
    "prevMatch2Id" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EliminationMatch_bracketId_fkey" FOREIGN KEY ("bracketId") REFERENCES "Bracket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EliminationMatch_fencer1Id_fkey" FOREIGN KEY ("fencer1Id") REFERENCES "Fencer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EliminationMatch_fencer2Id_fkey" FOREIGN KEY ("fencer2Id") REFERENCES "Fencer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EliminationMatch_team1Id_fkey" FOREIGN KEY ("team1Id") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EliminationMatch_team2Id_fkey" FOREIGN KEY ("team2Id") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EliminationMatch_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Fencer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EliminationMatch_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EliminationMatch" ("bracketId", "completed", "createdAt", "fencer1Id", "fencer1SeedRank", "fencer2Id", "fencer2SeedRank", "id", "isBye", "isThirdPlace", "position", "prevMatch1Id", "prevMatch2Id", "round", "score1", "score2", "updatedAt", "winnerId") SELECT "bracketId", "completed", "createdAt", "fencer1Id", "fencer1SeedRank", "fencer2Id", "fencer2SeedRank", "id", "isBye", "isThirdPlace", "position", "prevMatch1Id", "prevMatch2Id", "round", "score1", "score2", "updatedAt", "winnerId" FROM "EliminationMatch";
DROP TABLE "EliminationMatch";
ALTER TABLE "new_EliminationMatch" RENAME TO "EliminationMatch";
CREATE UNIQUE INDEX "EliminationMatch_bracketId_round_position_key" ON "EliminationMatch"("bracketId", "round", "position");
CREATE TABLE "new_Fencer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" TEXT NOT NULL,
    "teamId" TEXT,
    "isSubstitute" BOOLEAN NOT NULL DEFAULT false,
    "pouleId" TEXT,
    "victories" INTEGER NOT NULL DEFAULT 0,
    "defeats" INTEGER NOT NULL DEFAULT 0,
    "touchesScored" INTEGER NOT NULL DEFAULT 0,
    "touchesReceived" INTEGER NOT NULL DEFAULT 0,
    "indicator" INTEGER NOT NULL DEFAULT 0,
    "winRate" REAL NOT NULL DEFAULT 0,
    "seedRank" INTEGER,
    "pouleRank" INTEGER,
    "finalRank" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Fencer_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Fencer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Fencer_pouleId_fkey" FOREIGN KEY ("pouleId") REFERENCES "Poule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Fencer" ("categoryId", "checkedIn", "createdAt", "defeats", "finalRank", "id", "indicator", "name", "pouleId", "pouleRank", "seedRank", "touchesReceived", "touchesScored", "updatedAt", "victories", "winRate") SELECT "categoryId", "checkedIn", "createdAt", "defeats", "finalRank", "id", "indicator", "name", "pouleId", "pouleRank", "seedRank", "touchesReceived", "touchesScored", "updatedAt", "victories", "winRate" FROM "Fencer";
DROP TABLE "Fencer";
ALTER TABLE "new_Fencer" RENAME TO "Fencer";
CREATE TABLE "new_PouleMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pouleId" TEXT NOT NULL,
    "fencer1Id" TEXT,
    "fencer2Id" TEXT,
    "team1Id" TEXT,
    "team2Id" TEXT,
    "score1" INTEGER,
    "score2" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PouleMatch_pouleId_fkey" FOREIGN KEY ("pouleId") REFERENCES "Poule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PouleMatch" ("completed", "createdAt", "fencer1Id", "fencer2Id", "id", "pouleId", "score1", "score2", "updatedAt") SELECT "completed", "createdAt", "fencer1Id", "fencer2Id", "id", "pouleId", "score1", "score2", "updatedAt" FROM "PouleMatch";
DROP TABLE "PouleMatch";
ALTER TABLE "new_PouleMatch" RENAME TO "PouleMatch";
CREATE UNIQUE INDEX "PouleMatch_pouleId_fencer1Id_fencer2Id_key" ON "PouleMatch"("pouleId", "fencer1Id", "fencer2Id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
