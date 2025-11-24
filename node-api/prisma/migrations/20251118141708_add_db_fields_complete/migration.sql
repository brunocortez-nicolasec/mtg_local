-- AlterTable
ALTER TABLE "public"."HRConfig" ADD COLUMN     "db_connection_type" TEXT DEFAULT 'HOST',
ADD COLUMN     "db_schema" TEXT,
ADD COLUMN     "db_table" TEXT,
ADD COLUMN     "db_url" TEXT;

-- AlterTable
ALTER TABLE "public"."SystemConfig" ADD COLUMN     "db_connection_type" TEXT DEFAULT 'HOST',
ADD COLUMN     "db_schema" TEXT,
ADD COLUMN     "db_table" TEXT,
ADD COLUMN     "db_url" TEXT;
