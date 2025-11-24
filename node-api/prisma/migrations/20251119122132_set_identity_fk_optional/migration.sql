-- DropForeignKey
ALTER TABLE "public"."Accounts" DROP CONSTRAINT "Accounts_identityId_fkey";

-- AlterTable
ALTER TABLE "public"."Accounts" ALTER COLUMN "identityId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Accounts" ADD CONSTRAINT "Accounts_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "public"."IdentitiesHR"("id") ON DELETE SET NULL ON UPDATE CASCADE;
