-- IdentitySemester / identity_db baseline schema (PostgreSQL 16).
-- Safe for a new database. Existing installations should use the additive
-- identity-upgrade.sql embedded by IdentitySemester at startup instead.
-- This script owns no GroupMatching or Mentor tables.

CREATE TABLE IF NOT EXISTS "Roles" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "Name" text NOT NULL,
    "Description" text NOT NULL DEFAULT '',
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Roles_Name" ON "Roles" ("Name");

CREATE TABLE IF NOT EXISTS "Users" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "Username" text NOT NULL,
    "Email" text NOT NULL,
    "GoogleSubject" text NULL,
    "PasswordHash" text NOT NULL,
    "TokenVersion" integer NOT NULL DEFAULT 0,
    "RoleId" uuid NOT NULL REFERENCES "Roles" ("Id") ON DELETE RESTRICT,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Users_Email" ON "Users" ("Email");
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Users_GoogleSubject" ON "Users" ("GoogleSubject") WHERE "GoogleSubject" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "Semesters" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "Code" text NOT NULL,
    "Name" text NOT NULL,
    "StartDate" timestamp with time zone NOT NULL,
    "EndDate" timestamp with time zone NOT NULL,
    "IsActive" boolean NOT NULL DEFAULT true,
    "RegistrationDeadline" timestamp with time zone NULL,
    "TopicDeadline" timestamp with time zone NULL,
    "MentorDeadline" timestamp with time zone NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NULL,
    CONSTRAINT "CK_Semesters_Dates" CHECK ("StartDate" < "EndDate")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Semesters_Code" ON "Semesters" ("Code");

CREATE TABLE IF NOT EXISTS "Students" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "UserId" uuid NOT NULL REFERENCES "Users" ("Id") ON DELETE RESTRICT,
    "StudentCode" text NOT NULL,
    "FullName" text NOT NULL,
    "Major" text NOT NULL,
    "SemesterId" uuid NOT NULL REFERENCES "Semesters" ("Id") ON DELETE RESTRICT,
    "HasGroup" boolean NOT NULL DEFAULT false,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Students_SemesterId_StudentCode" ON "Students" ("SemesterId", "StudentCode");
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Students_SemesterId_UserId" ON "Students" ("SemesterId", "UserId");

CREATE TABLE IF NOT EXISTS "GoogleAllowedEmails" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "Email" text NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_GoogleAllowedEmails_Email" ON "GoogleAllowedEmails" ("Email");

CREATE TABLE IF NOT EXISTS "StudentEventOutbox" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "Topic" character varying(80) NOT NULL DEFAULT 'student-imported',
    "Payload" text NOT NULL,
    "PublishedAt" timestamp with time zone NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NULL
);
CREATE INDEX IF NOT EXISTS "IX_StudentEventOutbox_PublishedAt" ON "StudentEventOutbox" ("PublishedAt");

CREATE TABLE IF NOT EXISTS "StudentStrengthRoles" (
    "Id" uuid NOT NULL PRIMARY KEY,
    "StudentId" uuid NOT NULL REFERENCES "Students" ("Id") ON DELETE CASCADE,
    "RoleCode" character varying(40) NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "IX_StudentStrengthRoles_StudentId_RoleCode" ON "StudentStrengthRoles" ("StudentId", "RoleCode");

INSERT INTO "Roles" ("Id", "Name", "Description", "CreatedAt") VALUES
  ('11111111-1111-1111-1111-111111111111', 'Admin', 'System Administrator', NOW()),
  ('22222222-2222-2222-2222-222222222222', 'Student', 'Student User', NOW()),
  ('33333333-3333-3333-3333-333333333333', 'Mentor', 'Mentor User', NOW())
ON CONFLICT ("Id") DO NOTHING;

INSERT INTO "GoogleAllowedEmails" ("Id", "Email", "CreatedAt") VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'danghung25022005@gmail.com', NOW()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'thithinh714@gmail.com', NOW())
ON CONFLICT ("Email") DO NOTHING;
