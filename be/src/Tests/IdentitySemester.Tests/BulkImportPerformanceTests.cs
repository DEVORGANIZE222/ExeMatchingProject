using EXETeamMatching.IdentitySemester.Application.DTOs;
using EXETeamMatching.IdentitySemester.Application.Interfaces;
using EXETeamMatching.IdentitySemester.Application.Services;
using EXETeamMatching.IdentitySemester.Domain.Entities;
using Xunit;

namespace EXETeamMatching.IdentitySemester.Tests;

public class BulkImportPerformanceTests
{
    [Fact]
    public async Task Import_1200_New_Students_Hashes_Initial_Password_Once_And_Batches_Inserts()
    {
        var semester = new Semester
        {
            Id = Guid.NewGuid(),
            Code = "FALL",
            Name = "Fall2026",
            StartDate = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc),
            EndDate = new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc),
            IsActive = true
        };
        var store = new FakeImportStore(semester);
        var passwords = new CountingPasswordService();
        var service = new IdentityService(store, passwords, new DummyTokenIssuer(), new DummyGoogleValidator());

        var rows = Enumerable.Range(1, 1200)
            .Select(i => new StudentImportDto($"SE{180000 + i}", $"Sinh Vien {i}", $"sv{i}@fpt.edu.vn", "SE", "FALL"))
            .ToList();

        var result = await service.Import(new ImportStudentsRequest("FALL", rows, "Student@12345678"), "Student@12345678", CancellationToken.None);

        Assert.Equal(1200, result.ImportedCount);
        Assert.Equal(1, passwords.HashCalls);
        Assert.Equal(1200, store.AddedStudents.Count);
        Assert.Equal(1200, store.AddedGoogleEmails.Count);
        Assert.Equal(1, store.SaveCalls);
        Assert.All(store.AddedStudents, s => Assert.Equal("HASHED:Student@12345678", s.User.PasswordHash));
    }

    [Fact]
    public async Task Import_Reenrolls_Existing_User_And_Rejects_Mismatched_Student_Code()
    {
        var semester = new Semester
        {
            Id = Guid.NewGuid(),
            Code = "SP27",
            Name = "Spring 2027",
            StartDate = new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            EndDate = new DateTime(2027, 4, 30, 0, 0, 0, DateTimeKind.Utc),
            IsActive = true
        };
        var store = new FakeImportStore(semester);
        var existingUser = new User
        {
            Id = Guid.NewGuid(),
            Email = "old@fpt.edu.vn",
            Username = "SE170001",
            PasswordHash = "ORIGINAL_HASH",
            RoleId = store.StudentRole.Id,
            Role = store.StudentRole
        };
        store.ExistingUsers["old@fpt.edu.vn"] = existingUser;
        store.ExistingEnrollments.Add(new UserEnrollmentSummary(existingUser.Id, Guid.NewGuid(), "SE170001"));

        var passwords = new CountingPasswordService();
        var service = new IdentityService(store, passwords, new DummyTokenIssuer(), new DummyGoogleValidator());

        var mismatch = await Assert.ThrowsAsync<IdentityException>(() => service.Import(
            new ImportStudentsRequest("SP27", [new("SE999999", "Wrong Code", "old@fpt.edu.vn", "SE")], "Student@12345678"),
            "Student@12345678",
            CancellationToken.None));
        Assert.Equal(409, mismatch.StatusCode);

        var ok = await service.Import(
            new ImportStudentsRequest("SP27", [new("SE170001", "Valid Return", "old@fpt.edu.vn", "SE")], "Student@12345678"),
            "Student@12345678",
            CancellationToken.None);
        Assert.Equal(1, ok.ImportedCount);
        Assert.Equal(0, passwords.HashCalls);
        Assert.Equal("ORIGINAL_HASH", store.AddedStudents.Single().User.PasswordHash);
    }

    private sealed class CountingPasswordService : IPasswordService
    {
        public int HashCalls { get; private set; }
        public string Hash(User user, string password)
        {
            HashCalls++;
            return "HASHED:" + password;
        }
        public bool Verify(User user, string password) => user.PasswordHash == "HASHED:" + password;
    }

    private sealed class DummyTokenIssuer : ITokenIssuer
    {
        public (string Token, DateTime Expiration) Issue(User user) => ("token", DateTime.UtcNow.AddHours(1));
    }

    private sealed class DummyGoogleValidator : IGoogleIdTokenValidator
    {
        public Task<GoogleIdentity> ValidateAsync(string credential, CancellationToken ct) => throw new NotSupportedException();
        public bool IsAllowedEmail(string email) => false;
    }

    private sealed class FakeImportStore(Semester semester) : IIdentityStore
    {
        public Role StudentRole { get; } = new() { Id = Guid.NewGuid(), Name = "Student", Description = "Student" };
        public Dictionary<string, User> ExistingUsers { get; } = new(StringComparer.OrdinalIgnoreCase);
        public List<UserEnrollmentSummary> ExistingEnrollments { get; } = [];
        public List<Student> AddedStudents { get; } = [];
        public List<GoogleAllowedEmail> AddedGoogleEmails { get; } = [];
        public int SaveCalls { get; private set; }

        public Task<Semester?> SemesterByCode(string code, CancellationToken ct)
            => Task.FromResult<Semester?>(semester.Code.Equals(code, StringComparison.OrdinalIgnoreCase) ? semester : null);
        public Task<HashSet<string>> StudentCodesInSemester(Guid semesterId, CancellationToken ct)
            => Task.FromResult(new HashSet<string>(StringComparer.OrdinalIgnoreCase));
        public Task<Dictionary<string, User>> UsersByEmails(IEnumerable<string> lowerEmails, CancellationToken ct)
        {
            var set = lowerEmails.ToHashSet(StringComparer.OrdinalIgnoreCase);
            return Task.FromResult(ExistingUsers
                .Where(kv => set.Contains(kv.Key))
                .ToDictionary(kv => kv.Key, kv => kv.Value, StringComparer.OrdinalIgnoreCase));
        }
        public Task<IReadOnlyList<UserEnrollmentSummary>> UserEnrollmentsByUserIds(IEnumerable<Guid> userIds, CancellationToken ct)
        {
            var ids = userIds.ToHashSet();
            return Task.FromResult<IReadOnlyList<UserEnrollmentSummary>>(ExistingEnrollments.Where(e => ids.Contains(e.UserId)).ToList());
        }
        public Task<Role> RoleByName(string name, CancellationToken ct) => Task.FromResult(StudentRole);
        public Task<HashSet<string>> ExistingAllowedGoogleEmails(IEnumerable<string> lowerEmails, CancellationToken ct)
            => Task.FromResult(new HashSet<string>(StringComparer.OrdinalIgnoreCase));
        public void AddStudentsRange(IReadOnlyList<Student> students) => AddedStudents.AddRange(students);
        public void AddGoogleAllowedEmailsRange(IReadOnlyList<GoogleAllowedEmail> emails) => AddedGoogleEmails.AddRange(emails);
        public Task Save(CancellationToken ct) { SaveCalls++; return Task.CompletedTask; }

        public Task<User?> UserByEmail(string email, CancellationToken ct) => throw new NotSupportedException();
        public Task<User?> UserByGoogleSubject(string subject, CancellationToken ct) => throw new NotSupportedException();
        public Task<User?> UserById(Guid id, CancellationToken ct) => throw new NotSupportedException();
        public Task<Student?> StudentById(Guid id, CancellationToken ct) => throw new NotSupportedException();
        public Task<Student?> StudentByUser(Guid id, CancellationToken ct) => throw new NotSupportedException();
        public Task<Student?> StudentByUserSemester(Guid userId, string semesterCode, CancellationToken ct) => throw new NotSupportedException();
        public Task<Student?> StudentByIdentifierSemester(string semesterCode, string identifier, CancellationToken ct) => throw new NotSupportedException();
        public Task<IReadOnlyList<Student>> SearchStudentsBySemester(string semesterCode, string query, int limit, CancellationToken ct) => throw new NotSupportedException();
        public Task<Semester?> SemesterById(Guid id, CancellationToken ct) => throw new NotSupportedException();
        public Task<PageResult<StudentResponse>> Students(ListQuery query, CancellationToken ct) => throw new NotSupportedException();
        public Task<PageResult<SemesterDto>> Semesters(ListQuery query, CancellationToken ct) => throw new NotSupportedException();
        public Task<bool> StudentExists(string code, Guid semesterId, CancellationToken ct) => throw new NotSupportedException();
        public Task<bool> EnrollmentExists(Guid userId, Guid semesterId, CancellationToken ct) => throw new NotSupportedException();
        public Task<bool> SemesterHasStudents(Guid id, CancellationToken ct) => throw new NotSupportedException();
        public Task<IReadOnlyList<StudentStrengthRole>> StudentStrengthRoles(Guid studentId, CancellationToken ct) => throw new NotSupportedException();
        public Task<bool> GoogleEmailAllowed(string email, CancellationToken ct) => throw new NotSupportedException();
        public Task<IReadOnlyList<GoogleAllowedEmail>> GoogleAllowedEmails(CancellationToken ct) => throw new NotSupportedException();
        public Task<int> DeleteStudentsBySemester(Guid semesterId, CancellationToken ct) => throw new NotSupportedException();
        public Task DeleteStudentEnrollment(Guid studentId, CancellationToken ct) => throw new NotSupportedException();
        public void AddStudent(Student student, bool emitImportEvent = true) => throw new NotSupportedException();
        public void AddUser(User user) => throw new NotSupportedException();
        public void RemoveStudent(Student student) => throw new NotSupportedException();
        public void AddSemester(Semester semester) => throw new NotSupportedException();
        public void RemoveSemester(Semester semester) => throw new NotSupportedException();
        public void AddGoogleAllowedEmail(GoogleAllowedEmail email) => throw new NotSupportedException();
        public void RemoveGoogleAllowedEmail(GoogleAllowedEmail email) => throw new NotSupportedException();
        public void AddStudentStrengthRole(StudentStrengthRole role) => throw new NotSupportedException();
        public void RemoveStudentStrengthRole(StudentStrengthRole role) => throw new NotSupportedException();
        public void AddOutboxEvent(string topic, object payload) => throw new NotSupportedException();
    }
}

