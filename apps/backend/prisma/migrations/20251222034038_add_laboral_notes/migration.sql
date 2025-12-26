-- CreateTable
CREATE TABLE "laboral_notes" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "laboral_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "laboral_notes_userId_idx" ON "laboral_notes"("userId");

-- AddForeignKey
ALTER TABLE "laboral_notes" ADD CONSTRAINT "laboral_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
