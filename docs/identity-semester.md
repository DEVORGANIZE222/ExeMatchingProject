# Service 1 - IdentitySemester

## Phạm vi và nguồn yêu cầu

Triển khai theo `PRN232 - Final Assignment.pdf` (3 trang) và `ProjectInformation.txt` đã được cung cấp. PDF quy định công nghệ và deliverable cho **toàn hệ thống**; TXT phân công nghiệp vụ. Phiên này chỉ hoàn thiện Service 1 và phần gateway/database/test cần thiết cho Service 1. Không thêm đăng ký công khai, refresh-token workflow, frontend hay nghiệp vụ nhóm/mentor/email.

Luồng code: Controller (HTTP, DTO, RBAC) → `Application/Services/IdentityService` (nghiệp vụ) → `IIdentityStore` / `Infrastructure/Persistence/IdentityRepository` (EF Core/PostgreSQL). Domain chứa User, Role, Student, Semester. `IdentityErrorHandler` xử lý lỗi và ẩn chi tiết nội bộ khỏi response 500.

## Chạy và đăng nhập

1. Root `.env` phải có kết nối DB, Kafka và `JWT_SECRET` tối thiểu 32 byte. File `.env (2)` được gửi có cùng các giá trị cấu hình với `.env` tại thời điểm kiểm tra; không cần chép đè.
2. Đặt `BOOTSTRAP_ADMIN_EMAIL` và `BOOTSTRAP_ADMIN_PASSWORD` (12–128 ký tự) trong `.env` riêng. Máy hiện tại đã có tài khoản bootstrap được tạo bằng mật khẩu ngẫu nhiên, nằm trong `.env` đã được Git ignore. Không đưa mật khẩu vào README hoặc Git. Bootstrap chỉ tạo khi email chưa tồn tại, không reset tài khoản đã có.
3. Khởi động infrastructure nếu đang dừng: `docker compose up -d postgres zookeeper kafka`.
4. Khi stack của nhóm đã chạy: `docker compose up -d --build --no-deps identity-semester nginx`. Khi cài mới: `docker compose up -d --build`.
5. Swagger Service 1: `http://localhost:5001/` (hoặc `IDENTITY_PORT`); API qua gateway: `http://localhost:8080/api/...` (hoặc `GATEWAY_PORT`). Gọi `POST /api/auth/login` hoặc `POST /api/auth/google`, dùng `data.token` trong nút Authorize của Swagger hoặc header `Authorization: Bearer <token>`.

Các cổng trên là mặc định. Docker local hiện dùng HTTP; HTTPS trong sơ đồ là hướng triển khai khi có TLS termination, chưa phải cấu hình HTTPS đã cài. Nginx đang kiểm tra JWT cho student/semester qua internal `auth_request` đến `/api/auth/validate`. API vẫn tự xác thực và kiểm tra quyền khi gọi trực tiếp.

Tài khoản demo `student01` từ skeleton chứa hash không hợp lệ nên không đăng nhập được. Không tự reset tài khoản này: tạo/import sinh viên mới để thử nghiệp vụ. `RefreshToken` được giữ trong response để tương thích hình dạng cũ nhưng luôn là `null`; hết hạn thì đăng nhập lại.

## API và quyền

