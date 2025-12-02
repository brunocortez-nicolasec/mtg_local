-- AlterTable
ALTER TABLE "public"."HRConfig" ADD COLUMN     "api_body" TEXT,
ADD COLUMN     "api_headers" JSONB,
ADD COLUMN     "api_method" TEXT DEFAULT 'GET',
ADD COLUMN     "api_response_path" TEXT,
ADD COLUMN     "api_url" TEXT;

-- AlterTable
ALTER TABLE "public"."SystemConfig" ADD COLUMN     "api_body" TEXT,
ADD COLUMN     "api_headers" JSONB,
ADD COLUMN     "api_method" TEXT DEFAULT 'GET',
ADD COLUMN     "api_response_path" TEXT,
ADD COLUMN     "api_url" TEXT;
