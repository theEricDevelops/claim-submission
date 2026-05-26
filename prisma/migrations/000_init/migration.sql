-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'PENDING', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST', 'CLOSED');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('PERSON', 'COMPANY');

-- CreateEnum
CREATE TYPE "JobRole" AS ENUM ('NAMED_INSURED', 'CARRIER_ADJUSTER', 'PUBLIC_ADJUSTER', 'ATTORNEY', 'APPRAISER', 'UMPIRE');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('PA_AGREEMENT', 'CONTRACTOR_AGREEMENT', 'ATTORNEY_ENGAGEMENT', 'APPRAISAL_AGREEMENT', 'UMPIRE_ENGAGEMENT');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('PERCENTAGE', 'FLAT_FEE', 'HOURLY');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'ACTIVE', 'COMPLETED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'REMOVED');

-- CreateEnum
CREATE TYPE "NoteableType" AS ENUM ('JOB', 'LEAD', 'CONTACT', 'PERSON', 'COMPANY', 'DOCUMENT', 'CONTRACT');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('PHOTO', 'ESTIMATE', 'POLICY', 'REPORT', 'CORRESPONDENCE', 'INVOICE', 'OTHER');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('EMAIL', 'PHONE', 'TEXT', 'MEETING', 'RECORD');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('CREATED', 'EDITED', 'DELETED', 'COMPLETED', 'DESTROYED');

-- CreateEnum
CREATE TYPE "EmailTarget" AS ENUM ('JOB', 'LEAD', 'CONTACT');

