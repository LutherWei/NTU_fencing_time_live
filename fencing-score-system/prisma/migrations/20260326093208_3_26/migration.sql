-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'checkin',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Fencer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
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
    CONSTRAINT "Fencer_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Fencer_pouleId_fkey" FOREIGN KEY ("pouleId") REFERENCES "Poule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Poule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Poule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PouleMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pouleId" TEXT NOT NULL,
    "fencer1Id" TEXT NOT NULL,
    "fencer2Id" TEXT NOT NULL,
    "score1" INTEGER,
    "score2" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PouleMatch_pouleId_fkey" FOREIGN KEY ("pouleId") REFERENCES "Poule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bracket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "eliminationRate" REAL NOT NULL DEFAULT 0,
    "hasThirdPlace" BOOLEAN NOT NULL DEFAULT false,
    "totalRounds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bracket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EliminationMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bracketId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "fencer1Id" TEXT,
    "fencer2Id" TEXT,
    "fencer1SeedRank" INTEGER,
    "fencer2SeedRank" INTEGER,
    "score1" INTEGER,
    "score2" INTEGER,
    "winnerId" TEXT,
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
    CONSTRAINT "EliminationMatch_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Fencer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "PouleMatch_pouleId_fencer1Id_fencer2Id_key" ON "PouleMatch"("pouleId", "fencer1Id", "fencer2Id");

-- CreateIndex
CREATE UNIQUE INDEX "Bracket_categoryId_key" ON "Bracket"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "EliminationMatch_bracketId_round_position_key" ON "EliminationMatch"("bracketId", "round", "position");
