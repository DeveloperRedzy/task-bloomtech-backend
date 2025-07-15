-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "users_email_createdAt_idx" ON "users"("email", "createdAt");

-- CreateIndex
CREATE INDEX "work_entries_userId_createdAt_idx" ON "work_entries"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "work_entries_userId_hours_idx" ON "work_entries"("userId", "hours");

-- CreateIndex
CREATE INDEX "work_entries_userId_date_hours_idx" ON "work_entries"("userId", "date", "hours");

-- CreateIndex
CREATE INDEX "work_entries_createdAt_idx" ON "work_entries"("createdAt");

-- CreateIndex
CREATE INDEX "work_entries_hours_idx" ON "work_entries"("hours");
