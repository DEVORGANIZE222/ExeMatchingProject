-- Idempotent and additive. Existing demo data is deliberately preserved.
ALTER TABLE "Groups" ADD COLUMN IF NOT EXISTS "CreatedByStudentId" uuid NULL;
ALTER TABLE "Groups" ADD COLUMN IF NOT EXISTS "TopicRegisteredAt" timestamptz NULL;
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
