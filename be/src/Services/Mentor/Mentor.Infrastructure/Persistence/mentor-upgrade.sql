-- Idempotent, additive upgrade for Mentor databases created with EnsureCreated.
-- Executed inside a transaction by MentorDatabaseInitializer after EnsureCreated.

ALTER TABLE "MentorRequests" ADD COLUMN IF NOT EXISTS "RequesterUserId" uuid NULL;
ALTER TABLE "MentorRequests" ADD COLUMN IF NOT EXISTS "RequesterEmail" character varying(254) NOT NULL DEFAULT '';
ALTER TABLE "MentorRequests" ADD COLUMN IF NOT EXISTS "RequesterName" character varying(200) NOT NULL DEFAULT '';
ALTER TABLE "MentorRequests" ADD COLUMN IF NOT EXISTS "GroupName" character varying(200) NOT NULL DEFAULT '';
ALTER TABLE "MentorRequests" ADD COLUMN IF NOT EXISTS "Topic" character varying(1000) NOT NULL DEFAULT '';
ALTER TABLE "MentorRequests" ADD COLUMN IF NOT EXISTS "DecisionReason" character varying(2000) NULL;
ALTER TABLE "MentorRequests" ADD COLUMN IF NOT EXISTS "DecidedAt" timestamp with time zone NULL;
ALTER TABLE "MentorRequests" ADD COLUMN IF NOT EXISTS "UpdatedAt" timestamp with time zone NULL;
ALTER TABLE "Mentors" ADD COLUMN IF NOT EXISTS "Phone" character varying(40) NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS "IX_MentorRequests_GroupId"
    ON "MentorRequests" ("GroupId") WHERE "Status" = 0;

CREATE TABLE IF NOT EXISTS "MentorGroupProgress" (
    "Id" uuid PRIMARY KEY,
    "MentorId" uuid NOT NULL,
    "GroupId" uuid NOT NULL,
    "GroupName" character varying(200) NOT NULL,
    "Topic" character varying(1000) NOT NULL,
    "Milestone" character varying(200) NOT NULL,
    "Progress" integer NOT NULL,
    "Feedback" character varying(2000) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_MentorGroupProgress_MentorId_GroupId"
    ON "MentorGroupProgress" ("MentorId", "GroupId");

CREATE TABLE IF NOT EXISTS "MentorAppointments" (
    "Id" uuid PRIMARY KEY,
    "MentorId" uuid NOT NULL,
    "GroupId" uuid NULL,
    "Title" character varying(200) NOT NULL,
    "StartsAt" timestamp with time zone NOT NULL,
    "Notes" character varying(2000) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NULL
);

CREATE TABLE IF NOT EXISTS "MentorNotifications" (
    "Id" uuid PRIMARY KEY,
    "MentorId" uuid NOT NULL,
    "Type" character varying(40) NOT NULL,
    "Title" character varying(200) NOT NULL,
    "Message" character varying(1000) NOT NULL,
    "IsRead" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NULL
);

CREATE TABLE IF NOT EXISTS "StudentNotifications" (
    "Id" uuid PRIMARY KEY,
    "GroupId" uuid NOT NULL,
    "RequestId" uuid NULL,
    "MentorName" character varying(200) NOT NULL DEFAULT '',
    "GroupName" character varying(200) NOT NULL DEFAULT '',
    "Type" character varying(40) NOT NULL,
    "Title" character varying(200) NOT NULL,
    "Message" character varying(2500) NOT NULL,
    "IsRead" boolean NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NULL
);
CREATE INDEX IF NOT EXISTS "IX_StudentNotifications_GroupId_CreatedAt"
    ON "StudentNotifications" ("GroupId", "CreatedAt" DESC);
CREATE INDEX IF NOT EXISTS "IX_StudentNotifications_RequestId"
    ON "StudentNotifications" ("RequestId");

-- One-time idempotent backfill for historical mentor decisions recorded before StudentNotifications existed.
INSERT INTO "StudentNotifications" (
    "Id", "GroupId", "RequestId", "MentorName", "GroupName",
    "Type", "Title", "Message", "IsRead", "CreatedAt", "UpdatedAt"
)
SELECT
    r."Id",
    r."GroupId",
    r."Id",
    LEFT(m."FullName", 200),
    LEFT(r."GroupName", 200),
    CASE WHEN r."Status" = 1 THEN 'decision-approved' ELSE 'decision-rejected' END,
    LEFT(CASE
        WHEN r."Status" = 1 THEN 'GVHD ' || m."FullName" || ' đã chấp thuận hướng dẫn'
        ELSE 'GVHD ' || m."FullName" || ' đã từ chối lời mời'
    END, 200),
    LEFT(CASE
        WHEN r."Status" = 1 AND NULLIF(BTRIM(COALESCE(r."DecisionReason", '')), '') IS NOT NULL
            THEN 'Lời nhắn từ giảng viên: ' || BTRIM(r."DecisionReason")
        WHEN r."Status" = 1
            THEN 'Giảng viên ' || m."FullName" || ' đã đồng ý hướng dẫn nhóm ' || r."GroupName" || '.'
        WHEN NULLIF(BTRIM(COALESCE(r."DecisionReason", '')), '') IS NOT NULL
            THEN 'Lý do từ chối: ' || BTRIM(r."DecisionReason")
        ELSE 'Giảng viên ' || m."FullName" || ' đã từ chối yêu cầu hướng dẫn của nhóm ' || r."GroupName" || '.'
    END, 2500),
    false,
    COALESCE(r."DecidedAt", r."UpdatedAt", r."CreatedAt"),
    NULL
FROM "MentorRequests" r
JOIN "Mentors" m ON m."Id" = r."MentorId"
WHERE r."Status" IN (1, 2)
  AND NOT EXISTS (
      SELECT 1 FROM "StudentNotifications" sn WHERE sn."RequestId" = r."Id"
  );

