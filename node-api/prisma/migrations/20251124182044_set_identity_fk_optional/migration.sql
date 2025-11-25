-- CreateEnum
CREATE TYPE "public"."ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."DataSourceOrigem" AS ENUM ('RH', 'IDM', 'SISTEMA');

-- CreateEnum
CREATE TYPE "public"."DataSourceType" AS ENUM ('CSV', 'API', 'DATABASE');

-- CreateEnum
CREATE TYPE "public"."SystemConnectionType" AS ENUM ('CSV', 'DATABASE', 'API');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "profile_image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "profileId" INTEGER NOT NULL,
    "packageId" INTEGER,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."profiles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."password_resets" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."credentials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."groups" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."platforms" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "icon" TEXT,

    CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."packages" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DataSource" (
    "id" SERIAL NOT NULL,
    "name_datasource" TEXT NOT NULL,
    "origem_datasource" "public"."DataSourceOrigem" NOT NULL,
    "type_datasource" "public"."DataSourceType" NOT NULL,
    "description_datasource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."import_logs" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "public"."ImportStatus" NOT NULL DEFAULT 'PENDING',
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "errorDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "userId" INTEGER NOT NULL,
    "dataSourceId" INTEGER,
    "processingTarget" TEXT,

    CONSTRAINT "import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HRConfig" (
    "id" SERIAL NOT NULL,
    "dataSourceId" INTEGER NOT NULL,
    "diretorio_hr" TEXT,
    "db_connection_type" TEXT DEFAULT 'HOST',
    "db_host" TEXT,
    "db_port" TEXT,
    "db_name" TEXT,
    "db_user" TEXT,
    "db_password" TEXT,
    "db_type" TEXT,
    "db_url" TEXT,
    "db_schema" TEXT,
    "db_table" TEXT,

    CONSTRAINT "HRConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IdentitiesHR" (
    "id" SERIAL NOT NULL,
    "identity_id_hr" TEXT NOT NULL,
    "name_hr" TEXT,
    "email_hr" TEXT,
    "status_hr" TEXT,
    "user_type_hr" TEXT,
    "cpf_hr" TEXT,
    "extra_data_hr" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dataSourceId" INTEGER NOT NULL,

    CONSTRAINT "IdentitiesHR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."data_mappings_hr" (
    "id" SERIAL NOT NULL,
    "dataSourceId" INTEGER NOT NULL,
    "identity_id_hr" TEXT,
    "name_hr" TEXT,
    "email_hr" TEXT,
    "status_hr" TEXT,
    "user_type_hr" TEXT,
    "cpf_hr" TEXT,
    "extra_data_hr" TEXT,

    CONSTRAINT "data_mappings_hr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IDMConfig" (
    "id" SERIAL NOT NULL,
    "dataSourceId" INTEGER NOT NULL,
    "api_url" TEXT NOT NULL,
    "api_user" TEXT,

    CONSTRAINT "IDMConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."data_mappings_idm" (
    "id" SERIAL NOT NULL,
    "dataSourceId" INTEGER NOT NULL,
    "identity_id_idm" TEXT,
    "name_idm" TEXT,
    "email_idm" TEXT,
    "status_idm" TEXT,
    "extra_data_idm" TEXT,

    CONSTRAINT "data_mappings_idm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IdentitiesIDM" (
    "id" SERIAL NOT NULL,
    "identity_id_idm" TEXT NOT NULL,
    "name_idm" TEXT,
    "email_idm" TEXT,
    "status_idm" TEXT,
    "extra_data_idm" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dataSourceId" INTEGER NOT NULL,

    CONSTRAINT "IdentitiesIDM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RolesIDM" (
    "id" SERIAL NOT NULL,
    "name_role_idm" TEXT NOT NULL,
    "description_role_idm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolesIDM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Endpoint_IDM" (
    "id" SERIAL NOT NULL,
    "name_endpoint_idm" TEXT NOT NULL,
    "description_endpoint_idm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Endpoint_IDM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResourceIDM" (
    "id" SERIAL NOT NULL,
    "name_resource_idm" TEXT NOT NULL,
    "description_resource_idm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceIDM_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Identities_RolesIDM" (
    "identityId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Identities_RolesIDM_pkey" PRIMARY KEY ("identityId","roleId")
);

-- CreateTable
CREATE TABLE "public"."RolesIDM_Endpoint" (
    "roleId" INTEGER NOT NULL,
    "endpointId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolesIDM_Endpoint_pkey" PRIMARY KEY ("roleId","endpointId")
);

-- CreateTable
CREATE TABLE "public"."Endpoint_Source" (
    "endpointId" INTEGER NOT NULL,
    "resourceId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Endpoint_Source_pkey" PRIMARY KEY ("endpointId","resourceId")
);

-- CreateTable
CREATE TABLE "public"."System" (
    "id" SERIAL NOT NULL,
    "name_system" TEXT NOT NULL,
    "description_system" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "System_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SystemConfig" (
    "id" SERIAL NOT NULL,
    "dataSourceId" INTEGER NOT NULL,
    "systemId" INTEGER NOT NULL,
    "tipo_fonte_contas" "public"."SystemConnectionType" NOT NULL,
    "diretorio_contas" TEXT,
    "tipo_fonte_recursos" "public"."SystemConnectionType" NOT NULL,
    "diretorio_recursos" TEXT,
    "db_connection_type" TEXT DEFAULT 'HOST',
    "db_host" TEXT,
    "db_port" TEXT,
    "db_name" TEXT,
    "db_user" TEXT,
    "db_password" TEXT,
    "db_type" TEXT,
    "db_url" TEXT,
    "db_schema" TEXT,
    "db_table" TEXT,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."data_mappings_system" (
    "id" SERIAL NOT NULL,
    "dataSourceId" INTEGER NOT NULL,
    "accounts_id_in_system" TEXT,
    "accounts_name" TEXT,
    "accounts_email" TEXT,
    "accounts_cpf" TEXT,
    "accounts_status" TEXT,
    "accounts_identity_id" TEXT,
    "accounts_resource_name" TEXT,
    "resources_id_in_system" TEXT,
    "resources_name" TEXT,
    "resources_description" TEXT,
    "resources_permissions" TEXT,

    CONSTRAINT "data_mappings_system_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Accounts" (
    "id" SERIAL NOT NULL,
    "id_in_system_account" TEXT NOT NULL,
    "name_account" TEXT,
    "email_account" TEXT,
    "cpf_account" TEXT,
    "status_account" TEXT,
    "user_type_account" TEXT,
    "extra_data_account" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "systemId" INTEGER NOT NULL,
    "identityId" INTEGER,

    CONSTRAINT "Accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Resource" (
    "id" SERIAL NOT NULL,
    "name_resource" TEXT NOT NULL,
    "description_resource" TEXT,
    "permissions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "systemId" INTEGER NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Assignment" (
    "accountId" INTEGER NOT NULL,
    "resourceId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("accountId","resourceId")
);

-- CreateTable
CREATE TABLE "public"."account_divergence_exceptions" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "divergenceCode" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "account_divergence_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."identity_divergence_exceptions" (
    "id" SERIAL NOT NULL,
    "identityId" INTEGER NOT NULL,
    "divergenceCode" TEXT NOT NULL,
    "targetSystem" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "identity_divergence_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sod_rules" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "areaNegocio" TEXT,
    "processoNegocio" TEXT,
    "owner" TEXT,
    "ruleType" TEXT NOT NULL,
    "systemId" INTEGER,
    "valueAType" TEXT NOT NULL,
    "valueAId" TEXT NOT NULL,
    "valueAOperator" TEXT,
    "valueAValue" TEXT,
    "valueBType" TEXT NOT NULL,
    "valueBId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sod_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rbac_rules" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "areaNegocio" TEXT,
    "processoNegocio" TEXT,
    "owner" TEXT,
    "systemId" INTEGER NOT NULL,
    "grantedResourceId" INTEGER NOT NULL,
    "conditionType" TEXT NOT NULL,
    "requiredResourceId" INTEGER,
    "attributeName" TEXT,
    "attributeOperator" TEXT,
    "attributeValue" TEXT,
    "logicalOperator" TEXT,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rbac_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rbac_attribute_conditions" (
    "id" SERIAL NOT NULL,
    "rbacRuleId" INTEGER NOT NULL,
    "attributeName" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "attributeValue" TEXT NOT NULL,

    CONSTRAINT "rbac_attribute_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_GroupToUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_GroupToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_PackageToPlatform" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_PackageToPlatform_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_name_key" ON "public"."profiles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_key" ON "public"."password_resets"("token");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_path_key" ON "public"."credentials"("path");

-- CreateIndex
CREATE UNIQUE INDEX "groups_name_key" ON "public"."groups"("name");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_name_key" ON "public"."platforms"("name");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_key_key" ON "public"."platforms"("key");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_route_key" ON "public"."platforms"("route");

-- CreateIndex
CREATE UNIQUE INDEX "packages_name_key" ON "public"."packages"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_name_datasource_key" ON "public"."DataSource"("name_datasource");

-- CreateIndex
CREATE UNIQUE INDEX "HRConfig_dataSourceId_key" ON "public"."HRConfig"("dataSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentitiesHR_identity_id_hr_key" ON "public"."IdentitiesHR"("identity_id_hr");

-- CreateIndex
CREATE UNIQUE INDEX "IdentitiesHR_email_hr_key" ON "public"."IdentitiesHR"("email_hr");

-- CreateIndex
CREATE UNIQUE INDEX "IdentitiesHR_cpf_hr_key" ON "public"."IdentitiesHR"("cpf_hr");

-- CreateIndex
CREATE UNIQUE INDEX "data_mappings_hr_dataSourceId_key" ON "public"."data_mappings_hr"("dataSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "IDMConfig_dataSourceId_key" ON "public"."IDMConfig"("dataSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "data_mappings_idm_dataSourceId_key" ON "public"."data_mappings_idm"("dataSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentitiesIDM_identity_id_idm_key" ON "public"."IdentitiesIDM"("identity_id_idm");

-- CreateIndex
CREATE UNIQUE INDEX "IdentitiesIDM_email_idm_key" ON "public"."IdentitiesIDM"("email_idm");

-- CreateIndex
CREATE UNIQUE INDEX "RolesIDM_name_role_idm_key" ON "public"."RolesIDM"("name_role_idm");

-- CreateIndex
CREATE UNIQUE INDEX "Endpoint_IDM_name_endpoint_idm_key" ON "public"."Endpoint_IDM"("name_endpoint_idm");

-- CreateIndex
CREATE UNIQUE INDEX "System_name_system_key" ON "public"."System"("name_system");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_dataSourceId_key" ON "public"."SystemConfig"("dataSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "data_mappings_system_dataSourceId_key" ON "public"."data_mappings_system"("dataSourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Accounts_id_in_system_account_key" ON "public"."Accounts"("id_in_system_account");

-- CreateIndex
CREATE UNIQUE INDEX "account_divergence_exceptions_accountId_divergenceCode_key" ON "public"."account_divergence_exceptions"("accountId", "divergenceCode");

-- CreateIndex
CREATE UNIQUE INDEX "identity_divergence_exceptions_identityId_divergenceCode_ta_key" ON "public"."identity_divergence_exceptions"("identityId", "divergenceCode", "targetSystem");

-- CreateIndex
CREATE UNIQUE INDEX "sod_rules_userId_systemId_valueAType_valueAId_valueAOperato_key" ON "public"."sod_rules"("userId", "systemId", "valueAType", "valueAId", "valueAOperator", "valueAValue", "valueBType", "valueBId");

-- CreateIndex
CREATE UNIQUE INDEX "rbac_rules_userId_systemId_grantedResourceId_conditionType__key" ON "public"."rbac_rules"("userId", "systemId", "grantedResourceId", "conditionType", "requiredResourceId", "attributeName", "attributeOperator", "attributeValue", "logicalOperator");

-- CreateIndex
CREATE INDEX "_GroupToUser_B_index" ON "public"."_GroupToUser"("B");

-- CreateIndex
CREATE INDEX "_PackageToPlatform_B_index" ON "public"."_PackageToPlatform"("B");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "public"."packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DataSource" ADD CONSTRAINT "DataSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."import_logs" ADD CONSTRAINT "import_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."import_logs" ADD CONSTRAINT "import_logs_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "public"."DataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HRConfig" ADD CONSTRAINT "HRConfig_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "public"."DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IdentitiesHR" ADD CONSTRAINT "IdentitiesHR_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "public"."DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."data_mappings_hr" ADD CONSTRAINT "data_mappings_hr_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "public"."DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IDMConfig" ADD CONSTRAINT "IDMConfig_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "public"."DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."data_mappings_idm" ADD CONSTRAINT "data_mappings_idm_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "public"."DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IdentitiesIDM" ADD CONSTRAINT "IdentitiesIDM_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "public"."DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Identities_RolesIDM" ADD CONSTRAINT "Identities_RolesIDM_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "public"."IdentitiesIDM"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Identities_RolesIDM" ADD CONSTRAINT "Identities_RolesIDM_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."RolesIDM"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RolesIDM_Endpoint" ADD CONSTRAINT "RolesIDM_Endpoint_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."RolesIDM"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RolesIDM_Endpoint" ADD CONSTRAINT "RolesIDM_Endpoint_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "public"."Endpoint_IDM"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Endpoint_Source" ADD CONSTRAINT "Endpoint_Source_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "public"."Endpoint_IDM"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Endpoint_Source" ADD CONSTRAINT "Endpoint_Source_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "public"."ResourceIDM"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SystemConfig" ADD CONSTRAINT "SystemConfig_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "public"."DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SystemConfig" ADD CONSTRAINT "SystemConfig_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "public"."System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."data_mappings_system" ADD CONSTRAINT "data_mappings_system_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "public"."DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Accounts" ADD CONSTRAINT "Accounts_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "public"."System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Accounts" ADD CONSTRAINT "Accounts_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "public"."IdentitiesHR"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Resource" ADD CONSTRAINT "Resource_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "public"."System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Assignment" ADD CONSTRAINT "Assignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Assignment" ADD CONSTRAINT "Assignment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "public"."Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."account_divergence_exceptions" ADD CONSTRAINT "account_divergence_exceptions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."Accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."account_divergence_exceptions" ADD CONSTRAINT "account_divergence_exceptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."identity_divergence_exceptions" ADD CONSTRAINT "identity_divergence_exceptions_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "public"."IdentitiesHR"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."identity_divergence_exceptions" ADD CONSTRAINT "identity_divergence_exceptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sod_rules" ADD CONSTRAINT "sod_rules_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "public"."System"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sod_rules" ADD CONSTRAINT "sod_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rbac_rules" ADD CONSTRAINT "rbac_rules_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "public"."System"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rbac_rules" ADD CONSTRAINT "rbac_rules_grantedResourceId_fkey" FOREIGN KEY ("grantedResourceId") REFERENCES "public"."Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rbac_rules" ADD CONSTRAINT "rbac_rules_requiredResourceId_fkey" FOREIGN KEY ("requiredResourceId") REFERENCES "public"."Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rbac_rules" ADD CONSTRAINT "rbac_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rbac_attribute_conditions" ADD CONSTRAINT "rbac_attribute_conditions_rbacRuleId_fkey" FOREIGN KEY ("rbacRuleId") REFERENCES "public"."rbac_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_GroupToUser" ADD CONSTRAINT "_GroupToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_GroupToUser" ADD CONSTRAINT "_GroupToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PackageToPlatform" ADD CONSTRAINT "_PackageToPlatform_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_PackageToPlatform" ADD CONSTRAINT "_PackageToPlatform_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
