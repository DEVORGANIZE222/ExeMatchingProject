-- Mentor / mentor_db baseline schema (PostgreSQL 16).
-- Table and column names match the EF Core mapping in
-- Mentor.Infrastructure/Persistence/MentorDbContext.cs (quoted PascalCase), so this script
-- produces the same schema the service expects. Logical names:
--   mentor_users          -> "Mentors"
--   mentor_quotas         -> "MentorQuotas"
--   mentor_requests       -> "MentorRequests"
--   mentor_group_progress -> "MentorGroupProgress"
--   mentor_appointments   -> "MentorAppointments"
--   mentor_notifications  -> "MentorNotifications"
-- User and group identifiers are opaque values owned by IdentitySemester / GroupMatching:
-- no cross-service database foreign keys are created.
-- RequestStatus enum is stored as integer: 0 = Pending, 1 = Approved, 2 = Rejected.
-- Idempotent: safe to run against an empty database more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS "Mentors" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "UserId" uuid NOT NULL,
    "FullName" text NOT NULL,
    "Email" text NOT NULL,
    "Department" text NOT NULL,
    "Expertise" text NOT NULL DEFAULT '',
    "Phone" character varying(40) NOT NULL DEFAULT '',
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt" timestamp with time zone NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Mentors_UserId" ON "Mentors" ("UserId");

CREATE TABLE IF NOT EXISTS "MentorQuotas" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "MentorId" uuid NOT NULL REFERENCES "Mentors" ("Id") ON DELETE CASCADE,
    "MaxQuota" integer NOT NULL DEFAULT 5,
    "CurrentAssigned" integer NOT NULL DEFAULT 0,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt" timestamp with time zone NULL,
    CONSTRAINT "CK_MentorQuotas_MaxQuota" CHECK ("MaxQuota" >= 1),
    CONSTRAINT "CK_MentorQuotas_CurrentAssigned" CHECK ("CurrentAssigned" >= 0 AND "CurrentAssigned" <= "MaxQuota")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_MentorQuotas_MentorId" ON "MentorQuotas" ("MentorId");

CREATE TABLE IF NOT EXISTS "MentorRequests" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "GroupId" uuid NOT NULL,
    "MentorId" uuid NOT NULL REFERENCES "Mentors" ("Id") ON DELETE CASCADE,
    "RequesterUserId" uuid NULL,
    "RequesterName" text NOT NULL DEFAULT '',
    "GroupName" text NOT NULL DEFAULT '',
    "Topic" text NOT NULL DEFAULT '',
    "Message" text NOT NULL,
    "Status" integer NOT NULL DEFAULT 0,
    "DecisionReason" text NULL,
    "DecidedAt" timestamp with time zone NULL,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt" timestamp with time zone NULL,
    CONSTRAINT "CK_MentorRequests_Status" CHECK ("Status" IN (0, 1, 2))
);
CREATE INDEX IF NOT EXISTS "IX_MentorRequests_MentorId" ON "MentorRequests" ("MentorId");
-- At most one Pending request per group.
CREATE UNIQUE INDEX IF NOT EXISTS "IX_MentorRequests_GroupId" ON "MentorRequests" ("GroupId") WHERE "Status" = 0;

CREATE TABLE IF NOT EXISTS "MentorGroupProgress" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "MentorId" uuid NOT NULL,
    "GroupId" uuid NOT NULL,
    "GroupName" character varying(200) NOT NULL,
    "Topic" character varying(1000) NOT NULL,
    "Milestone" character varying(200) NOT NULL,
    "Progress" integer NOT NULL DEFAULT 0,
    "Feedback" character varying(2000) NOT NULL DEFAULT '',
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt" timestamp with time zone NULL,
    CONSTRAINT "CK_MentorGroupProgress_Progress" CHECK ("Progress" BETWEEN 0 AND 100)
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_MentorGroupProgress_MentorId_GroupId" ON "MentorGroupProgress" ("MentorId", "GroupId");

CREATE TABLE IF NOT EXISTS "MentorAppointments" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "MentorId" uuid NOT NULL,
    "GroupId" uuid NULL,
    "Title" character varying(200) NOT NULL,
    "StartsAt" timestamp with time zone NOT NULL,
    "Notes" character varying(2000) NOT NULL DEFAULT '',
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt" timestamp with time zone NULL
);
CREATE INDEX IF NOT EXISTS "IX_MentorAppointments_MentorId_StartsAt" ON "MentorAppointments" ("MentorId", "StartsAt");

CREATE TABLE IF NOT EXISTS "MentorNotifications" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "MentorId" uuid NOT NULL,
    "Type" character varying(40) NOT NULL,
    "Title" character varying(200) NOT NULL,
    "Message" character varying(1000) NOT NULL,
    "IsRead" boolean NOT NULL DEFAULT FALSE,
    "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
    "UpdatedAt" timestamp with time zone NULL
);
CREATE INDEX IF NOT EXISTS "IX_MentorNotifications_MentorId_CreatedAt" ON "MentorNotifications" ("MentorId", "CreatedAt" DESC);

-- Seed data (mirrors MentorDbContext.HasData).
INSERT INTO "Mentors" ("Id", "UserId", "FullName", "Email", "Department", "Expertise", "Phone", "CreatedAt") VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Dr. Le Van C', 'clevan@fpt.edu.vn',
   'Software Engineering', 'AI, Microservices, Cloud Computing', '', '2026-01-01 00:00:00+00'),
  ('77777777-7777-7777-7777-777777777777', '88888888-8888-8888-8888-888888888888', 'ThS. Đặng Hùng (Mentor)', 'danghung25022005@gmail.com',
   'Software Engineering', 'EXE Capstone, AI, Fullstack & Mobile Architecture', '', '2026-01-01 00:00:00+00')
ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "MentorQuotas" ("Id", "MentorId", "MaxQuota", "CurrentAssigned", "CreatedAt") VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 5, 1, '2026-01-01 00:00:00+00'),
  ('99999999-9999-9999-9999-999999999999', '77777777-7777-7777-7777-777777777777', 5, 0, '2026-01-01 00:00:00+00')
ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "MentorRequests" ("Id", "GroupId", "MentorId", "Message", "Status", "CreatedAt") VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '66666666-6666-6666-6666-666666666666', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'Dear Dr. Le Van C, we would love to have you as our EXE mentor.', 0, NOW())
ON CONFLICT ("Id") DO NOTHING;

COMMIT;
