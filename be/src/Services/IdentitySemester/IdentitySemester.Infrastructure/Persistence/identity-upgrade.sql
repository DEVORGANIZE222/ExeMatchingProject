-- Idempotent, additive upgrade for existing Phase 1 EnsureCreated databases.
-- Executed inside a transaction by DatabaseInitializer after EnsureCreated.
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "TokenVersion" integer NOT NULL DEFAULT 0;
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "GoogleSubject" text;
ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "GooglePictureUrl" text;
ALTER TABLE "Semesters" ADD COLUMN IF NOT EXISTS "RegistrationDeadline" timestamptz;
ALTER TABLE "Semesters" ADD COLUMN IF NOT EXISTS "TopicDeadline" timestamptz;
ALTER TABLE "Semesters" ADD COLUMN IF NOT EXISTS "MentorDeadline" timestamptz;
-- Phase 1 used cascade deletion here. Match the new Restrict model without deleting rows.
ALTER TABLE "Students" DROP CONSTRAINT IF EXISTS "FK_Students_Semesters_SemesterId";
ALTER TABLE "Students" ADD CONSTRAINT "FK_Students_Semesters_SemesterId"
    FOREIGN KEY ("SemesterId") REFERENCES "Semesters" ("Id") ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Users_Email_Normalized" ON "Users" (lower(trim("Email")));
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Users_GoogleSubject" ON "Users" ("GoogleSubject") WHERE "GoogleSubject" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Semesters_Code_Normalized" ON "Semesters" (upper(trim("Code")));
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Students_Semester_Code" ON "Students" ("SemesterId", upper(trim("StudentCode")));
CREATE UNIQUE INDEX IF NOT EXISTS "UX_Students_Semester_User" ON "Students" ("SemesterId", "UserId");
CREATE TABLE IF NOT EXISTS "StudentEventOutbox" (
    "Id" uuid PRIMARY KEY,
    "CreatedAt" timestamptz NOT NULL,
    "UpdatedAt" timestamptz NULL,
    "Payload" text NOT NULL,
    "PublishedAt" timestamptz NULL
);
ALTER TABLE "StudentEventOutbox" ADD COLUMN IF NOT EXISTS "Topic" varchar(80) NOT NULL DEFAULT 'student-imported';
CREATE TABLE IF NOT EXISTS "GoogleAllowedEmails" (
    "Id" uuid PRIMARY KEY,
    "CreatedAt" timestamptz NOT NULL,
    "UpdatedAt" timestamptz NULL,
    "Email" text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "UX_GoogleAllowedEmails_Email_Normalized" ON "GoogleAllowedEmails" (lower(trim("Email")));
CREATE TABLE IF NOT EXISTS "StudentStrengthRoles" (
    "Id" uuid PRIMARY KEY,
    "CreatedAt" timestamptz NOT NULL,
    "UpdatedAt" timestamptz NULL,
    "StudentId" uuid NOT NULL REFERENCES "Students" ("Id") ON DELETE CASCADE,
    "RoleCode" varchar(40) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "UX_StudentStrengthRoles_Student_Role" ON "StudentStrengthRoles" ("StudentId", "RoleCode");

-- Remove only the immutable scaffold sample account.  Do not touch real roster
-- entries or semesters: existing installations may already use FALL2026.
DELETE FROM "Students"
WHERE "Id" = '55555555-5555-5555-5555-555555555555'
  AND "StudentCode" = 'SE160001'
  AND "FullName" = 'Nguyen Van A';
DELETE FROM "Users"
WHERE "Id" = '44444444-4444-4444-4444-444444444444'
  AND lower("Email") = 'student01@fpt.edu.vn';
DELETE FROM "GoogleAllowedEmails"
WHERE lower("Email") = 'student01@fpt.edu.vn';
