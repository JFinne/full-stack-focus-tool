-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "longBreakMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "sessionsBeforeLongBreak" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "shortBreakMinutes" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "workMinutes" INTEGER NOT NULL DEFAULT 25;
