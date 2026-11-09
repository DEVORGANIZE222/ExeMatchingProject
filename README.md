# EXE Team Matching System - Microservices Architecture

An enterprise-grade Capstone / EXE Team Matching System built with **.NET 8 Microservices Architecture**, featuring Clean Architecture, Nginx API Gateway, EF Core PostgreSQL with seed data, gRPC services, Apache Kafka event-driven messaging abstractions, Docker Compose, and xUnit testing.

---

## 1. Project Overview
The **EXE Team Matching System** coordinates student registration, team formation, leader voting, mentor assignment, and topic approval for Capstone/EXE courses.

> **Service updates**: IdentitySemester implements JWT/RBAC, roster/semester management and a Kafka outbox. GroupMatching implements the group lifecycle, leader vote, random matching and its own outbox. See [IdentitySemester](docs/identity-semester.md) and [GroupMatching](docs/group-matching.md). Mentor and Notification still require their own end-to-end implementation.

---

## 2. Architecture
The solution enforces **Clean Architecture** for each microservice with strict dependency direction:

```text
React/Vite client --> Nginx gateway --> IdentitySemester --> identity_db
                                  --> GroupMatching    --> group_matching_db
                                  --> Mentor REST/gRPC --> mentor_db

IdentitySemester --> durable outbox --> Kafka --> consumers
GroupMatching --> durable outbox --> Kafka --> IdentitySemester membership consumer
PostgreSQL hosts three separate databases.
Kafka uses Zookeeper; Redis is provisioned but not integrated.
```

---

## 3. Microservices

| Service | Internal Port | External Port | Description |
|---|---|---|---|
| **IdentitySemester.Api** | 8080 | 5001 | User authentication, JWT tokens, Student imports & Semester management |
| **GroupMatching.Api** | 8080 | 5002 | Team lifecycle, leader voting, random matching, topic registration and Mentor gRPC recommendation client |
| **Mentor.Api** | 8080 / 50051 | 5003 / 50051 | Mentor profiles, quota tracking, REST & gRPC operations |
| **Notification.Worker** | N/A | N/A | Background worker consuming Kafka events to send email notifications |
| **Nginx API Gateway** | 8080 | 8080 | Unified entry point & routing reverse proxy |
| **React Frontend** | 80 | 3000 | Browser UI, served by Nginx |

---

## 4. Folder Structure

```text
EXETeamMatching/
│
├── be/                                 # Backend Microservices (.NET 8)
│   ├── src/
│   │   ├── Gateway/                    # Nginx API Gateway Dockerfile & config
│   │   ├── Services/                   # Microservices (IdentitySemester, GroupMatching, Mentor, Notification)
│   │   ├── BuildingBlocks/             # Shared Kernel, Contracts, Messaging
│   │   └── Tests/                      # Unit & Integration Tests
│   ├── proto/                          # Protobuf schemas for gRPC
│   ├── deploy/                         # Nginx & Postgres init deployment files
│   ├── Directory.Build.props           # Common .NET 8 property settings
│   └── EXETeamMatching.sln             # Main Visual Studio Solution
│
├── fe/                                 # Frontend Web Application Skeleton
│   └── README.md                       # Frontend quickstart & setup
│
├── docker-compose.yml                  # Root Docker Compose orchestrator
├── render.yaml                         # Cloud deployment blueprint
├── .env & .env.example                 # Environment configuration templates
├── .dockerignore
├── .gitignore
└── README.md                           # Main repository documentation
```

---

## 5. Technology Stack
- **Backend Framework**: .NET 8 (`net8.0`)
- **Web API**: ASP.NET Core Web API with OpenAPI/Swagger
- **Database**: PostgreSQL 16 with Entity Framework Core 8
- **Messaging**: Apache Kafka (`Confluent.Kafka`) & Zookeeper
- **RPC**: gRPC (`Grpc.AspNetCore`)
- **Gateway**: Nginx Reverse Proxy
- **Caching**: Redis
- **Testing**: xUnit, `Microsoft.AspNetCore.Mvc.Testing`

