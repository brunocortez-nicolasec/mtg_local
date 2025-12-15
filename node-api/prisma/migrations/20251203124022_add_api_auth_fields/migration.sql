-- AlterTable
ALTER TABLE "public"."HRConfig" ADD COLUMN     "api_auth_password" TEXT,
ADD COLUMN     "api_auth_token" TEXT,
ADD COLUMN     "api_auth_type" TEXT DEFAULT 'No Auth',
ADD COLUMN     "api_auth_user" TEXT,
ADD COLUMN     "api_subtype" TEXT DEFAULT 'REST',
ADD COLUMN     "auth_client_id" TEXT,
ADD COLUMN     "auth_client_secret" TEXT,
ADD COLUMN     "auth_grant_type" TEXT DEFAULT 'client_credentials',
ADD COLUMN     "auth_is_dynamic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "auth_scope" TEXT,
ADD COLUMN     "auth_token_url" TEXT;

-- AlterTable
ALTER TABLE "public"."SystemConfig" ADD COLUMN     "api_auth_password" TEXT,
ADD COLUMN     "api_auth_token" TEXT,
ADD COLUMN     "api_auth_type" TEXT DEFAULT 'No Auth',
ADD COLUMN     "api_auth_user" TEXT,
ADD COLUMN     "api_subtype" TEXT DEFAULT 'REST',
ADD COLUMN     "auth_client_id" TEXT,
ADD COLUMN     "auth_client_secret" TEXT,
ADD COLUMN     "auth_grant_type" TEXT DEFAULT 'client_credentials',
ADD COLUMN     "auth_is_dynamic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "auth_scope" TEXT,
ADD COLUMN     "auth_token_url" TEXT;