| Method / route | Quyền | Kết quả |
|---|---|---|
| POST `/api/auth/login` | Public | JWT HS256, expiration, hồ sơ sinh viên nếu có |
| POST `/api/auth/google` | Public | Xác minh Google ID token, email đã xác minh/whitelist, rồi trả cùng JWT HS256 và RBAC nội bộ |
| GET `/api/google-access` | Admin | Danh sách email được phép Google Sign-In |
| POST `/api/google-access/import/excel` | Admin | Import whitelist Excel có cột A: `Email` |
| DELETE `/api/google-access/{id}` | Admin | Gỡ một email khỏi whitelist database |
| GET `/api/auth/me` | Đã đăng nhập | id, username, email, role và `avatarUrl` nếu Google cung cấp ảnh |
| PUT `/api/auth/me` | Chủ tài khoản | Sửa username; không thay role/email |
| PUT `/api/auth/password` | Chủ tài khoản | Xác nhận mật khẩu cũ, hash mật khẩu mới; token cũ hết hiệu lực |
| PUT `/api/students/{id}/strength-roles` | Chủ hồ sơ hoặc Admin | Chọn 1–6 role chuyên môn; không thay đổi RBAC |
| GET `/api/auth/validate` | JWT hợp lệ | 204, dùng cho gateway |
| GET `/api/students` | Admin | Tìm kiếm/lọc/sắp xếp/phân trang |
| GET `/api/students/{id}` | Admin hoặc chủ hồ sơ | Chi tiết sinh viên |
| POST `/api/students` | Admin | Tạo account và enrollment, 201 + Location |
| PUT `/api/students/{id}` | Admin | Sửa fullName, major |
| DELETE `/api/students/{id}` | Admin | Xóa enrollment chưa có nhóm; giữ account, 204 |
| POST `/api/students/import` | Admin | Import JSON toàn bộ hoặc không lưu gì |
| POST `/api/students/import/excel` | Admin | Import `.xlsx`, multipart/form-data |
| GET `/api/semesters`, GET `/api/semesters/{id}` | Đã đăng nhập | Danh sách/chi tiết và các mốc học kỳ |
| POST `/api/semesters` | Admin | Tạo học kỳ, 201 + Location |
| PUT `/api/semesters/{id}` | Admin | Cập nhật code, lịch, tên, isActive; đổi code phát event đồng bộ GroupMatching |
| DELETE `/api/semesters/{id}` | Admin | Chỉ xóa học kỳ chưa có sinh viên |
| GET `/health` | Public | Kiểm tra API đang chạy |

JWT kiểm tra chữ ký, HS256, issuer, audience, expiration và account/token version hiện tại. Role được kiểm tra lại với DB. Không trả password hash trong DTO. `HasGroup`, `UserId`, `RoleId` không thể được ghi qua DTO cập nhật hồ sơ. HasGroup là trạng thái do GroupMatching cần đồng bộ khi tích hợp; Service 1 không tự thực thi nhóm 4–5 người/vote/lock/random matching.

Google sign-in là luồng bổ sung, không thay đổi `POST /api/auth/login`: client gửi Google ID token trong `{ "credential": "..." }` đến `POST /api/auth/google`. Backend xác minh chữ ký, audience, issuer và expiration với Google; bắt buộc `email_verified`; sau đó so email đã chuẩn hóa với whitelist database do Admin import, hoặc `GoogleAuth:AllowedEmails` để bootstrap. Backend liên kết account bằng Google `sub` bất biến và tự phát hành JWT/RBAC nội bộ như login cũ; không tin email/sub do client tự gửi. Excel whitelist đọc worksheet đầu, tìm header `Email` hoặc `Gmail` trong 30 dòng đầu (hỗ trợ roster có phần ghi chú), tối đa 2.000 giá trị không rỗng và không nhận formula; mọi giá trị trong cột này được lowercase/deduplicate mà không kiểm tra cú pháp email. Google token hợp lệ vẫn là điều kiện bắt buộc để đăng nhập. Để kích hoạt môi trường thật, khai báo OAuth web client ID riêng ở `GOOGLE_CLIENT_ID` trong `.env` (không commit), đặt cùng client ID công khai tại `fe/.env.local` qua `VITE_GOOGLE_CLIENT_ID`, rồi đăng ký origin frontend tương ứng tại Google Cloud Console. Khi thiếu client ID, endpoint fail-closed với 503.

Response danh sách thay skeleton `List<T>` bằng `ApiResponse<PageResult<T>>`: `data.items`, `totalCount`, `page`, `pageSize`. Create trả 201; delete/change password trả 204; thiếu/sai token 401; sai quyền 403; không tồn tại 404; dữ liệu trùng hoặc xóa dữ liệu đang được tham chiếu 409; validation 400. Validation tự động của ASP.NET dùng ValidationProblemDetails, lỗi nghiệp vụ dùng ApiResponse.