-- CreateTable
CREATE TABLE "Activity" (
    "id" UUID NOT NULL,
    "activityType" "ActivityType" NOT NULL,
    "activityId" UUID NOT NULL,
    "actionType" "ActivityAction" NOT NULL,
    "actorId" UUID NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentContact" (
    "id" UUID NOT NULL,
    "jobId" UUID,
    "leadId" UUID,
    "contactId" UUID NOT NULL,
    "role" "JobRole" NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "AssignmentContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyContact" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "jobTitle" TEXT,

    CONSTRAINT "CompanyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" UUID NOT NULL,
    "type" "ContactType" NOT NULL DEFAULT 'PERSON',
    "name" TEXT NOT NULL,
    "personId" UUID,
    "companyId" UUID,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Phone" (
    "id" UUID NOT NULL,
    "phoneContactId" UUID NOT NULL,
    "country" VARCHAR(3) NOT NULL,
    "number" VARCHAR(10) NOT NULL,
    "type" VARCHAR(25) NOT NULL,

    CONSTRAINT "Phone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Email" (
    "id" UUID NOT NULL,
    "emailContactId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "type" VARCHAR(25) NOT NULL,

    CONSTRAINT "Email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" UUID NOT NULL,
    "contactId" UUID,
    "street" TEXT NOT NULL,
    "street2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" VARCHAR(5) NOT NULL,
    "plus4" VARCHAR(4),
    "type" VARCHAR(25) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" UUID NOT NULL,
    "jobId" UUID,
    "leadId" UUID,
    "providerId" UUID NOT NULL,
    "type" "ContractType" NOT NULL,
    "feeType" "FeeType" NOT NULL,
    "feeValue" DOUBLE PRECISION NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "submissionId" TEXT,
    "signedAt" TIMESTAMP(3),
    "effectiveAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "jobId" UUID,
    "leadId" UUID,
    "uploadedById" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "storageKey" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" UUID NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT[],
    "cc" TEXT[],
    "bcc" TEXT[],
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetId" UUID NOT NULL,
    "targetType" "EmailTarget" NOT NULL,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" UUID NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "policyId" UUID NOT NULL,
    "lossAddressId" UUID NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" UUID NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "policyId" UUID NOT NULL,
    "lossAddressId" UUID NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "memberUserName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" UUID NOT NULL,
    "noteableType" "NoteableType" NOT NULL,
    "noteableId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" UUID NOT NULL,
    "salutation" VARCHAR(25) NOT NULL,
    "firstName" VARCHAR(65) NOT NULL,
    "middleName" VARCHAR(65),
    "lastName" VARCHAR(65) NOT NULL,
    "suffix" VARCHAR(25),

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" UUID NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "claimNumber" TEXT,
    "dateOfLoss" TIMESTAMP(3),
    "typeOfLoss" TEXT,
    "deductible" DOUBLE PRECISION,
    "coverageLimits" JSONB,
    "carrierId" UUID NOT NULL,
    "policyEffectiveDate" TIMESTAMP(3),
    "policyExpirationDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "secretKey" TEXT NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantConfig" (
    "tenantId" UUID NOT NULL,
    "primaryColor" TEXT NOT NULL,
    "secondaryColor" TEXT NOT NULL,
    "phoneTypes" TEXT[] DEFAULT ARRAY['home', 'work', 'cell', 'fax', 'other']::TEXT[],
    "emailTypes" TEXT[] DEFAULT ARRAY['home', 'work', 'other']::TEXT[],
    "addressTypes" TEXT[] DEFAULT ARRAY['home', 'work', 'mailing', 'other']::TEXT[]
);

-- CreateTable
CREATE TABLE "TenantRole" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "privileges" TEXT[],

    CONSTRAINT "TenantRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantInvite" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "TenantInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "personId" UUID NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_LenderOnPolicies" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_LenderOnPolicies_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ContactToContract" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ContactToContract_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_MemberToTenantRole" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_MemberToTenantRole_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TenantMembers" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_TenantMembers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TenantAdmins" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_TenantAdmins_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TenantUsers" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_TenantUsers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TenantRoleToUser" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_TenantRoleToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Activity_activityType_activityId_idx" ON "Activity"("activityType", "activityId");

-- CreateIndex
CREATE INDEX "Activity_actorId_idx" ON "Activity"("actorId");

-- CreateIndex
CREATE INDEX "AssignmentContact_jobId_idx" ON "AssignmentContact"("jobId");

-- CreateIndex
CREATE INDEX "AssignmentContact_leadId_idx" ON "AssignmentContact"("leadId");

-- CreateIndex
CREATE INDEX "AssignmentContact_contactId_idx" ON "AssignmentContact"("contactId");

-- CreateIndex
CREATE INDEX "AssignmentContact_status_idx" ON "AssignmentContact"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE INDEX "CompanyContact_companyId_idx" ON "CompanyContact"("companyId");

-- CreateIndex
CREATE INDEX "CompanyContact_contactId_idx" ON "CompanyContact"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_personId_key" ON "Contact"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_companyId_key" ON "Contact"("companyId");

-- CreateIndex
CREATE INDEX "Phone_phoneContactId_idx" ON "Phone"("phoneContactId");

-- CreateIndex
CREATE UNIQUE INDEX "Email_text_key" ON "Email"("text");

-- CreateIndex
CREATE INDEX "Email_emailContactId_idx" ON "Email"("emailContactId");

-- CreateIndex
CREATE INDEX "Address_contactId_idx" ON "Address"("contactId");

-- CreateIndex
CREATE INDEX "Contract_jobId_idx" ON "Contract"("jobId");

-- CreateIndex
CREATE INDEX "Contract_leadId_idx" ON "Contract"("leadId");

-- CreateIndex
CREATE INDEX "Contract_providerId_idx" ON "Contract"("providerId");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE INDEX "Document_jobId_idx" ON "Document"("jobId");

-- CreateIndex
CREATE INDEX "Document_leadId_idx" ON "Document"("leadId");

-- CreateIndex
CREATE INDEX "Document_uploadedById_idx" ON "Document"("uploadedById");

-- CreateIndex
CREATE INDEX "Document_category_idx" ON "Document"("category");

-- CreateIndex
CREATE INDEX "Document_createdAt_idx" ON "Document"("createdAt");

-- CreateIndex
CREATE INDEX "EmailMessage_targetType_targetId_idx" ON "EmailMessage"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_lossAddressId_key" ON "Job"("lossAddressId");

-- CreateIndex
CREATE INDEX "Job_policyId_idx" ON "Job"("policyId");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_lossAddressId_key" ON "Lead"("lossAddressId");

-- CreateIndex
CREATE INDEX "Lead_policyId_idx" ON "Lead"("policyId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Member_personId_key" ON "Member"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_memberUserName_key" ON "Member"("memberUserName");

-- CreateIndex
CREATE INDEX "Note_noteableType_noteableId_idx" ON "Note"("noteableType", "noteableId");

-- CreateIndex
CREATE INDEX "Note_authorId_idx" ON "Note"("authorId");

-- CreateIndex
CREATE INDEX "Person_lastName_firstName_idx" ON "Person"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Policy_carrierId_idx" ON "Policy"("carrierId");

-- CreateIndex
CREATE INDEX "Policy_policyNumber_idx" ON "Policy"("policyNumber");

-- CreateIndex
CREATE INDEX "Policy_claimNumber_idx" ON "Policy"("claimNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_name_key" ON "Tenant"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_subdomain_key" ON "Tenant"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_secretKey_key" ON "Tenant"("secretKey");

-- CreateIndex
CREATE UNIQUE INDEX "TenantConfig_tenantId_key" ON "TenantConfig"("tenantId");

-- CreateIndex
CREATE INDEX "TenantRole_tenantId_idx" ON "TenantRole"("tenantId");

-- CreateIndex
CREATE INDEX "TenantInvite_tenantId_idx" ON "TenantInvite"("tenantId");

-- CreateIndex
CREATE INDEX "TenantInvite_email_idx" ON "TenantInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_personId_key" ON "User"("personId");

-- CreateIndex
CREATE INDEX "_LenderOnPolicies_B_index" ON "_LenderOnPolicies"("B");

-- CreateIndex
CREATE INDEX "_ContactToContract_B_index" ON "_ContactToContract"("B");

-- CreateIndex
CREATE INDEX "_MemberToTenantRole_B_index" ON "_MemberToTenantRole"("B");

-- CreateIndex
CREATE INDEX "_TenantMembers_B_index" ON "_TenantMembers"("B");

-- CreateIndex
CREATE INDEX "_TenantAdmins_B_index" ON "_TenantAdmins"("B");

-- CreateIndex
CREATE INDEX "_TenantUsers_B_index" ON "_TenantUsers"("B");

-- CreateIndex
CREATE INDEX "_TenantRoleToUser_B_index" ON "_TenantRoleToUser"("B");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentContact" ADD CONSTRAINT "AssignmentContact_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentContact" ADD CONSTRAINT "AssignmentContact_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentContact" ADD CONSTRAINT "AssignmentContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Phone" ADD CONSTRAINT "Phone_phoneContactId_fkey" FOREIGN KEY ("phoneContactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Email" ADD CONSTRAINT "Email_emailContactId_fkey" FOREIGN KEY ("emailContactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_lossAddressId_fkey" FOREIGN KEY ("lossAddressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_lossAddressId_fkey" FOREIGN KEY ("lossAddressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantConfig" ADD CONSTRAINT "TenantConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantRole" ADD CONSTRAINT "TenantRole_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInvite" ADD CONSTRAINT "TenantInvite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LenderOnPolicies" ADD CONSTRAINT "_LenderOnPolicies_A_fkey" FOREIGN KEY ("A") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LenderOnPolicies" ADD CONSTRAINT "_LenderOnPolicies_B_fkey" FOREIGN KEY ("B") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContactToContract" ADD CONSTRAINT "_ContactToContract_A_fkey" FOREIGN KEY ("A") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContactToContract" ADD CONSTRAINT "_ContactToContract_B_fkey" FOREIGN KEY ("B") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MemberToTenantRole" ADD CONSTRAINT "_MemberToTenantRole_A_fkey" FOREIGN KEY ("A") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MemberToTenantRole" ADD CONSTRAINT "_MemberToTenantRole_B_fkey" FOREIGN KEY ("B") REFERENCES "TenantRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TenantMembers" ADD CONSTRAINT "_TenantMembers_A_fkey" FOREIGN KEY ("A") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TenantMembers" ADD CONSTRAINT "_TenantMembers_B_fkey" FOREIGN KEY ("B") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TenantAdmins" ADD CONSTRAINT "_TenantAdmins_A_fkey" FOREIGN KEY ("A") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TenantAdmins" ADD CONSTRAINT "_TenantAdmins_B_fkey" FOREIGN KEY ("B") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TenantUsers" ADD CONSTRAINT "_TenantUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TenantUsers" ADD CONSTRAINT "_TenantUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TenantRoleToUser" ADD CONSTRAINT "_TenantRoleToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "TenantRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TenantRoleToUser" ADD CONSTRAINT "_TenantRoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
