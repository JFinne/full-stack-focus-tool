-- AlterTable
ALTER TABLE "user_preferences" ADD COLUMN     "focusHiddenAddons" TEXT[] DEFAULT ARRAY[]::TEXT[];