Query sinh viên: `search` (code/name/email), `semesterCode`, `hasGroup`, `sortBy=code|name|email`, `descending`, `page`, `pageSize`. Query học kỳ: `search` (code/name), `isActive`, `sortBy=code|name|startDate`, `descending`, `page`, `pageSize`. Page bắt đầu từ 1, pageSize mặc định 20, tối đa 2.000. Truy vấn được chạy trên DB, có thứ tự phụ theo id để phân trang ổn định.

## Dữ liệu nhập và mốc thời gian

Tạo sinh viên:

```json
{
  "semesterCode": "FALL2026",
  "initialPassword": "replace-with-private-password",
  "student": { "studentCode": "SE200001", "fullName": "Nguyen Van A", "email": "student@example.edu", "major": "SE" }
}
```

Import JSON dùng `semesterCode`, `initialPassword`, `students` (mảng có cấu trúc như `student` ở trên). Mật khẩu ban đầu do Admin cung cấp, không nằm trong Excel hoặc event; sinh viên đổi mật khẩu qua API tài khoản. Chỉ account mới dùng mật khẩu ban đầu; nhập cùng account ở học kỳ mới không reset mật khẩu cũ.

Excel: worksheet đầu tiên; hệ thống tìm hàng tiêu đề hợp lệ trong 30 dòng đầu để hỗ trợ file roster có phần thông báo, deadline hoặc tiêu đề phía trên bảng. Cần năm trường: `StudentCode`/`MSSV`, `FullName`/`Họ & Tên`, `Email`/`Gmail`, `Major`/`Ngành`, `SemesterCode`/`Mã học kỳ`. Toàn bộ file phải có đúng một `SemesterCode`; nếu frontend gửi học kỳ chọn kèm theo thì giá trị phải khớp. Mật khẩu khởi tạo có độ dài 6–128; mật khẩu đổi tài khoản vẫn dùng chính sách bảo mật riêng. Chấp nhận `.xlsx` tối đa 2 MB, nội dung giải nén tối đa 10 MB, 1–2.000 dòng đầy đủ năm trường. Không chấp nhận formula. Lỗi bất kỳ dòng hợp lệ nào không tạo enrollment/account/event của cả lô.

Email normalize lowercase, mã normalize uppercase. Khi Admin tạo/import roster, mọi email sinh viên được thêm vào Google whitelist trong đúng transaction import; lỗi import sẽ không để lại quyền Google rời rạc. Việc xóa enrollment vẫn giữ account và whitelist để Admin chủ động quyết định gỡ quyền qua Google Access. DB có unique indexes cho email, semester code, `(SemesterId, StudentCode)` và `(SemesterId, UserId)`. Account Student có thể ghi danh học kỳ tiếp theo với cùng email/code; account dùng lại không bị reset mật khẩu.

Mốc học kỳ dùng UTC, gửi hậu tố `Z`: `startDate < registrationDeadline < topicDeadline < mentorDeadline <= endDate`. Cả 3 mốc được gửi cùng nhau hoặc đều để null khi học kỳ chưa cấu hình lịch. Đây là cách cụ thể hóa các mốc từ TXT; không phải tên trường được thầy quy định trong PDF. `startDate` là thời điểm mở học kỳ/đăng ký. GroupMatching/Mentor đọc lịch và thực thi deadline trong service của họ. Có thể dùng `isActive=false` thay vì xóa học kỳ đã có sinh viên.

## Database và Kafka

`DatabaseInitializer` hỗ trợ database trống (EF EnsureCreated) và database Phase 1 đã tồn tại. Script embedded `IdentitySemester.Infrastructure/Persistence/identity-upgrade.sql` bổ sung TokenVersion, 3 deadline, outbox, unique indexes và FK Restrict. Script có thể chạy lại, nằm trong transaction, không drop table hay xóa dữ liệu. Nếu DB có dữ liệu trùng từ trước, unique index sẽ báo lỗi và dừng; không tự xóa dữ liệu để vượt lỗi. Full baseline DDL cho database mới nằm ở `be/database-scripts/01_identity_db_schema.sql`; script này không được tự chạy trên volume hiện có.

