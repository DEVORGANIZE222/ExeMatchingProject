-- Idempotent and additive. Existing demo data is deliberately preserved.
ALTER TABLE "Groups" ADD COLUMN IF NOT EXISTS "CreatedByStudentId" uuid NULL;
ALTER TABLE "Groups" ADD COLUMN IF NOT EXISTS "TopicRegisteredAt" timestamptz NULL;
ALTER TABLE "Groups" ADD COLUMN IF NOT EXISTS "ProjectDescription" varchar(1200) NOT NULL DEFAULT '';
ALTER TABLE "GroupMembers" ADD COLUMN IF NOT EXISTS "IsDemo" boolean NOT NULL DEFAULT false;
ALTER TABLE "GroupMembers" ADD COLUMN IF NOT EXISTS "Email" varchar(254) NOT NULL DEFAULT '';
ALTER TABLE "GroupMembers" ADD COLUMN IF NOT EXISTS "Major" varchar(100) NOT NULL DEFAULT '';
ALTER TABLE "GroupMembers" ADD COLUMN IF NOT EXISTS "AvatarUrl" text NULL;
-- A group is created before its members elect a leader.
ALTER TABLE "Groups" ALTER COLUMN "LeaderStudentId" DROP NOT NULL;
ALTER TABLE "Groups" ALTER COLUMN "TopicTitle" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Groups_GroupCode" ON "Groups" ("GroupCode");
CREATE UNIQUE INDEX IF NOT EXISTS "UX_GroupMembers_Group_Student" ON "GroupMembers" ("GroupId", "StudentId");
CREATE UNIQUE INDEX IF NOT EXISTS "UX_GroupMembers_Student" ON "GroupMembers" ("StudentId");
CREATE UNIQUE INDEX IF NOT EXISTS "UX_LeaderVotes_Group_Voter" ON "LeaderVotes" ("GroupId", "VoterStudentId");
CREATE TABLE IF NOT EXISTS "GroupEventOutbox" (
    "Id" uuid PRIMARY KEY,
    "CreatedAt" timestamptz NOT NULL,
    "UpdatedAt" timestamptz NULL,
    "Topic" varchar(80) NOT NULL,
    "Payload" jsonb NOT NULL,
    "PublishedAt" timestamptz NULL
);
CREATE INDEX IF NOT EXISTS "IX_GroupEventOutbox_PublishedAt" ON "GroupEventOutbox" ("PublishedAt");
CREATE TABLE IF NOT EXISTS "GroupRecruitmentNeeds" (
    "Id" uuid PRIMARY KEY,
    "CreatedAt" timestamptz NOT NULL,
    "UpdatedAt" timestamptz NULL,
    "GroupId" uuid NOT NULL REFERENCES "Groups" ("Id") ON DELETE CASCADE,
    "RoleCode" varchar(40) NOT NULL,
    "Slots" integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "UX_GroupRecruitmentNeeds_Group_Role" ON "GroupRecruitmentNeeds" ("GroupId", "RoleCode");
