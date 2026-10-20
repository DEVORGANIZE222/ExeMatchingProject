# IdentitySemester - Verification report

Date: 2026-10-01. Scope: Service 1 only, against the teacher's three-page PRN232 assignment and the team's ProjectInformation.txt.

## Results

- .NET solution build succeeded, zero warnings and zero errors at the verification run.
- Latest IdentitySemester Docker build/publish succeeded, zero warnings and zero errors.
- Automated tests: **28 passed, 0 failed, 0 skipped**, real PostgreSQL, isolated `identity_test_*` databases inside the Compose network. Test databases were removed after completion.
- Nginx `nginx -t` passed.
- Live Docker smoke test passed all 9 checks: gateway JWT login, anonymous 401, authenticated Admin role, Swagger Excel route, semester creation, student creation, Student/Admin 403 separation, own-profile access, and real Kafka CLI consumption of StudentImportedEvent.
- Existing PostgreSQL data/volume preserved; only synthetic smoke records were cleaned up. Synthetic Kafka events remain subject to broker retention.
- `git diff --check` passed. No commit or push performed.

## Coverage

| Area | Verified cases |
|---|---|
| Authentication | Correct/incorrect credentials; signed JWT; invalid signature, issuer, audience and expired JWT; anonymous requests denied; Google ID token validation is mocked at the provider boundary to verify whitelist, verified email, immutable subject binding and the same internal JWT/RBAC result |
| Authorization | Admin roster/semester operations; Student own-profile access; another profile denied; Student denied roster/write operations |
| Account security | Hashed password storage; own username change; password change revokes previous token; new password login |
| Student CRUD | Create/Location, read, update, delete, not found, active-semester guard, enrollment in another semester without resetting account password |
| Student query | Search, semester/group filters, sorting, stable pagination; invalid page, page size, sort and overflow rejected |
| Import | Whole-batch validation; duplicate code/email rejection; duplicate retry conflict; invalid email row leaves no partial roster; XLSX 200 rows through multipart API |
| Excel reader | Unicode, 0/501-row limits, invalid ZIP, wrong headers and formula rejection |
| Semester | Create/read/update/delete, normalized unique code, inactive filtering, forbidden deletion when students exist |
| Milestones | UTC, date bounds, chronological order, partial configuration rejected |
| Integrity | Concurrent duplicate creates produce one 201 and one 409; cannot mass-assign role/HasGroup; cannot delete a student marked in a group |
| Persistence | Outbox stored with student; repeatable SQL upgrade preserves existing records; actual legacy DB upgraded without dropping data |
| Infrastructure | API image build, live Nginx auth_request + RBAC, PostgreSQL queries, Kafka producer and independent CLI consumer |

## Reproduce

```powershell
docker compose up -d postgres zookeeper kafka
docker compose up -d --build --no-deps identity-semester nginx
./be/scripts/test-identity.ps1
./be/scripts/smoke-identity.ps1
dotnet build be/EXETeamMatching.sln
```

The local Windows installation also listens on PostgreSQL port 5432. Initial host test attempts failed authentication due to the conflicting host database route; the authoritative passing tests run entirely inside the Docker network. No password resets or changes to the Windows PostgreSQL instance were made.

## Requirement boundaries

Service 1 covers the assigned authentication/JWT/RBAC, students/accounts and semester milestone functionality. [The implementation guide](identity-semester.md) maps every teacher requirement to the responsible service.

The overall assignment is **not yet complete**: GroupMatching business logic, real REST-to-Mentor gRPC interaction, Notification's real consumer/email processing, frontend integration, and the full group/topic/mentor/notification demonstration remain team work. A CLI consumer proves Service 1's real Kafka publication but does not implement Service 4. HTTPS in the illustration is not installed TLS in the local Compose setup. Existing placeholder tests for other services are not counted as functionality evidence.

Google sign-in production verification requires a private Google OAuth web client ID and a real browser-issued ID token for the configured frontend origin. The implementation fails closed if `GOOGLE_CLIENT_ID` is absent; no OAuth secret or token is stored in this repository.