---

## 6. Local Development

### Prerequisites
- .NET 8 SDK
- Node.js (for Frontend development)
- Docker Desktop & Docker Compose

### Building the Backend Solution
```bash
dotnet build be/EXETeamMatching.sln
```

### Running Microservices Locally without Docker
Ensure local PostgreSQL is running on port 5432, then run:
```bash
dotnet run --project be/src/Services/IdentitySemester/IdentitySemester.Api
dotnet run --project be/src/Services/GroupMatching/GroupMatching.Api
dotnet run --project be/src/Services/Mentor/Mentor.Api
```

### Mentor Workspace
Add the mentor's email to Google Access and have the mentor sign in once. An Admin can then activate that account from **Giảng viên Mentor**; the mentor must sign out and sign in again to receive the Mentor role. The mentor workspace stores profile details, assigned-group progress, appointments, mentor requests, and notifications in the Mentor database. Elected group leaders can send mentor requests from the Groups page.


---

## 7. Docker Commands

### Start All Services & Infrastructure
```bash
# Copy .env.example to .env and supply the private values first.
docker compose up --build
```

Open `http://localhost:3000`. The browser UI calls the gateway at `http://localhost:8080`.

### Stop All Services
```bash
docker compose down
```

### View Service Logs
```bash
docker compose logs -f identity-semester
docker compose logs -f group-matching
docker compose logs -f mentor
docker compose logs -f notification-worker
```

---

## 8. Environment Variables

| Variable | Default Value | Description |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | `Host=postgres;Database=...;Username=postgres;Password=postgres` | PostgreSQL connection string |
| `KafkaSettings__BootstrapServers` | `kafka:9092` | Kafka broker host & port |
| `JwtSettings__Secret` | `SuperSecretKeyForJWTTokenGeneration12345!` | Secret key for JWT signing |

---

## 9. API Endpoints Overview

All HTTP API endpoints are accessible through the Nginx Gateway (`http://localhost/`):

### Identity & Semester (`http://localhost/api/...`)
- `POST /api/auth/login` - Login user
- `GET /api/students` - Get student list
- `GET /api/students/{id}` - Get student by ID
- `POST /api/students/import` - Batch import students
- `GET /api/semesters` - List active semesters
- `POST /api/semesters` - Create new semester

### Group & Matching (`http://localhost/api/...`)
- `GET /api/groups` - List groups
- `GET /api/groups/{id}` - Get group details
- `POST /api/groups` - Create group
- `POST /api/groups/{id}/members` - Add member
- `DELETE /api/groups/{id}/members/{studentId}` - Remove member
- `POST /api/groups/{id}/vote-leader` - Vote team leader
- `POST /api/groups/{id}/lock` - Lock team formation
- `POST /api/matching/random` - Trigger random matching algorithm

### Mentor (`http://localhost/api/...`)
- `GET /api/mentors?search=&department=&expertise=&pageIndex=1&pageSize=10` - Search mentors (name/email, department, expertise; case-insensitive). Body is the mentor list; paging metadata is returned in the `X-Total-Count`, `X-Page-Index`, `X-Page-Size` and `X-Total-Pages` headers. `pageSize` is 1-100.
- `GET /api/mentors/{id}` - Get mentor details
- `GET /api/mentors/{id}/quota` - Get mentor quota
- `POST /api/mentors` - Create mentor profile (Admin)
- `PUT /api/mentors/{id}/quota` - Update mentor quota; cannot go below assigned groups (Admin)
- `DELETE /api/mentors/{id}` - Delete mentor profile, quota, requests and workspace data; rejected while groups are assigned (Admin)
- `GET|PUT /api/mentors/me` - Current mentor profile (Mentor)
- `/api/mentors/me/groups`, `/appointments`, `/notifications` - Mentor workspace (Mentor)
- `POST /api/mentor-requests` - Request mentor for group (group leader)
- `GET /api/mentor-requests/groups/{groupId}/status` - Mentor request status for a group (group leader)
- `POST /api/mentor-requests/decision` - Accept/reject mentor request (Mentor)
- `GET /api/mentor-requests/mine` - Requests addressed to the current mentor (Mentor)

