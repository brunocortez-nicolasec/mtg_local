-- AlterTable
ALTER TABLE "public"."HRConfig" ADD COLUMN     "csv_delimiter" TEXT,
ADD COLUMN     "csv_quote" TEXT;

-- AlterTable
ALTER TABLE "public"."SystemConfig" ADD COLUMN     "csv_delimiter" TEXT,
ADD COLUMN     "csv_quote" TEXT;
