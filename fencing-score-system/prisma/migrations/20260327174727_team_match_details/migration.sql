-- CreateTable
CREATE TABLE "TeamMatchDetail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pouleMatchId" TEXT,
    "eliminationMatchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeamMatchDetail_pouleMatchId_fkey" FOREIGN KEY ("pouleMatchId") REFERENCES "PouleMatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamMatchDetail_eliminationMatchId_fkey" FOREIGN KEY ("eliminationMatchId") REFERENCES "EliminationMatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamBout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchDetailId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "fencer1Id" TEXT NOT NULL,
    "fencer2Id" TEXT NOT NULL,
    "score1" INTEGER NOT NULL,
    "score2" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeamBout_matchDetailId_fkey" FOREIGN KEY ("matchDetailId") REFERENCES "TeamMatchDetail" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMatchDetail_pouleMatchId_key" ON "TeamMatchDetail"("pouleMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMatchDetail_eliminationMatchId_key" ON "TeamMatchDetail"("eliminationMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamBout_matchDetailId_order_key" ON "TeamBout"("matchDetailId", "order");