Khi tạo/import sinh viên, `StudentImportedEvent` và dữ liệu được lưu cùng transaction EF. Khi Admin đổi mã học kỳ, `SemesterCodeChangedEvent` được lưu cùng transaction và GroupMatching consume để cập nhật `Groups.SemesterCode` idempotent, không có cross-service FK. `StudentOutboxPublisher` kiểm tra mỗi 5 giây và publish theo `Topic` của outbox. Kafka tạm lỗi không làm mất sự kiện đã lưu. Delivery là **at-least-once**: consumer phải deduplicate/idempotent theo key outbox.

Consumer/email của Notification chưa được triển khai trong phạm vi này. CLI consumer trong smoke test chỉ xác nhận producer thực sự giao tiếp Kafka, không thay thế deliverable consumer nghiệp vụ của thành viên Service 4. Shared KafkaEventPublisher/KafkaEventConsumer vẫn là skeleton của codebase; Service 1 dùng publisher riêng để không thay đổi hành vi của service khác.

## Kiểm thử và đối chiếu requirement

Kết quả ngày 2026-10-01: **28/28 test tự động pass**, Docker smoke pass; xem [báo cáo kiểm thử](identity-semester-test-report.md) để biết bằng chứng và giới hạn kiểm chứng.

Chạy bộ kiểm thử với PostgreSQL thật trong mạng Docker:

```powershell
./be/scripts/test-identity.ps1
./be/scripts/smoke-identity.ps1
dotnet build be/EXETeamMatching.sln
```

Test tự động dùng database tên ngẫu nhiên `identity_test_*` riêng, xóa đúng database đó sau khi chạy. Smoke test dùng stack local, tạo dữ liệu `SMOKE*` riêng rồi xóa đúng những bản ghi đó; Kafka vẫn giữ event giả lập theo retention. Không gửi email thật. Nếu chạy test trên host, có thể dùng `-HostTests -PostgresHost <address>`; máy này có PostgreSQL Windows trùng cổng Docker nên ưu tiên test trong Docker.

| Requirement | Phạm vi / bằng chứng |
|---|---|
| PDF 2.1 REST CRUD, naming, layers, JWT, query | Service 1 triển khai; API/EF integration tests và smoke Nginx |
| PDF 2.2 background processing | Publisher outbox chạy thật trong Service 1; Notification worker nghiệp vụ thuộc Service 4 |
| PDF 2.3 producer + consumer | Producer Service 1 đã gửi Kafka, CLI consumer đã nhận; consumer nghiệp vụ Service 4 còn thiếu |
| PDF 2.4 REST ↔ gRPC | Thuộc GroupMatching/Mentor; skeleton hiện chưa có REST client gọi gRPC, chưa đạt yêu cầu toàn hệ thống |
| PDF 3 Docker hoặc cloud | Service 1 + Nginx đã build/run Compose; không cần triển khai cloud bổ sung để đáp ứng lựa chọn Docker |
| PDF 4 EF/SQL/DI/config/logging/errors/JWT | Có code và test cho Service 1; không coi phần còn lại tự động đạt |
| PDF 5 source, DB script, Docker, Swagger, README | Có cho Service 1; README mô tả phân công theo service, nhóm cần bổ sung tên thành viên thật |
| PDF 6 demo end-to-end | Có workflow Service 1; nhóm cần hoàn thiện nhóm → đề tài → mentor → notification |
| TXT import Excel ~200, account, học kỳ, RBAC | Có import 200, account/password, milestones, Admin/Student authorization tests |

Không thể đánh dấu toàn bộ bài tập đạt chỉ vì Service 1 đạt test. Các service còn lại vẫn có `NotImplementedException`, gRPC mock và consumer/email skeleton. Frontend hiện vẫn là React/Vite starter. Không thực hiện tính năng bonus, Cloudflare/DDoS setup hay thay đổi business logic thuộc thành viên khác.
