-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "notificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "soundEnabled" BOOLEAN NOT NULL DEFAULT true;
