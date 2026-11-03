# Group & Matching Service

Service 2 owns groups, membership, leader voting, group locking, random matching and topic registration in `group_matching_db`. It never reads or writes `identity_db` or `mentor_db`.

## API

All endpoints require an IdentitySemester JWT. `POST /api/matching/random` requires the `Admin` role.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/groups?semesterCode=...` | Paged, filtered group list |
| GET | `/api/groups/{id}` | Group detail |
| POST | `/api/groups` | Create an open group; creator joins automatically |
| PUT | `/api/groups/{id}` | Rename an open group (creator or Admin) |
| DELETE | `/api/groups/{id}` | Delete an open group (creator or Admin) |
| POST | `/api/groups/{id}/members` | Join an available slot |
| DELETE | `/api/groups/{id}/members/me` | Leave an open group |
| DELETE | `/api/groups/{id}/members/{studentId}` | Admin removes a member from an open group |
| POST | `/api/groups/{id}/vote-leader` | Vote or change a vote |
| POST | `/api/groups/{id}/lock` | Leader locks a 4–5 member group |
| POST | `/api/groups/{id}/topic` | Leader registers a topic after lock |
| POST | `/api/matching/random?semesterCode=...` | Admin random matching |

`CreateGroupRequest` intentionally has no `CreatorStudentId`; `VoteLeaderRequest` intentionally has no voter id. The API derives actors from the validated JWT and asks IdentitySemester for the caller's enrollment for the requested semester.

## Data and integration

- `Groups`, `GroupMembers`, `LeaderVotes`, `GroupEventOutbox` are the only active Service 2 tables.
- `GroupMembers.StudentId`, `Groups.LeaderStudentId`, and `Groups.SemesterCode` are opaque references; there are no cross-service database foreign keys.
- `GroupInvitations` is no longer in the EF model because the agreed workflow is direct slot selection, not invite approval.
- The additive `group-matching-upgrade.sql` runs after `EnsureCreated`; it does not delete old rows or Docker volumes.
- Service 2 forwards the caller's JWT to two narrow, read-only IdentitySemester endpoints: current enrollment and semester workflow. Admin random matching uses the existing Admin student list filtered by `HasGroup=false`.
- Service 2 writes Kafka events into its outbox in the same transaction, then retries publication every five seconds. IdentitySemester consumes `student-group-membership-changed` and is the only service that changes `Students.HasGroup`.

## Rules

- A student may belong to one group per semester; a group has at most five members.
- An election succeeds only when a nominee has a strict majority of current members.
- A leader may lock only an `Open` group with four or five members.
- Registration actions are permitted only before `RegistrationDeadline`; locking/topic registration must be before `TopicDeadline`.
- Random matching fills existing open groups to four first, then fills spare slots, then creates only groups of four or five. If a valid complete allocation is impossible, it rolls back and returns `409`.
