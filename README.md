# EXE Team Matching System - Microservices Architecture

An enterprise-grade Capstone / EXE Team Matching System built with **.NET 8 Microservices Architecture**, featuring Clean Architecture, Nginx API Gateway, EF Core PostgreSQL with seed data, gRPC services, Apache Kafka event-driven messaging abstractions, Docker Compose, and xUnit testing.

---

## 1. Project Overview
The **EXE Team Matching System** coordinates student registration, team formation, leader voting, mentor assignment, and topic approval for Capstone/EXE courses.

> **Service 1 update (2026-09-29)**: IdentitySemester now implements JWT/RBAC, account information/password changes, student CRUD/Excel import, semester CRUD/milestones, PostgreSQL repositories and a Kafka outbox producer. See [Service 1 guide and requirements checklist](docs/identity-semester.md) and [working agreement](AGENTS.md). GroupMatching, Mentor and Notification remain Phase 1 skeletons; their end-to-end requirements are not complete.

---

## 2. Architecture
The solution enforces **Clean Architecture** for each microservice with strict dependency direction:

```text
React/Vite client --> Nginx gateway --> IdentitySemester --> identity_db
                                  --> GroupMatching    --> group_matching_db
                                  --> Mentor REST/gRPC --> mentor_db

IdentitySemester --> durable outbox --> Kafka --> Notification Worker (implemented)
GroupMatching / Mentor --> Kafka (implemented)
PostgreSQL hosts three separate databases.
Kafka uses Zookeeper; Redis is provisioned but not integrated.
```

---

## 3. Microservices

| Service | Internal Port | External Port | Description |
|---|---|---|---|
| **IdentitySemester.Api** | 8080 | 5001 | User authentication, JWT tokens, Student imports & Semester management |
| **GroupMatching.Api** | 8080 | 5002 | Team creation, member management, leader voting, matching placeholder |
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
- `GET /api/mentors` - List mentors
- `GET /api/mentors/{id}` - Get mentor details
- `GET /api/mentors/{id}/quota` - Get mentor remaining quota
- `POST /api/mentor-requests` - Request mentor for group
- `POST /api/mentor-requests/decision` - Accept/reject mentor request

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

Service 1 tests use real PostgreSQL in isolated temporary databases. With Docker infrastructure running, use `./be/scripts/test-identity.ps1` to avoid host database port conflicts. Run `./be/scripts/smoke-identity.ps1` for Nginx/JWT/CRUD/Kafka verification against the local stack. Existing tests for other services are placeholders.

## 13. Team responsibilities

| Assignment | Responsibility | Status |
|---|---|---|
| Service 1 - current contributor | Authentication/JWT/RBAC, student import and account information, semester milestones | Implemented; see Service 1 guide |
| Service 2 owner | Groups, membership, vote leader, locking, random matching, topic workflow | Team implementation pending |
| Service 3 owner | Mentor profiles, quotas, mentor decisions, real REST-to-gRPC interaction | Team implementation pending |
| Service 4 owner | Kafka event consumer, notification/email worker | Team implementation pending |
| Infrastructure/integration owner | Shared gateway deployment, integration and complete end-to-end demonstration | Compose scaffold present; integration pending |

The supplied team document does not name individual members. Replace responsibility labels with actual team member names before submission; do not invent names.

