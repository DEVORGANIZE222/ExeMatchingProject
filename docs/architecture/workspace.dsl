workspace "EXE Team Matching System" "C4 model derived from the ExeMatchingProject repository (Phase 1 code base skeleton). Elements tagged Stub/Mock/Unused are present in code/config but have no working behaviour." {

    !identifiers flat

    model {

        // ─────────────────────────── People ───────────────────────────
        // Student & Admin: seeded Role rows in IdentitySemesterDbContext.
        // Mentor: MentorUser entity + /api/mentor-requests/decision endpoint (no Mentor role is seeded).
        student = person "Student" "Capstone/EXE student. Seeded role 'Student'. Forms/joins groups, votes for a leader, requests a mentor (all endpoints are Phase 2 stubs)."
        admin = person "Admin" "Seeded role 'System Administrator'. Role-to-endpoint mapping is NOT enforced (no authorization configured)."
        mentor = person "Mentor" "Lecturer modelled as MentorUser with a quota. Accepts/rejects mentor requests (stub). No 'Mentor' role seeded."

        // ─────────────────────── External systems ─────────────────────
        smtp = softwareSystem "SMTP Email Server" "Configured via EmailSettings (default smtp.gmail.com:587). EmailService only logs; no SMTP client is used." "External,Mock"

        // ─────────────────────── Primary system ───────────────────────
        exe = softwareSystem "EXE Team Matching System" "Coordinates student import, semesters, team formation, leader voting, random matching and mentor requests for Capstone/EXE courses." {

            frontend = container "Frontend (Vite template)" "Default React + Vite starter page. Makes no API calls and is not part of docker-compose." "React 19, Vite 8" "WebBrowser,Template"

            gateway = container "API Gateway" "Single HTTP entry point. Path-based reverse proxy, CORS, rate limiting (30 r/s, burst 50), security headers, gzip, /health." "Nginx (nginx:alpine)" "Gateway"

            identityApi = container "IdentitySemester API" "Auth (login), student import/query, semester management. Login returns a hard-coded skeleton token; other endpoints throw NotImplementedException (HTTP 501)." "ASP.NET Core 8 Web API" {
                authController = component "AuthController" "POST /api/auth/login [AllowAnonymous]. Returns hard-coded 'sample_jwt_token' without checking credentials." "ASP.NET Core MVC controller" "Skeleton"
                studentsController = component "StudentsController" "GET /api/students, GET /api/students/{id}, POST /api/students/import. All throw NotImplementedException." "ASP.NET Core MVC controller" "Stub"
                semesterController = component "SemesterController" "GET/POST /api/semesters. Both throw NotImplementedException." "ASP.NET Core MVC controller" "Stub"
                identityExHandler = component "GlobalExceptionHandler" "Middleware mapping exceptions to JSON ErrorResponse (NotImplemented→501, Argument→400, KeyNotFound→404, UnauthorizedAccess→401)." "SharedKernel middleware"
                jwtService = component "JwtService" "IJwtService. Returns 'placeholder_jwt_token_{userId}'. Registered in DI but not injected anywhere." "C# class" "Stub"
                identityStartup = component "Program (composition root)" "Registers DI, Swagger, CORS AllowAll; calls Database.EnsureCreated() at startup." "ASP.NET Core minimal hosting"
                identityDbContext = component "IdentitySemesterDbContext" "EF Core model for Users, Roles, Students, Semesters with HasData seed." "EF Core 8 + Npgsql"
                identityPublisher = component "KafkaEventPublisher" "IEventPublisher singleton. PublishAsync only logs; no producer. Never called." "BuildingBlocks.Messaging" "Stub"
            }

            groupApi = container "GroupMatching API" "Groups, members, leader vote, lock, random matching. All endpoints throw NotImplementedException (HTTP 501)." "ASP.NET Core 8 Web API" {
                groupsController = component "GroupsController" "GET/POST /api/groups, GET /api/groups/{id}, POST/DELETE members, POST /api/groups/{id}/lock. All stubs." "ASP.NET Core MVC controller" "Stub"
                leaderVoteController = component "LeaderVoteController" "POST /api/groups/{id}/vote-leader. Stub." "ASP.NET Core MVC controller" "Stub"
                matchingController = component "MatchingController" "POST /api/matching/random?semesterCode=. Stub." "ASP.NET Core MVC controller" "Stub"
                groupExHandler = component "GlobalExceptionHandler (Group)" "Shared exception-to-JSON middleware." "SharedKernel middleware"
                groupStartup = component "Program (Group composition root)" "Registers DI, Swagger, CORS; calls EnsureCreated() at startup." "ASP.NET Core minimal hosting"
                groupDbContext = component "GroupMatchingDbContext" "EF Core model for Groups, GroupMembers, GroupInvitations, LeaderVotes with seed data." "EF Core 8 + Npgsql"
                groupPublisher = component "KafkaEventPublisher (Group)" "Registered IEventPublisher; logs only; never called." "BuildingBlocks.Messaging" "Stub"
            }

            mentorApi = container "Mentor API" "Mentor list/detail/quota and mentor requests/decisions over REST (stubs), plus a gRPC service returning hard-coded data." "ASP.NET Core 8 Web API + gRPC" {
                mentorsController = component "MentorsController" "GET /api/mentors, /api/mentors/{id}, /api/mentors/{id}/quota. Stubs." "ASP.NET Core MVC controller" "Stub"
                mentorRequestsController = component "MentorRequestsController" "POST /api/mentor-requests, POST /api/mentor-requests/decision. Stubs." "ASP.NET Core MVC controller" "Stub"
                mentorGrpc = component "MentorGrpcServiceImpl" "gRPC MentorGrpcService (GetMentor, GetMentors, GetMentorQuota) from proto/mentor.proto. Returns hard-coded mock data. No gRPC client exists in the repo." "Grpc.AspNetCore 2.60" "Mock"
                mentorExHandler = component "GlobalExceptionHandler (Mentor)" "Shared exception-to-JSON middleware." "SharedKernel middleware"
                mentorStartup = component "Program (Mentor composition root)" "Registers DI, Swagger, CORS, AddGrpc/MapGrpcService; calls EnsureCreated() at startup." "ASP.NET Core minimal hosting"
                mentorDbContext = component "MentorDbContext" "EF Core model for Mentors, MentorQuotas, MentorRequests with seed data." "EF Core 8 + Npgsql"
                mentorPublisher = component "KafkaEventPublisher (Mentor)" "Registered IEventPublisher; logs only; never called." "BuildingBlocks.Messaging" "Stub"
            }

            notificationWorker = container "Notification Worker" "Background worker intended to consume Kafka events and send email. Currently loops with Task.Delay(5000) (TODO)." ".NET 8 Worker Service" {
                worker = component "Worker" "BackgroundService. Calls StartConsumingAsync then idles (// TODO: Consume Kafka events)." "BackgroundService"
                kafkaConsumer = component "KafkaConsumer" "IKafkaConsumer. StartConsumingAsync only logs; no Kafka connection." "C# class" "Stub"
                notificationHandler = component "NotificationHandler" "INotificationService. HandleEventAsync only logs." "C# class" "Stub"
                emailService = component "EmailService" "IEmailService. SendEmailAsync only logs." "C# class" "Mock"
            }

            identityDb = container "identity_db" "Tables: Users, Roles, Students, Semesters." "PostgreSQL 16" "Database"
            groupDb = container "group_matching_db" "Tables: Groups, GroupMembers, GroupInvitations, LeaderVotes." "PostgreSQL 16" "Database"
            mentorDb = container "mentor_db" "Tables: Mentors, MentorQuotas, MentorRequests." "PostgreSQL 16" "Database"

            kafka = container "Kafka Broker" "Event broker provisioned in docker-compose (with Zookeeper). No code actually produces or consumes messages." "Apache Kafka (cp-kafka 7.5.0)" "Queue,Stub"

            redis = container "Redis" "Provisioned in docker-compose only. No service references Redis." "Redis 7 (redis:7-alpine)" "Cache,Unused"
        }

        // ─────────────────────── Relationships ────────────────────────
        // People → system
        student -> frontend "Opens (template page only)" "HTTPS / browser" "Template"
        student -> gateway "Calls REST API (login, groups, votes, mentor requests)" "HTTP/JSON"
        admin -> gateway "Calls REST API (student import, semesters, random matching)" "HTTP/JSON"
        mentor -> gateway "Calls REST API (mentor requests & decisions)" "HTTP/JSON"

        // Gateway routing (be/src/Gateway/nginx/nginx.conf)
        gateway -> identityApi "Proxies /api/auth, /api/students, /api/semesters" "HTTP (proxy_pass :8080)"
        gateway -> groupApi "Proxies /api/groups, /api/matching" "HTTP (proxy_pass :8080)"
        gateway -> mentorApi "Proxies /api/mentors, /api/mentor-requests" "HTTP (proxy_pass :8080)"

        // Persistence
        identityApi -> identityDb "Creates schema + seed at startup (EnsureCreated)" "EF Core / Npgsql, TCP 5432"
        groupApi -> groupDb "Creates schema + seed at startup (EnsureCreated)" "EF Core / Npgsql, TCP 5432"
        mentorApi -> mentorDb "Creates schema + seed at startup (EnsureCreated)" "EF Core / Npgsql, TCP 5432"

        // Messaging (stub)
        identityApi -> kafka "Intended to publish StudentImportedEvent (publisher logs only; never called)" "Kafka (stub)" "Stub"
        groupApi -> kafka "Intended to publish Group*/Leader/Topic events (stub; never called)" "Kafka (stub)" "Stub"
        mentorApi -> kafka "Intended to publish Mentor* events (stub; never called)" "Kafka (stub)" "Stub"
        notificationWorker -> kafka "Intended to consume events (TODO; no connection made)" "Kafka (stub)" "Stub"
        notificationWorker -> smtp "Intended to send notification emails (EmailService logs only)" "SMTP :587 (configured)" "Stub"

        // Components — IdentitySemester
        gateway -> authController "Routes POST /api/auth/login" "HTTP"
        gateway -> studentsController "Routes /api/students*" "HTTP"
        gateway -> semesterController "Routes /api/semesters" "HTTP"
        identityExHandler -> authController "Wraps request pipeline" "ASP.NET Core middleware"
        identityExHandler -> studentsController "Wraps pipeline; maps NotImplementedException to 501" "ASP.NET Core middleware"
        identityExHandler -> semesterController "Wraps pipeline; maps NotImplementedException to 501" "ASP.NET Core middleware"
        identityStartup -> identityDbContext "Calls Database.EnsureCreated()" "EF Core"
        identityStartup -> jwtService "Registers (scoped) — not consumed" "DI" "Stub"
        identityStartup -> identityPublisher "Registers (singleton) — not consumed" "DI" "Stub"
        identityDbContext -> identityDb "Creates tables and seed rows" "Npgsql"
        identityPublisher -> kafka "Would publish events (logs only)" "Kafka (stub)" "Stub"

        // Components — GroupMatching
        gateway -> groupsController "Routes /api/groups*" "HTTP"
        gateway -> leaderVoteController "Routes /api/groups/{id}/vote-leader" "HTTP"
        gateway -> matchingController "Routes /api/matching/random" "HTTP"
        groupExHandler -> groupsController "Wraps pipeline; maps NotImplementedException to 501" "ASP.NET Core middleware"
        groupExHandler -> leaderVoteController "Wraps pipeline; maps NotImplementedException to 501" "ASP.NET Core middleware"
        groupExHandler -> matchingController "Wraps pipeline; maps NotImplementedException to 501" "ASP.NET Core middleware"
        groupStartup -> groupDbContext "Calls Database.EnsureCreated()" "EF Core"
        groupStartup -> groupPublisher "Registers (singleton) — not consumed" "DI" "Stub"
        groupDbContext -> groupDb "Creates tables and seed rows" "Npgsql"
        groupPublisher -> kafka "Would publish events (logs only)" "Kafka (stub)" "Stub"

        // Components — Mentor
        gateway -> mentorsController "Routes /api/mentors*" "HTTP"
        gateway -> mentorRequestsController "Routes /api/mentor-requests*" "HTTP"
        mentorExHandler -> mentorsController "Wraps pipeline; maps NotImplementedException to 501" "ASP.NET Core middleware"
        mentorExHandler -> mentorRequestsController "Wraps pipeline; maps NotImplementedException to 501" "ASP.NET Core middleware"
        mentorStartup -> mentorGrpc "Maps gRPC service (MapGrpcService)" "gRPC / HTTP2"
        mentorStartup -> mentorDbContext "Calls Database.EnsureCreated()" "EF Core"
        mentorStartup -> mentorPublisher "Registers (singleton) — not consumed" "DI" "Stub"
        mentorDbContext -> mentorDb "Creates tables and seed rows" "Npgsql"
        mentorPublisher -> kafka "Would publish events (logs only)" "Kafka (stub)" "Stub"

        // Components — Notification
        worker -> kafkaConsumer "Calls StartConsumingAsync()" "In-process"
        kafkaConsumer -> notificationHandler "Injected (never invoked)" "DI" "Stub"
        notificationHandler -> emailService "Injected (never invoked)" "DI" "Stub"
        kafkaConsumer -> kafka "Would subscribe to topics (logs only)" "Kafka (stub)" "Stub"
        emailService -> smtp "Would send email (logs only)" "SMTP (stub)" "Stub"

        // ─────────────────────── Deployment ───────────────────────────
        deploymentEnvironment "Docker Compose (local)" {
            deploymentNode "Docker host" "docker-compose.yml, bridge network capstone-network" "Docker Compose" {
                deploymentNode "exe-nginx-gateway" "Host port 8080 (GATEWAY_PORT) → 80" "nginx:alpine" {
                    containerInstance gateway
                }
                deploymentNode "exe-identity-semester" "Port 5001 → 8080" "mcr.microsoft.com/dotnet/aspnet:8.0" {
                    containerInstance identityApi
                }
                deploymentNode "exe-group-matching" "Port 5002 → 8080" "mcr.microsoft.com/dotnet/aspnet:8.0" {
                    containerInstance groupApi
                }
                deploymentNode "exe-mentor" "Ports 5003 → 8080, 50051 → 50051" "mcr.microsoft.com/dotnet/aspnet:8.0" {
                    containerInstance mentorApi
                }
                deploymentNode "exe-notification-worker" "No published ports" "mcr.microsoft.com/dotnet/runtime:8.0" {
                    containerInstance notificationWorker
                }
                deploymentNode "exe-postgres" "Port 5432; volume postgres-data; init-databases.sql creates the 3 DBs" "postgres:16-alpine" {
                    containerInstance identityDb
                    containerInstance groupDb
                    containerInstance mentorDb
                }
                deploymentNode "exe-kafka" "Ports 9092 (host) / 29092 (internal)" "confluentinc/cp-kafka:7.5.0" {
                    containerInstance kafka
                }
                deploymentNode "exe-zookeeper" "Client port 2181" "confluentinc/cp-zookeeper:7.5.0" {
                    zookeeper = infrastructureNode "Zookeeper" "Kafka cluster coordination" "Apache Zookeeper"
                }
                deploymentNode "exe-redis" "Port 6379; volume redis-data" "redis:7-alpine" {
                    containerInstance redis
                }
            }
        }

        deploymentEnvironment "Render (render.yaml blueprint)" {
            deploymentNode "Render — region singapore, plan free" "render.yaml" "Render PaaS" {
                deploymentNode "exe-api-gateway" "type: web" "Docker (be/src/Gateway/nginx)" {
                    containerInstance gateway
                }
                deploymentNode "exe-identity-semester" "type: web; JwtSettings__Secret generated" "Docker" {
                    containerInstance identityApi
                }
                deploymentNode "exe-group-matching" "type: web" "Docker" {
                    containerInstance groupApi
                }
                deploymentNode "exe-mentor" "type: web" "Docker" {
                    containerInstance mentorApi
                }
                deploymentNode "exe-notification-worker" "type: worker" "Docker" {
                    containerInstance notificationWorker
                }
                deploymentNode "exe-postgres-db" "Single managed DB exe_matching_db shared by all three APIs" "Render PostgreSQL" {
                    containerInstance identityDb
                    containerInstance groupDb
                    containerInstance mentorDb
                }
            }
        }
    }

    views {

        systemContext exe "SystemContext" "C4 Level 1 — System Context" {
            include *
            autoLayout lr
        }

        container exe "Containers" "C4 Level 2 — Containers" {
            include *
            autoLayout lr
        }

        component identityApi "Components-IdentitySemester" "C4 Level 3 — IdentitySemester API" {
            include *
            autoLayout lr
        }

        component groupApi "Components-GroupMatching" "C4 Level 3 — GroupMatching API" {
            include *
            autoLayout lr
        }

        component mentorApi "Components-Mentor" "C4 Level 3 — Mentor API" {
            include *
            autoLayout lr
        }

        component notificationWorker "Components-Notification" "C4 Level 3 — Notification Worker" {
            include *
            autoLayout lr
        }

        dynamic exe "Flow-Login" "Login flow as implemented (skeleton response, no credential check)" {
            student -> gateway "POST /api/auth/login {email, password}"
            gateway -> identityApi "proxy_pass to identity-semester:8080"
            autoLayout lr
        }

        dynamic exe "Flow-Startup" "Service start-up: schema creation and seed via EnsureCreated()" {
            identityApi -> identityDb "EnsureCreated(): Users, Roles, Students, Semesters + seed"
            groupApi -> groupDb "EnsureCreated(): Groups, GroupMembers, GroupInvitations, LeaderVotes + seed"
            mentorApi -> mentorDb "EnsureCreated(): Mentors, MentorQuotas, MentorRequests + seed"
            autoLayout lr
        }

        dynamic groupApi "Flow-StubbedRequest" "Any Phase 2 endpoint, e.g. POST /api/groups → HTTP 501 via GlobalExceptionHandler" {
            gateway -> groupsController "POST /api/groups"
            groupExHandler -> groupsController "Catches NotImplementedException → 501 JSON ErrorResponse"
            autoLayout lr
        }

        deployment exe "Docker Compose (local)" "Deployment-DockerCompose" "Local deployment via docker-compose.yml" {
            include *
            autoLayout lr
        }

        deployment exe "Render (render.yaml blueprint)" "Deployment-Render" "Cloud blueprint in render.yaml (no Kafka/Redis defined)" {
            include *
            autoLayout lr
        }

        styles {
            element "Person" {
                shape Person
                background #08427B
                color #ffffff
            }
            element "Software System" {
                background #1168BD
                color #ffffff
            }
            element "Container" {
                background #438DD5
                color #ffffff
            }
            element "Component" {
                background #85BBF0
                color #000000
            }
            element "Database" {
                shape Cylinder
            }
            element "Queue" {
                shape Pipe
            }
            element "Cache" {
                shape Cylinder
            }
            element "WebBrowser" {
                shape WebBrowser
            }
            element "Gateway" {
                shape Hexagon
            }
            element "External" {
                background #999999
                color #ffffff
            }
            element "Stub" {
                border dashed
            }
            element "Mock" {
                border dashed
            }
            element "Unused" {
                border dotted
                opacity 60
            }
            element "Template" {
                border dotted
                opacity 60
            }
            relationship "Relationship" {
                routing Orthogonal
            }
            relationship "Stub" {
                style dashed
                color #999999
            }
            relationship "Template" {
                style dotted
                color #999999
            }
        }
    }
}
