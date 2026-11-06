# Kịch bản demo — Service 1 và Service 2

Kịch bản này minh chứng hai service do nhóm phụ trách theo rubric: REST CRUD, JWT/RBAC, PostgreSQL/EF, Kafka producer/consumer, background processing, gRPC client, Docker và Swagger. Không cần dữ liệu seed nghiệp vụ; dùng tài khoản Admin bootstrap riêng trong `.env`.

## 1. Chuẩn bị

1. Tạo `.env` cục bộ từ `.env.example`; nhập JWT secret và thông tin Admin bootstrap của riêng máy. Không commit file này.
2. Khởi động: `docker compose up -d --build`.
3. Mở Swagger Identity: `http://localhost:5001/`; Swagger GroupMatching: `http://localhost:5002/`.
4. Đăng nhập Admin qua `POST /api/auth/login`; đặt `data.token` vào Authorize của hai Swagger.

## 2. IdentitySemester: CRUD, RBAC và Kafka

1. `POST /api/semesters` tạo một học kỳ có mốc UTC hợp lệ `start < registration < topic < mentor <= end`.
2. `POST /api/students/import` hoặc `/import/excel` nhập roster; kiểm tra `GET /api/students` với `search`, `semesterCode`, `sortBy`, `page`, `pageSize`.
3. `PUT /api/students/{id}`, `GET /api/students/{id}`, `DELETE /api/students/{id}` minh chứng CRUD. `POST /api/google-access/import/excel` minh chứng whitelist Google.
4. Đăng nhập một Student; chứng minh `GET /api/students` trả 403 nhưng `GET /api/students/{own-id}` thành công.
5. Chạy `./be/scripts/smoke-identity.ps1`: script tạo record `SMOKE*`, xác nhận topic Kafka `student-imported`, rồi chỉ xóa record do chính script tạo.

## 3. GroupMatching: lifecycle, REST và broker

1. Bảo đảm thời điểm hiện tại nằm trước `registrationDeadline`, rồi dùng JWT Student gọi `POST /api/groups`.
2. Bốn đến năm Student gọi `POST /api/groups/{id}/members`; thử thành viên thứ sáu để thấy 409.
3. Các thành viên gọi `POST /api/groups/{id}/vote-leader`. Khi có quá bán, leader gọi `/lock`; thử lock nhóm dưới bốn người để thấy 409.
4. Leader gọi `POST /api/groups/{id}/topic` sau lock. Kiểm tra danh sách và chi tiết qua `GET /api/groups` / `GET /api/groups/{id}`. Dùng PUT/DELETE với group Open khác để minh chứng CRUD.
5. Với các Student lẻ, Admin gọi `POST /api/matching/random?semesterCode=...`; kết quả chỉ sinh nhóm 4–5 hoặc trả 409 và rollback khi không thể phân bổ hợp lệ.
6. Xem log `docker compose logs -f group-matching identity-semester`. Group outbox publish event sang Kafka; IdentitySemester consumer cập nhật `HasGroup` chỉ trong `identity_db`. `GroupOutboxCleanupWorker` chạy định kỳ, chỉ xóa event đã publish quá retention nên không tự lock hoặc tự random nhóm.

## 4. REST → gRPC proof

Sau khi group đã **Locked** và có topic, gọi `GET /api/groups/{id}/mentor-recommendations`. GroupMatching gọi `GetMentors` trên `MentorGrpc:Address` và chỉ trả mentor còn quota.

Đây là client gRPC thật ở Service 2, nhưng server/DB data của Mentor là trách nhiệm Service 3. Trước khi demo toàn hệ thống, Service 3 phải chạy `MentorGrpcService` thực trên HTTP/2 port `50051` và trả dữ liệu quota thật. Nếu dịch vụ đó chưa sẵn sàng, endpoint cố ý trả 503 thay vì làm giả dữ liệu.

## 5. Bằng chứng bàn giao

- Unit test Group: `dotnet test be/src/Tests/GroupMatching.Tests/GroupMatching.Tests.csproj`.
- Unit/integration test Identity: `./be/scripts/test-identity.ps1` (PostgreSQL Docker).
- Export OpenAPI sau khi stack chạy: `./be/scripts/export-openapi.ps1`; hai file được ghi vào `docs/api/` và nên đính kèm cùng bản nộp.
- DDL baseline: `be/database-scripts/01_identity_db_schema.sql` và `02_group_matching_db_schema.sql`. Compose vẫn dùng EF `EnsureCreated` + upgrade additive để không phá volume cũ.
