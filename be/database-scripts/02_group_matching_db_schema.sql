-- GroupMatching / group_matching_db baseline schema (PostgreSQL 16).
-- All student and semester identifiers are opaque values owned by
-- IdentitySemester: no cross-service database foreign keys are created.

CREATE TABLE IF NOT EXISTS "Groups" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "GroupCode" character varying(64) NOT NULL,
    "GroupName" character varying(120) NOT NULL,
    "ProjectDescription" character varying(1200) NOT NULL DEFAULT '',
    "TopicTitle" character varying(300) NULL,
    "SemesterCode" character varying(30) NOT NULL,
    "Status" integer NOT NULL,
    "LeaderStudentId" uuid NULL,
    "CreatedByStudentId" uuid NULL,
    "TopicRegisteredAt" timestamp with time zone NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Groups_GroupCode" ON "Groups" ("GroupCode");
CREATE INDEX IF NOT EXISTS "IX_Groups_SemesterCode_Status" ON "Groups" ("SemesterCode", "Status");

CREATE TABLE IF NOT EXISTS "GroupMembers" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "GroupId" uuid NOT NULL REFERENCES "Groups" ("Id") ON DELETE CASCADE,
    "StudentId" uuid NOT NULL,
    "StudentCode" character varying(30) NOT NULL,
    "FullName" character varying(200) NOT NULL,
    "Role" integer NOT NULL,
    "JoinedAt" timestamp with time zone NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_GroupMembers_GroupId_StudentId" ON "GroupMembers" ("GroupId", "StudentId");
CREATE UNIQUE INDEX IF NOT EXISTS "IX_GroupMembers_StudentId" ON "GroupMembers" ("StudentId");

CREATE TABLE IF NOT EXISTS "LeaderVotes" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "GroupId" uuid NOT NULL REFERENCES "Groups" ("Id") ON DELETE CASCADE,
    "VoterStudentId" uuid NOT NULL,
    "NominatedStudentId" uuid NOT NULL,
    "VotedAt" timestamp with time zone NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_LeaderVotes_GroupId_VoterStudentId" ON "LeaderVotes" ("GroupId", "VoterStudentId");

CREATE TABLE IF NOT EXISTS "GroupRecruitmentNeeds" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "GroupId" uuid NOT NULL REFERENCES "Groups" ("Id") ON DELETE CASCADE,
    "RoleCode" character varying(40) NOT NULL,
    "Slots" integer NOT NULL CHECK ("Slots" > 0),
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_GroupRecruitmentNeeds_GroupId_RoleCode" ON "GroupRecruitmentNeeds" ("GroupId", "RoleCode");

CREATE TABLE IF NOT EXISTS "GroupEventOutbox" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "Topic" character varying(80) NOT NULL,
    "Payload" jsonb NOT NULL,
    "PublishedAt" timestamp with time zone NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NULL
);
CREATE INDEX IF NOT EXISTS "IX_GroupEventOutbox_PublishedAt" ON "GroupEventOutbox" ("PublishedAt");