The Mentor OpenAPI document is regenerated on every local build of `Mentor.Api` into `docs/api/mentor.openapi.json` (disable with `-p:ExportOpenApi=false`).

---

## 10. Kafka Events & Topics

The `BuildingBlocks/Contracts` library defines standard event payloads:

| Event | Publisher | Consumer |
|---|---|---|
| `StudentImportedEvent` | IdentitySemester | Notification |
| `GroupCreatedEvent` | GroupMatching | Notification |
| `GroupLockedEvent` | GroupMatching | Mentor / Notification |
| `LeaderElectedEvent` | GroupMatching | Notification |
| `TopicRegisteredEvent` | GroupMatching | Mentor / Notification |
| `MentorRequestedEvent` | Mentor | Notification |
| `MentorDecisionEvent` | Mentor | GroupMatching / Notification |

---

## 11. gRPC Integration

The **Mentor Microservice** exposes gRPC endpoints defined in `proto/mentor.proto` on port `50051`:

```protobuf
service MentorGrpcService {
  rpc GetMentor (GetMentorRequest) returns (MentorResponse);
  rpc GetMentors (GetMentorsRequest) returns (GetMentorsResponse);
  rpc GetMentorQuota (GetMentorQuotaRequest) returns (MentorQuotaResponse);
}
```

---

## 12. Testing

Run all unit & integration test projects across the solution:
```bash
dotnet test be/EXETeamMatching.sln
```

Service 1 tests use real PostgreSQL in isolated temporary databases. With Docker infrastructure running, use `./be/scripts/test-identity.ps1` to avoid host database port conflicts. Run `./be/scripts/smoke-identity.ps1` for Nginx/JWT/CRUD/Kafka verification against the local stack. Mentor service tests (`be/src/Tests/Mentor.Tests`) are xUnit + Moq unit tests for `MentorService` and need no infrastructure: `dotnet test be/src/Tests/Mentor.Tests/`.

## 13. Team responsibilities

| Assignment | Responsibility | Scope delivered | Reference |
|---|---|---|---|
| Service 1 owner | IdentitySemester | Authentication/JWT/RBAC, student import and account information, semester milestones, Kafka outbox | [IdentitySemester guide](docs/identity-semester.md), `be/database-scripts/01_identity_db_schema.sql` |
| Service 2 owner | GroupMatching | Groups, membership, leader vote, locking, random matching, topic workflow, Kafka outbox, Mentor gRPC client for recommendations | [GroupMatching guide](docs/group-matching.md), `be/database-scripts/02_group_matching_db_schema.sql` |
| Service 3 owner | Mentor | Mentor profiles with search/paging and admin delete, quotas, mentor requests and decisions, mentor workspace (assigned groups, progress, appointments, notifications), REST and gRPC endpoints over a Clean Architecture service/repository layer | `be/database-scripts/03_mentor_db_schema.sql`, `docs/api/mentor.openapi.json` |
| Service 4 owner | Notification | `Notification.Worker` consumes Kafka topics (group, topic and mentor events) and sends email notifications | `be/src/Services/Notification` |
| Infrastructure/integration owner | Gateway & delivery | Nginx gateway, Docker Compose stack, OpenAPI exports and end-to-end demonstration | [Demo script](docs/DEMO_SCRIPT.md), `be/scripts/export-openapi.ps1` |

Mentor layering: `Mentor.Api` controllers and `Mentor.Grpc` depend only on `IMentorService` (`Mentor.Application/Services/MentorService.cs`); all EF Core access goes through `IMentorRepository` (`Mentor.Infrastructure/Repositories/MentorRepository.cs`).

The supplied team document does not name individual members. Replace responsibility labels with actual team member names before submission; do not invent names.
