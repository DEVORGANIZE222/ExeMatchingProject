# EXE Team Matching System — Architecture

> Everything here comes from the code and config under `ExeMatchingProject/` (git HEAD `5525f1c`). Where the README and the code disagree, the code wins, and the conflict is listed in [Documentation vs Implementation Differences](#documentation-vs-implementation-differences).
>
> **Companion files**
> - `system-architecture.drawio`: editable diagrams, 16 pages (01–13, with 07a–07d for components)
> - `workspace.dsl`: Structurizr C4 model. It passed `structurizr validate` (CLI v2025.11.09).
> - `diagrams/plantuml/*.puml`, `diagrams/mermaid/*.mmd`, `diagrams/png/*.png`: exported from `workspace.dsl`
>
> **Status labels**
>
> | Label | Meaning |
> |---|---|
> | **Implemented** | Works as described |
> | **Skeleton** | Returns a fixed, hard-coded answer |
> | **Stub** | Throws `NotImplementedException` or only writes a log line |
> | **Mock** | Returns fake data |
> | **Configured, unused** | Set up in config or dependencies, but no code uses it |
> | **Not implemented** | Only mentioned in the docs |
> | **Not verified from source** | The code can't prove it either way |

---

# System Overview

The EXE Team Matching System is a **.NET 8 microservice back end** for running Capstone/EXE courses. It covers importing students for a semester, forming teams, electing a team leader by vote, placing students who have no team, and assigning mentors who have a limited quota. The repository describes itself as the **"Phase 1 Code Base Skeleton"** (README §1), and the code matches that:

| Layer | State |
|---|---|
| Nginx API gateway (routing, CORS, rate limit, security headers) | **Implemented** |
| PostgreSQL schemas + seed data (EF Core `EnsureCreated()` + `HasData`) | **Implemented** |
| Global exception → JSON middleware, Swagger UI, `ApiResponse<T>` envelope | **Implemented** |
| `POST /api/auth/login` | **Skeleton** (hard-coded token) |
| All other REST endpoints (18) | **Stub**: `NotImplementedException` → HTTP 501 |
| gRPC `MentorGrpcService` | **Mock** (hard-coded data, no callers) |
| Kafka publish/consume, Notification worker, e-mail | **Stub** (log only) |
| Redis | **Configured, unused** |
| JWT authentication / authorization | **Configured, unused** (package referenced, never wired) |
| Frontend (`fe/`) | Default React + Vite **template**, not integrated |

Architecture style: **microservices**, with each service split into **Clean Architecture** layers (`Domain → Application → Infrastructure → Api`). The services share `BuildingBlocks` libraries (SharedKernel, Contracts, Messaging) and sit behind an Nginx gateway. Each service has its own logical PostgreSQL database.

# Context

- **Purpose:** coordinate semester-scoped Capstone/EXE team formation and mentoring (README §1; the domain entities confirm this scope).
- **System boundary:** the gateway, the 3 APIs, the worker, PostgreSQL (3 DBs), Kafka/Zookeeper and Redis. Everything except the external SMTP server runs from `docker-compose.yml`.
- **Users:** Student, Admin, Mentor (see [Main Actors](#main-actors)).
- **External systems:** SMTP e-mail server only (`EmailSettings`, default `smtp.gmail.com:587`). It is **Mock**: `EmailService` only logs and never connects.
- **Interactions:** clients call REST endpoints through the gateway, which routes by path prefix. No UI exists yet; you can use the Swagger UI at the root of each API.

Draw.io pages: *01 - Context*, *05 - C4 System Context*.

# Problems

These come from README §1 and are confirmed by the domain model and endpoints:

1. A student roster has to be loaded for each semester.
2. Semesters have to be defined, and all activity is scoped to a semester.
3. Users have to sign in.
4. Students have to form teams (groups) of members, with invitations and a lock step.
5. Each team needs a leader chosen by vote.
6. Students without a team still have to be placed in one (random matching).
7. Teams need a mentor, and each mentor can only take a limited number of teams (quota).
8. Participants have to be told when these things happen.
9. *(README only)* Topic registration or approval.

Technical problems the code addresses: several independent services need **one entry point**, and callers need **consistent error responses**.

# Solutions

| # | Problem | Solution in code | Status |
|---|---|---|---|
| 1 | Student roster | `POST /api/students/import` (`ImportStudentsRequest{SemesterCode, Students[]}`), `Student` entity | Stub (schema + seed only) |
| 2 | Semesters | `GET/POST /api/semesters`, `Semester{Code, StartDate, EndDate, IsActive}` | Stub (seed `FALL2026`) |
| 3 | Sign-in | `POST /api/auth/login`, `JwtSettings`, `IJwtService` | Skeleton |
| 4 | Team formation | `Group`, `GroupMember`, `GroupInvitation`; create / add / remove member / lock endpoints; `GroupStatus` Draft→Open→Locked→Completed | Stub |
| 5 | Leader vote | `LeaderVote`, `POST /api/groups/{id}/vote-leader`, `MemberRole.Leader` | Stub |
| 6 | Unteamed students | `POST /api/matching/random?semesterCode=`, `Student.HasGroup` | Stub (no algorithm) |
| 7 | Mentor with quota | `MentorRequest` (Pending/Approved/Rejected), `MentorQuota{MaxQuota, CurrentAssigned}`, REST request/decision, gRPC `GetMentorQuota` | Stub / Mock |
| 8 | Notifications | 7 event records in `Contracts`, `IEventPublisher`, Notification worker, `IEmailService` | Stub |
| 9 | Topic approval | Only `Group.TopicTitle` and the `TopicRegisteredEvent` record | Not implemented |
| — | Single entry point | Nginx path routing, CORS `*`, `limit_req` 30 r/s (burst 50), security headers, gzip, `/` and `/health` | Implemented |
| — | Consistent errors | `GlobalExceptionHandler` → `ErrorResponse` (501/400/404/401/500), `ApiResponse<T>` | Implemented |

# Main Actors

| Actor | Evidence | Role | Main capabilities (by endpoint/DTO design) | Relationship with the system |
|---|---|---|---|---|
| **Student** | Seeded `Role` "Student"; `Student` entity (FK to User and Semester) | Course participant | Log in; create, join or leave a group; vote for a leader (`VoteLeaderRequest.VoterStudentId`); request a mentor | Primary user. Other tables point to students by ID: `GroupMember.StudentId`, `Group.LeaderStudentId`, `LeaderVote.*StudentId`, `GroupInvitation.*StudentId` |
| **Admin** | Seeded `Role` "Admin" / "System Administrator" | Administrator | Import students, create or list semesters, trigger random matching | **Admin-only access is not verified from source**: no `[Authorize]`, roles or policies exist |
| **Mentor** | `MentorUser` entity (`Mentors` table, with `UserId`); `MentorDecisionDto`; seed "Dr. Le Van C" | Lecturer / mentor | Receive group requests; accept or reject with a reason; has a quota | **No "Mentor" role is seeded**, so how a mentor logs in is not verified |

**Authorization is not implemented.** No service calls `AddAuthentication`/`UseAuthentication`, and no endpoint has `[Authorize]`. Every route is open to every caller.

# Main Features

| Module | Service | Endpoints | Status |
|---|---|---|---|
| Identity & Auth | IdentitySemester | `POST /api/auth/login` | Skeleton |
| Students & Semesters | IdentitySemester | `GET /api/students`, `GET /api/students/{id}`, `POST /api/students/import`, `GET/POST /api/semesters` | Stub |
| Team Formation | GroupMatching | `GET/POST /api/groups`, `GET /api/groups/{id}`, `POST /api/groups/{id}/members`, `DELETE /api/groups/{id}/members/{studentId}`, `POST /api/groups/{id}/lock` | Stub |
| Leader Voting | GroupMatching | `POST /api/groups/{id}/vote-leader` | Stub |
| Random Matching | GroupMatching | `POST /api/matching/random?semesterCode=` | Stub |
| Mentor Management | Mentor (REST) | `GET /api/mentors`, `GET /api/mentors/{id}`, `GET /api/mentors/{id}/quota`, `POST /api/mentor-requests`, `POST /api/mentor-requests/decision` | Stub |
| Mentor gRPC | Mentor (gRPC) | `GetMentor`, `GetMentors`, `GetMentorQuota` (`be/proto/mentor.proto`) | Mock |
| Notifications | Notification Worker | Consume events → send e-mail | Stub |
| Platform | Gateway / SharedKernel | Routing, `/health`, Swagger UI at `/`, error middleware, schema + seed at startup | Implemented |

The `GroupInvitations` table exists, but **no endpoint** uses it.

# System Architecture

## C4 System Context

```
[Student] [Admin] [Mentor] --HTTP/JSON--> [EXE Team Matching System] --SMTP (stub)--> [SMTP Email Server (external)]
```

The Structurizr view is `SystemContext` (`diagrams/png/structurizr-SystemContext.png`). In Draw.io, see page *05*.

## C4 Containers

| Container | Responsibility | Technology | Status |
|---|---|---|---|
| API Gateway | Single entry point; routes `/api/auth`, `/api/students`, `/api/semesters` → IdentitySemester; `/api/groups`, `/api/matching` → GroupMatching; `/api/mentors`, `/api/mentor-requests` → Mentor; anything else → 404 JSON | Nginx (`nginx:alpine`), listens on :80, published on host :8080 | Implemented |
| IdentitySemester API | Auth, students, semesters | ASP.NET Core 8 Web API, :8080 | Skeleton / Stub |
| GroupMatching API | Groups, members, leader vote, lock, random matching | ASP.NET Core 8 Web API, :8080 | Stub |
| Mentor API | Mentors, quota, mentor requests; gRPC service | ASP.NET Core 8 Web API + Grpc.AspNetCore, :8080 (+50051 exposed) | Stub / Mock |
| Notification Worker | Consume events, send e-mail | .NET 8 Worker Service (`BackgroundService`) | Stub |
| identity_db / group_matching_db / mentor_db | One database per service | PostgreSQL 16 (one `postgres:16-alpine` server, created by `init-databases.sql`) | Implemented |
| Kafka Broker | Event bus | `confluentinc/cp-kafka:7.5.0` + Zookeeper 7.5.0 | Configured, unused |
| Redis | Cache (per README) | `redis:7-alpine` | Configured, unused |
| Frontend | Web UI | React 19 + Vite 8 template | Template, not integrated |

**Verified communication**
- Client → Gateway: HTTP/JSON.
- Gateway → APIs: HTTP `proxy_pass` to `<service>:8080`, adding the `X-Real-IP`, `X-Forwarded-*` and `X-Request-ID` headers.
- APIs → their own DB: EF Core / Npgsql on TCP 5432. The only database work in the code today is `EnsureCreated()` at startup.
- **There are no service-to-service calls.** No `HttpClient` or gRPC client exists anywhere, and no Kafka message is produced or consumed.

The Structurizr view is `Containers`. In Draw.io, see page *06*.

## C4 Components

**IdentitySemester API** (`be/src/Services/IdentitySemester`)
- `AuthController`: `[AllowAnonymous] POST login`, returns `"sample_jwt_token"`
- `StudentsController`, `SemesterController`: Stub
- `GlobalExceptionHandler` (SharedKernel middleware)
- `Program.cs`: DI, Swagger, CORS `AllowAll`, `EnsureCreated()`
- `IdentitySemesterDbContext`
- `JwtService`: returns `placeholder_jwt_token_{id}`. It is registered but never injected.
- `KafkaEventPublisher`: registered, never called
- `IAuthenticationService`, `IStudentRepository` and `IUserRepository` have **no implementations**.

**GroupMatching API**
- `GroupsController`, `LeaderVoteController`, `MatchingController`: all Stub
- `GlobalExceptionHandler`, `Program.cs`, `GroupMatchingDbContext`, `KafkaEventPublisher`
- `IGroupRepository`, `IGroupService`, `IMatchingService` and `ILeaderVoteService` have **no implementations**.

**Mentor API**
- `MentorsController`, `MentorRequestsController`: Stub
- `MentorGrpcServiceImpl`: Mock, mapped with `MapGrpcService`
- `GlobalExceptionHandler`, `Program.cs` (`AddGrpc`), `MentorDbContext`, `KafkaEventPublisher`
- `IMentorRepository`, `IMentorService` and `IMentorQuotaService` have **no implementations**.

**Notification Worker**
- `Worker` calls `KafkaConsumer.StartConsumingAsync()`, which only logs. It then loops `Task.Delay(5000)` next to `// TODO: Consume Kafka events`.
- `NotificationHandler` and `EmailService` are injected but never invoked, and both only log.

Structurizr views: `Components-*`. Draw.io pages: *07a–07d*.

## Main Data Flows

**A. Login (Skeleton)**
1. Client sends `POST /api/auth/login {email,password}` to the gateway.
2. The gateway proxies it to `AuthController`.
3. The controller returns `200 ApiResponse<LoginResponse>` with a hard-coded token. It does no DB lookup and no credential check. (Structurizr view `Flow-Login`.)

**B. Any other endpoint (Stub)**
1. Client sends a request, for example `POST /api/groups`, to the gateway.
2. The gateway proxies it to the controller, which throws `NotImplementedException("Phase 2 Implementation: …")`.
3. `GlobalExceptionHandler` catches it and returns HTTP **501** `{statusCode, message, details, timestamp}`. (View `Flow-StubbedRequest`.)

**C. Service startup (Implemented)**
1. The first time the Postgres container initializes, it runs `init-databases.sql` to create the 3 databases.
2. Each API then calls `Database.EnsureCreated()`, which creates its tables and inserts the `HasData` seed. (View `Flow-Startup`.)

**D. Intended event flow (Not implemented)**

The README (§10) and `Contracts/Events/DomainEvents.cs` define 7 events:

| Event | Intended publisher |
|---|---|
| `StudentImportedEvent` | IdentitySemester |
| `GroupCreatedEvent`, `GroupLockedEvent`, `LeaderElectedEvent`, `TopicRegisteredEvent` | GroupMatching |
| `MentorRequestedEvent`, `MentorDecisionEvent` | Mentor |

According to the README, the Notification worker, Mentor and GroupMatching would consume them. **None of this is implemented:** no `PublishAsync` or `SubscribeAsync` call exists, and no topic names are defined. Draw.io page *08*, part D, shows this flow greyed out.

**Deployment**
- **Docker Compose:** 9 containers on the `capstone-network` bridge network, with volumes `postgres-data` and `redis-data`. Implemented.
- **Render (`render.yaml`):** 5 Docker services plus 1 managed Postgres, region Singapore, free plan. It has configuration gaps, listed below.

Structurizr views: `Deployment-DockerCompose`, `Deployment-Render`. Draw.io page: *12*.

# Technology Stack

| Category | Technology (version) | What it does in this project |
|---|---|---|
| Backend | .NET 8 (`net8.0`, Nullable, ImplicitUsings) | Runtime for every service |
| Web API | ASP.NET Core 8 MVC controllers | REST endpoints |
| API docs | Swashbuckle.AspNetCore 6.5.0 | Swagger UI served at the root of each API |
| RPC | Grpc.AspNetCore 2.60.0, Google.Protobuf 3.25.3, Grpc.Tools 2.60.0 | Mentor gRPC server (Mock) |
| Database | PostgreSQL 16 (`postgres:16-alpine`) | 3 logical databases |
| ORM | EF Core 8.0.2, Npgsql.EntityFrameworkCore.PostgreSQL 8.0.2 | DbContexts, schema via `EnsureCreated`, seed via `HasData` |
| Gateway | Nginx (`nginx:alpine`) | Reverse proxy, CORS, rate limit, gzip, security headers |
| Messaging | Confluent.Kafka 2.3.0 (referenced), cp-kafka/cp-zookeeper 7.5.0 | Configured, unused: the Kafka client API is never called |
| Authentication | Microsoft.AspNetCore.Authentication.JwtBearer 8.0.2, System.IdentityModel.Tokens.Jwt 7.3.1 | Configured, unused |
| Cache | Redis 7 (`redis:7-alpine`) | Configured, unused |
| Background jobs | Microsoft.Extensions.Hosting 8.0.0 | Notification `BackgroundService` |
| Frontend | React 19.2, Vite 8.3, @vitejs/plugin-react 6.1, Oxlint 1.81 | Default template only |
| Testing | xUnit 2.6.6, Microsoft.NET.Test.Sdk 17.9, Microsoft.AspNetCore.Mvc.Testing 8.0.2 | 4 projects, each with one `Assert.True(true)` placeholder |
| Containers | Multi-stage Dockerfiles (`dotnet/sdk:8.0` → `aspnet:8.0` / `runtime:8.0`) | Build and run images |
| Deployment | `docker-compose.yml`, `render.yaml` (Render PaaS) | Local and cloud blueprints |
| CI/CD | none found | No `.github/`, pipeline or workflow files |

# Conceptual ERD

Entities: **Role, User, Student, Semester** (Identity service); **Group, GroupMember, GroupInvitation, LeaderVote** (GroupMatching service); **Mentor, MentorQuota, MentorRequest** (Mentor service).

Relationships enforced as foreign keys:
- Role 1 — 0..* User
- User 1 — 0..* Student (not unique in the schema)
- Semester 1 — 0..* Student
- Group 1 — 0..* GroupMember
- Mentor 1 — 0..1 MentorQuota
- Mentor 1 — 0..* MentorRequest

Logical references (stored as an ID or code, with no FK):
- `GroupInvitation.GroupId`, `LeaderVote.GroupId` → Group. These are in the same DB but still have no FK.
- `Group.SemesterCode` → `Semester.Code`, across services.
- `GroupMember.StudentId`, `Group.LeaderStudentId`, `LeaderVote.VoterStudentId/NominatedStudentId`, `GroupInvitation.InviterStudentId/InviteeStudentId` → Student
- `MentorRequest.GroupId` → Group
- `Mentor.UserId` → User

Enums (stored as integers):
- `GroupStatus` {Draft, Open, Locked, Completed}
- `MemberRole` {Member, Leader}
- `InvitationStatus` {Pending, Accepted, Rejected}
- `RequestStatus` {Pending, Approved, Rejected}

Draw.io page: *10 - ERD Conceptual*.

# Physical Database

**Source:** I generated the DDL below by running `Database.GenerateCreateScript()` against the three real DbContexts with the Npgsql provider. It is exactly what `EnsureCreated()` produces, not an inference. The project has **no migrations**, no Fluent API configuration and no data annotations, so EF conventions decide everything:
- every string is `text NOT NULL` (unless nullable)
- every FK is `ON DELETE CASCADE`
- there are no CHECK constraints

Every table has the three `BaseEntity` columns: `Id uuid PK`, `CreatedAt timestamptz NOT NULL`, `UpdatedAt timestamptz NULL`.

**identity_db**

| Table | Columns (besides BaseEntity) | Keys / indexes |
|---|---|---|
| Roles | Name text NN, Description text NN | PK_Roles |
| Users | Username text NN, Email text NN, PasswordHash text NN, RoleId uuid NN | FK_Users_Roles_RoleId (CASCADE); IX_Users_RoleId |
| Semesters | Code text NN, Name text NN, StartDate timestamptz NN, EndDate timestamptz NN, IsActive boolean NN | PK_Semesters |
| Students | UserId uuid NN, StudentCode text NN, FullName text NN, Major text NN, SemesterId uuid NN, HasGroup boolean NN | FK_Students_Users_UserId, FK_Students_Semesters_SemesterId (CASCADE); IX_Students_UserId, IX_Students_SemesterId |

**group_matching_db**

| Table | Columns | Keys / indexes |
|---|---|---|
| Groups | GroupCode, GroupName, TopicTitle, SemesterCode (text NN), Status integer NN, LeaderStudentId uuid NN | PK_Groups |
| GroupMembers | GroupId uuid NN, StudentId uuid NN, StudentCode text NN, FullName text NN, Role integer NN, JoinedAt timestamptz NN | FK_GroupMembers_Groups_GroupId (CASCADE); IX_GroupMembers_GroupId |
| GroupInvitations | GroupId, InviterStudentId, InviteeStudentId (uuid NN), Status integer NN | PK only, **no FK or index on GroupId** |
| LeaderVotes | GroupId, VoterStudentId, NominatedStudentId (uuid NN), VotedAt timestamptz NN | PK only, **no FK or index on GroupId** |

**mentor_db**

| Table | Columns | Keys / indexes |
|---|---|---|
| Mentors | UserId uuid NN, FullName, Email, Department, Expertise (text NN) | PK_Mentors |
| MentorQuotas | MentorId uuid NN, MaxQuota integer NN, CurrentAssigned integer NN | FK_MentorQuotas_Mentors_MentorId (CASCADE); **IX_MentorQuotas_MentorId UNIQUE** (1:0..1) |
| MentorRequests | GroupId uuid NN, MentorId uuid NN, Message text NN, Status integer NN, DecisionReason text NULL | FK_MentorRequests_Mentors_MentorId (CASCADE); IX_MentorRequests_MentorId |

**Notable gaps**
- There is **no UNIQUE constraint** on `Users.Email`, `Students.StudentCode`, `Semesters.Code` or `Groups.GroupCode`.
- There is no CHECK constraint that keeps `CurrentAssigned <= MaxQuota`.

**Seed data (`HasData`)**
- Roles Admin and Student
- Semester `FALL2026`
- User `student01` (the password hash is a placeholder string)
- Student `SE160001`
- Group `GRP-FALL26-001` with 2 members and 1 vote
- Mentor "Dr. Le Van C" with quota 5/1 and 1 pending request

The seed for GroupMember `77777777-…` points to a student who does not exist in identity_db. This is allowed because the reference crosses services and has no FK.

Draw.io page: *11 - Physical Database*.

# Evidence / Source Mapping

Paths are relative to `ExeMatchingProject/`.

| Finding | Source(s) |
|---|---|
| Purpose, Phase 1 status | `README.md` §1 |
| Microservice list, ports, dependencies | `docker-compose.yml`; `be/EXETeamMatching.sln` |
| Clean Architecture layering | `*.csproj` ProjectReferences (Api→Infrastructure→Application→Domain→SharedKernel) |
| Gateway routing, CORS, rate limit, `/health` | `be/src/Gateway/nginx/nginx.conf`, `proxy_params`, `Dockerfile` |
| Login skeleton | `IdentitySemester.Api/Controllers/AuthController.cs` |
| JWT placeholder, JwtSettings | `IdentitySemester.Infrastructure/Services/JwtService.cs`; `appsettings.json` |
| No auth middleware | `*/Program.cs` (only `UseAuthorization`, no `AddAuthentication`; no `[Authorize]` found by grep) |
| Stubbed endpoints | `*.Api/Controllers/*.cs` (`throw new NotImplementedException`) |
| Error mapping | `BuildingBlocks/SharedKernel/Middleware/GlobalExceptionHandler.cs` |
| Response envelope, BaseEntity | `SharedKernel/Models/ApiResponse.cs`, `ErrorResponse.cs`, `Domain/BaseEntity.cs` |
| Domain entities / enums | `*/Domain/Entities/Entities.cs`, `GroupMatching.Domain/Enums/GroupEnums.cs` |
| Schema + seed | `*/Infrastructure/Persistence/*DbContext.cs`; `EnsureCreated()` in each `Program.cs`; DDL generated from these DbContexts |
| Three databases | `be/deploy/postgres/init-databases.sql`; connection strings in `appsettings*.json`, `docker-compose.yml` |
| Kafka stub | `BuildingBlocks/Messaging/Implementations/KafkaEventPublisher.cs`, `KafkaEventConsumer.cs`; `Settings/KafkaSettings.cs` |
| Event contracts | `BuildingBlocks/Contracts/Events/DomainEvents.cs` |
| gRPC | `be/proto/mentor.proto`; `Mentor.Grpc/Services/MentorGrpcServiceImpl.cs`; `Mentor.Api/Program.cs` |
| Notification worker | `Notification.Worker/Program.cs`, `Worker.cs`; `Notification.Infrastructure/Services/NotificationServices.cs` |
| E-mail config | `Notification.Worker/appsettings.json`; `docker-compose.yml` (`EmailSettings__*`) |
| Redis | `docker-compose.yml` only |
| Application interfaces without implementations | `*/Application/Interfaces/Interfaces.cs` |
| Frontend | `fe/package.json`, `fe/src/App.jsx`, `fe/vite.config.js` |
| Tests | `be/src/Tests/*/*.cs`, `*.csproj` |
| Render deployment | `render.yaml` |
| Environment variables | `.env.example` (`.env` exists locally but git ignores it; its values are not reproduced here) |

# Documentation vs Implementation Differences

| README / config says | Implementation |
|---|---|
| Gateway "Port 80"; endpoints at `http://localhost/` | Compose publishes `${GATEWAY_PORT:-8080}:80`, so the address is `http://localhost:8080/` |
| Service table: gateway internal port 8080 | Nginx listens on **80** |
| "Caching: Redis" | Only a Redis container. No client package, no code. |
| Kafka events table with publishers and consumers | Publisher and consumer only log; no call sites; no topic names |
| gRPC on port 50051 | Dockerfile/compose expose 50051, but Kestrel is never told to listen on 50051 or on an HTTP/2-only endpoint. Responses are hard-coded, and no client exists. |
| "JWT tokens" | JwtBearer is referenced but not wired. The token is hard-coded. |
| "topic approval" | No Topic entity, endpoint or workflow |
| "GET /api/semesters – List active semesters", and the other endpoints | Throw `NotImplementedException` (HTTP 501) |
| `fe/` "Frontend Web Application Skeleton"; `FRONTEND_PORT` in `.env.example` | Default Vite page. Not in compose. `FRONTEND_PORT` is unused. |
| "xUnit testing" | Placeholder tests only |
| Three nginx configs | Only `be/src/Gateway/nginx/nginx.conf` (with `proxy_params`) is copied into the image. `default.conf` and `be/deploy/nginx/nginx.conf` are unused. |
| `.env.example` has `SMTP_USER`, `SMTP_PASSWORD`, `JWT_EXPIRATION_IN_MINUTES` | Compose does not pass them. `EmailSettings` has no user or password field. |
| `render.yaml`: `KafkaSettings__BootstrapServers=exe-kafka:9092` | No Kafka service is defined in `render.yaml` |
| `render.yaml`: all 3 APIs use `exe-postgres-db` | One shared database instead of 3. `EnsureCreated()` does nothing if any table already exists, so services that start after the first one may not get their tables. |
| `be/EXETeamMatching.slnx` | Empty `<Solution/>`. `EXETeamMatching.sln` is the real solution. |

Default secrets (JWT secret, Postgres password) are committed in `appsettings.json` and as `docker-compose.yml` fallbacks. They are not reproduced here.

# Unverified Items

- **Actor-to-endpoint permissions:** not verified from source, because there is no authorization.
- **How mentors authenticate:** not verified from source. No Mentor role exists, and `Mentor.UserId` has no FK.
- **Whether gRPC is reachable on :50051:** not verified from source, and it is likely unreachable because Kestrel has no endpoint for it.
- **Kafka topic names and consumer groups in use:** not verified. Only `GroupId` settings exist.
- **Whether the Render deployment works:** not verified. Upstream hostnames, the missing Kafka service and the shared DB are all open questions.
- **Whether Student ↔ User is meant to be 1:1:** not verified. The schema allows 1:N.
- **Topic registration/approval, random-matching algorithm, leader-election rules and quota enforcement:** not in source (Phase 2).
- **CI/CD:** none found.
- **Runtime behaviour:** not executed. This analysis is static, except for DDL generation, which ran against the real DbContexts.
