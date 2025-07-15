/*
  Warnings:

  - You are about to drop the column `date` on the `work_entries` table. All the data in the column will be lost.
  - You are about to drop the column `hours` on the `work_entries` table. All the data in the column will be lost.
  - Added the required column `endTime` to the `work_entries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `work_entries` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "work_entries_date_idx";

-- DropIndex
DROP INDEX "work_entries_hours_idx";

-- DropIndex
DROP INDEX "work_entries_userId_date_hours_idx";

-- DropIndex
DROP INDEX "work_entries_userId_date_idx";

-- DropIndex
DROP INDEX "work_entries_userId_hours_idx";

-- AlterTable
ALTER TABLE "work_entries" DROP COLUMN "date",
DROP COLUMN "hours",
ADD COLUMN     "endTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "startTime" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "work_entries_startTime_idx" ON "work_entries"("startTime");

-- CreateIndex
CREATE INDEX "work_entries_endTime_idx" ON "work_entries"("endTime");

-- CreateIndex
CREATE INDEX "work_entries_userId_startTime_idx" ON "work_entries"("userId", "startTime");

-- CreateIndex
CREATE INDEX "work_entries_userId_endTime_idx" ON "work_entries"("userId", "endTime");

-- CreateIndex
CREATE INDEX "work_entries_userId_startTime_endTime_idx" ON "work_entries"("userId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "work_entries_startTime_endTime_idx" ON "work_entries"("startTime", "endTime");
