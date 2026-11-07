using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using EXETeamMatching.IdentitySemester.Application.DTOs;
using EXETeamMatching.IdentitySemester.Application.Interfaces;
using EXETeamMatching.IdentitySemester.Application.Services;
using EXETeamMatching.IdentitySemester.Infrastructure.Persistence;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace EXETeamMatching.IdentitySemester.Tests;

public class IdentitySemesterServiceTests(IdentityApiFixture fixture) : IClassFixture<IdentityApiFixture>
{
    private static DateTime Utc(int month, int day = 1) => new(2027, month, day, 0, 0, 0, DateTimeKind.Utc);
    private async Task<SemesterDto> Semester()
    {
        var response = await fixture.Admin.PostAsJsonAsync("/api/semesters", new CreateSemesterRequest(
            "T" + Guid.NewGuid().ToString("N")[..12], "Test semester", Utc(1), Utc(6), Utc(2), Utc(3), Utc(4)));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(response.Headers.Location);
        return (await response.Content.ReadFromJsonAsync<ApiResponse<SemesterDto>>())!.Data!;
    }
    private async Task<StudentResponse> Student(SemesterDto semester)
    {
        var code = "S" + Guid.NewGuid().ToString("N")[..12];
        var response = await fixture.Admin.PostAsJsonAsync("/api/students",
            new CreateStudentRequest(semester.Code, new(code, "Test Student", code + "@test.edu", "SE"), IdentityApiFixture.Password));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ApiResponse<StudentResponse>>())!.Data!;
    }

    [Fact]
    public async Task Anonymous_cannot_read_or_write_protected_routes()
    {
        using var client = fixture.CreateClient();
        foreach (var path in new[] { "/api/students", "/api/semesters", "/api/auth/me", "/api/auth/validate" })
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/semesters",
            new CreateSemesterRequest("X", "X", Utc(1), Utc(6)))).StatusCode);
    }

    [Fact]
    public async Task Login_rejects_bad_credentials_and_returns_real_signed_token()
    {
        using var client = fixture.CreateClient();
        var bad = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(IdentityApiFixture.AdminEmail, "wrong"));
        Assert.Equal(HttpStatusCode.Unauthorized, bad.StatusCode);
        var login = await IdentityApiFixture.SignIn(client, IdentityApiFixture.AdminEmail, IdentityApiFixture.Password);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(login.Token);
        Assert.Equal("Admin", jwt.Claims.Single(c => c.Type == "role").Value);
        Assert.Null(login.RefreshToken);
        Assert.True(login.Expiration > DateTime.UtcNow);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Google_login_uses_verified_whitelist_and_issues_the_same_application_jwt()
    {
        var semester = await Semester();
        var enrollment = new CreateStudentRequest(semester.Code,
            new("GOOGLETEST", "Google Student", "nhanlhse184226@fpt.edu.vn", "SE"), IdentityApiFixture.Password);
        Assert.Equal(HttpStatusCode.Created, (await fixture.Admin.PostAsJsonAsync("/api/students", enrollment)).StatusCode);
        using var client = fixture.CreateClient();
        var denied = await client.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(FakeGoogleIdTokenValidator.DeniedCredential));
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        var unverified = await client.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(FakeGoogleIdTokenValidator.UnverifiedCredential));
        Assert.Equal(HttpStatusCode.Forbidden, unverified.StatusCode);
        var invalid = await client.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest("unknown-google-id-token-for-test"));
        Assert.Equal(HttpStatusCode.Unauthorized, invalid.StatusCode);

        var response = await client.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(FakeGoogleIdTokenValidator.AllowedCredential));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var login = (await response.Content.ReadFromJsonAsync<ApiResponse<LoginResponse>>())!.Data!;
        var token = new JwtSecurityTokenHandler().ReadJwtToken(login.Token);
        Assert.Equal("Student", token.Claims.Single(c => c.Type == "role").Value);
        Assert.Equal("nhanlhse184226@fpt.edu.vn", token.Claims.Single(c => c.Type == "email").Value);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.Token);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);
        var profile = (await client.GetFromJsonAsync<ApiResponse<AccountResponse>>("/api/auth/me"))!.Data!;
        Assert.Equal("https://lh3.googleusercontent.com/test-avatar", profile.AvatarUrl);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/students")).StatusCode);

        var repeat = await client.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(FakeGoogleIdTokenValidator.AllowedCredential));
        Assert.Equal(HttpStatusCode.OK, repeat.StatusCode);
        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IdentitySemesterDbContext>();
        Assert.Equal(1, await db.Users.CountAsync(u => u.GoogleSubject == "google-subject-1"));
    }

    [Fact]
    public async Task Deleting_last_enrollment_revokes_google_access_and_existing_identity_token()
    {
        var first = await Semester();
        var second = await Semester();
        var student = await Student(first);
        var secondRequest = new CreateStudentRequest(second.Code,
            new(student.StudentCode, student.FullName, student.Email, student.Major), IdentityApiFixture.Password);
        var created = await fixture.Admin.PostAsJsonAsync("/api/students", secondRequest);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var other = (await created.Content.ReadFromJsonAsync<ApiResponse<StudentResponse>>())!.Data!;
        using var client = fixture.CreateClient();
        await IdentityApiFixture.SignIn(client, student.Email, IdentityApiFixture.Password);
        Assert.Equal(HttpStatusCode.NoContent, (await fixture.Admin.DeleteAsync("/api/students/" + student.Id)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);
        using (var scope = fixture.Services.CreateScope())
            Assert.True(await scope.ServiceProvider.GetRequiredService<IdentitySemesterDbContext>().GoogleAllowedEmails.AnyAsync(x => x.Email == student.Email));
        Assert.Equal(HttpStatusCode.NoContent, (await fixture.Admin.DeleteAsync("/api/students/" + other.Id)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        using (var scope = fixture.Services.CreateScope())
            Assert.False(await scope.ServiceProvider.GetRequiredService<IdentitySemesterDbContext>().GoogleAllowedEmails.AnyAsync(x => x.Email == student.Email));
        using var anonymous = fixture.CreateClient();
        Assert.Equal(HttpStatusCode.Forbidden, (await anonymous.PostAsJsonAsync("/api/auth/login", new LoginRequest(student.Email, IdentityApiFixture.Password))).StatusCode);
    }

    [Fact]
    public async Task Google_login_links_an_existing_whitelisted_account_without_changing_its_role()
    {
        var semester = await Semester();
        var request = new CreateStudentRequest(semester.Code,
            new("EXISTING", "Existing Student", "existing@student.test", "SE"), IdentityApiFixture.Password);
        Assert.Equal(HttpStatusCode.Created, (await fixture.Admin.PostAsJsonAsync("/api/students", request)).StatusCode);
        using var client = fixture.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/google", new GoogleLoginRequest(FakeGoogleIdTokenValidator.ExistingAccountCredential));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var login = (await response.Content.ReadFromJsonAsync<ApiResponse<LoginResponse>>())!.Data!;
        Assert.Equal("existing@student.test", new JwtSecurityTokenHandler().ReadJwtToken(login.Token).Claims.Single(c => c.Type == "email").Value);
        using var scope = fixture.Services.CreateScope();
        var user = await scope.ServiceProvider.GetRequiredService<IdentitySemesterDbContext>().Users.Include(u => u.Role)
            .SingleAsync(u => u.Email == "existing@student.test");
        Assert.Equal("google-subject-2", user.GoogleSubject);
        Assert.Equal("Student", user.Role.Name);
        Assert.NotEmpty(user.PasswordHash);
    }

    [Theory]
    [InlineData("signature")]
    [InlineData("issuer")]
    [InlineData("audience")]
    [InlineData("expiry")]
    public async Task Invalid_tokens_are_rejected(string error)
    {
        var account = (await fixture.Admin.GetFromJsonAsync<ApiResponse<AccountResponse>>("/api/auth/me"))!.Data!;
        var key = error == "signature" ? "INCORRECT-TEST-SIGNING-KEY-LONG-ENOUGH-2026" : IdentityApiFixture.JwtSecret;
        var token = new JwtSecurityToken(error == "issuer" ? "wrong" : "EXETeamMatching",
            error == "audience" ? "wrong" : "EXETeamMatchingClients",
            new[] { new Claim("sub", account.Id.ToString()), new Claim("role", "Admin"), new Claim("ver", "0") },
            DateTime.UtcNow.AddHours(-2), error == "expiry" ? DateTime.UtcNow.AddHours(-1) : DateTime.UtcNow.AddHours(1),
            new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), SecurityAlgorithms.HmacSha256));
        using var client = fixture.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", new JwtSecurityTokenHandler().WriteToken(token));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Student_CRUD_RBAC_profile_password_and_outbox_are_persisted()
    {
        var semester = await Semester();
        var student = await Student(semester);
        var other = await Student(semester);
        using var client = fixture.CreateClient();
        await IdentityApiFixture.SignIn(client, student.Email, IdentityApiFixture.Password);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/students/" + student.Id)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/students/" + other.Id)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/students")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.DeleteAsync("/api/students/" + student.Id)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/semesters",
            new CreateSemesterRequest("NO", "NO", Utc(1), Utc(6)))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync("/api/auth/me", new UpdateAccountRequest("New name"))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await fixture.Admin.PutAsJsonAsync("/api/students/" + student.Id, new UpdateStudentRequest("Updated", "AI"))).StatusCode);
        var strengths = await fixture.Admin.PutAsJsonAsync("/api/students/" + student.Id + "/strength-roles",
            new UpdateStudentStrengthRolesRequest(["Frontend", "DataAI"]));
        Assert.Equal(HttpStatusCode.OK, strengths.StatusCode);
        Assert.Equal(["DataAI", "Frontend"], (await strengths.Content.ReadFromJsonAsync<ApiResponse<StudentResponse>>())!.Data!.StrengthRoles);
        var page = (await fixture.Admin.GetFromJsonAsync<ApiResponse<PageResult<StudentResponse>>>(
            "/api/students?search=" + student.StudentCode + "&semesterCode=" + semester.Code + "&hasGroup=false&sortBy=name&descending=true&pageSize=1"))!.Data!;
        Assert.Equal(1, page.TotalCount);
        Assert.Equal("Updated", Assert.Single(page.Items).FullName);
        Assert.Equal(HttpStatusCode.Conflict, (await fixture.Admin.DeleteAsync("/api/semesters/" + semester.Id)).StatusCode);
        using (var scope = fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<IdentitySemesterDbContext>();
            Assert.True(await db.StudentEventOutbox.AnyAsync(e => e.Payload.Contains(student.StudentCode) && e.PublishedAt == null));
            var user = await db.Users.SingleAsync(u => u.Id == student.UserId);
            Assert.NotEqual(IdentityApiFixture.Password, user.PasswordHash);
        }
        const string newPassword = "Changed-test-password-2026!";
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsJsonAsync("/api/auth/password", new ChangePasswordRequest(IdentityApiFixture.Password, newPassword))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        await IdentityApiFixture.SignIn(client, student.Email, newPassword);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await fixture.Admin.DeleteAsync("/api/students/" + student.Id)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await fixture.Admin.GetAsync("/api/students/" + student.Id)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await fixture.Admin.DeleteAsync("/api/students/" + other.Id)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await fixture.Admin.DeleteAsync("/api/semesters/" + semester.Id)).StatusCode);
    }

    [Fact]
    public async Task Import_is_atomic_rejects_duplicates_and_supports_next_semester()
    {
        var semester = await Semester();
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var rows = new List<StudentImportDto> { new("A" + suffix, "A", "a" + suffix + "@test.edu", "SE"), new("B" + suffix, "B", "b" + suffix + "@test.edu", "SE") };
        var bad = rows.Append(rows[0] with { StudentCode = rows[0].StudentCode.ToLower() }).ToList();
        var response = await fixture.Admin.PostAsJsonAsync("/api/students/import", new ImportStudentsRequest(semester.Code, bad, IdentityApiFixture.Password));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var empty = (await fixture.Admin.GetFromJsonAsync<ApiResponse<PageResult<StudentResponse>>>("/api/students?semesterCode=" + semester.Code))!.Data!;
        Assert.Equal(0, empty.TotalCount);
        response = await fixture.Admin.PostAsJsonAsync("/api/students/import", new ImportStudentsRequest(semester.Code, rows, IdentityApiFixture.Password));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2, (await response.Content.ReadFromJsonAsync<ApiResponse<ImportResult>>())!.Data!.ImportedCount);
        response = await fixture.Admin.PostAsJsonAsync("/api/students/import", new ImportStudentsRequest(semester.Code, rows, IdentityApiFixture.Password));
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var next = await Semester();
        Assert.Equal(HttpStatusCode.OK, (await fixture.Admin.PostAsJsonAsync("/api/students/import",
            new ImportStudentsRequest(next.Code, rows, "Different-initial-password!"))).StatusCode);
        using var client = fixture.CreateClient();
        await IdentityApiFixture.SignIn(client, rows[0].Email, IdentityApiFixture.Password);
    }

    [Fact]
    public async Task Semester_CRUD_filters_validation_and_uniqueness()
    {
        var semester = await Semester();
        Assert.Equal(HttpStatusCode.OK, (await fixture.Admin.GetAsync("/api/semesters/" + semester.Id)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await fixture.Admin.PostAsJsonAsync("/api/semesters",
            new CreateSemesterRequest(semester.Code.ToLower(), "Duplicate", Utc(1), Utc(6)))).StatusCode);
        var renamedCode = ("R" + Guid.NewGuid().ToString("N")[..10]).ToUpperInvariant();
        var rename = await fixture.Admin.PutAsJsonAsync("/api/semesters/" + semester.Id,
            new UpdateSemesterRequest(renamedCode, semester.Name, Utc(1), Utc(6), true, Utc(2), Utc(3), Utc(4)));
        Assert.Equal(HttpStatusCode.OK, rename.StatusCode);
        semester = (await rename.Content.ReadFromJsonAsync<ApiResponse<SemesterDto>>())!.Data!;
        Assert.Equal(renamedCode, semester.Code);
        using (var scope = fixture.Services.CreateScope())
            Assert.True(await scope.ServiceProvider.GetRequiredService<IdentitySemesterDbContext>().StudentEventOutbox
                .AnyAsync(item => item.Topic == "semester-code-changed" && item.Payload.Contains(renamedCode)));
        Assert.Equal(HttpStatusCode.BadRequest, (await fixture.Admin.PutAsJsonAsync("/api/semesters/" + semester.Id,
            new UpdateSemesterRequest(semester.Code, "Invalid", Utc(6), Utc(1), true))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await fixture.Admin.PutAsJsonAsync("/api/semesters/" + semester.Id,
            new UpdateSemesterRequest(semester.Code, "Archived", Utc(1), Utc(6), false, Utc(2), Utc(3), Utc(4)))).StatusCode);
        var list = (await fixture.Admin.GetFromJsonAsync<ApiResponse<PageResult<SemesterDto>>>(
            "/api/semesters?search=" + semester.Code + "&isActive=false&sortBy=startDate&pageSize=1"))!.Data!;
        Assert.Equal("Archived", Assert.Single(list.Items).Name);
        Assert.Equal(HttpStatusCode.Conflict, (await fixture.Admin.PostAsJsonAsync("/api/students",
            new CreateStudentRequest(semester.Code, new("X", "X", "x@test.edu", "SE"), IdentityApiFixture.Password))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await fixture.Admin.DeleteAsync("/api/semesters/" + semester.Id)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await fixture.Admin.GetAsync("/api/semesters/" + semester.Id)).StatusCode);
    }

    [Theory]
    [InlineData("/api/students?page=0")]
    [InlineData("/api/students?pageSize=2001")]
    [InlineData("/api/students?sortBy=unknown")]
    [InlineData("/api/semesters?sortBy=unknown")]
    [InlineData("/api/students?page=2147483647&pageSize=2000")]
    public async Task Invalid_queries_return_400(string path)
        => Assert.Equal(HttpStatusCode.BadRequest, (await fixture.Admin.GetAsync(path)).StatusCode);

    [Fact]
    public void Milestones_reject_partial_reversed_outside_bounds_and_non_UTC()
    {
        Assert.Throws<IdentityException>(() => IdentityService.ValidateDates(Utc(1), Utc(6), Utc(2), null, null));
        Assert.Throws<IdentityException>(() => IdentityService.ValidateDates(Utc(1), Utc(6), Utc(3), Utc(2), Utc(4)));
        Assert.Throws<IdentityException>(() => IdentityService.ValidateDates(Utc(1), Utc(6), Utc(2), Utc(3), Utc(7)));
        Assert.Throws<IdentityException>(() => IdentityService.ValidateDates(DateTime.SpecifyKind(Utc(1), DateTimeKind.Unspecified), Utc(6)));
    }

    [Fact]
    public async Task Missing_required_import_field_rolls_back_entire_batch()
    {
        var semester = await Semester();
        var rows = new List<StudentImportDto> { new("VALID", "Valid", "valid@test.edu", "SE"), new("INVALID", "", "invalid-email", "SE") };
        Assert.Equal(HttpStatusCode.BadRequest, (await fixture.Admin.PostAsJsonAsync("/api/students/import",
            new ImportStudentsRequest(semester.Code, rows, IdentityApiFixture.Password))).StatusCode);
        var page = (await fixture.Admin.GetFromJsonAsync<ApiResponse<PageResult<StudentResponse>>>("/api/students?semesterCode=" + semester.Code))!.Data!;
        Assert.Equal(0, page.TotalCount);
    }

    [Fact]
    public async Task Cannot_delete_student_in_group_or_mass_assign_group_and_role()
    {
        var semester = await Semester();
        var student = await Student(semester);
        var response = await fixture.Admin.PutAsJsonAsync("/api/students/" + student.Id,
            new { fullName = "Updated", major = "SE", hasGroup = true, roleId = "11111111-1111-1111-1111-111111111111" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IdentitySemesterDbContext>();
        var row = await db.Students.Include(s => s.User).ThenInclude(u => u.Role).SingleAsync(s => s.Id == student.Id);
        Assert.False(row.HasGroup);
        Assert.Equal("Student", row.User.Role.Name);
        row.HasGroup = true;
        await db.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.Conflict, (await fixture.Admin.DeleteAsync("/api/students/" + student.Id)).StatusCode);
    }

    [Fact]
    public async Task Schema_upgrade_is_repeatable_and_preserves_existing_students()
    {
        var semester = await Semester();
        var student = await Student(semester);
        using var scope = fixture.Services.CreateScope();
        var initializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
        await initializer.Initialize();
        await initializer.Initialize();
        var response = await fixture.Admin.GetFromJsonAsync<ApiResponse<StudentResponse>>("/api/students/" + student.Id);
        Assert.Equal(student.StudentCode, response!.Data!.StudentCode);
    }

    [Fact]
    public async Task Concurrent_duplicate_creation_has_one_winner()
    {
        var semester = await Semester();
        var request = new CreateStudentRequest(semester.Code, new("RACE", "Race", "race@test.edu", "SE"), IdentityApiFixture.Password);
        var responses = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => fixture.Admin.PostAsJsonAsync("/api/students", request)));
        Assert.Single(responses.Where(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Single(responses.Where(r => r.StatusCode == HttpStatusCode.Conflict));
    }
}
