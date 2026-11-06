using System.ComponentModel.DataAnnotations;
using EXETeamMatching.IdentitySemester.Application.DTOs;
using EXETeamMatching.IdentitySemester.Application.Interfaces;
using EXETeamMatching.IdentitySemester.Domain.Entities;
using EXETeamMatching.Contracts.Events;
using EXETeamMatching.Contracts.TeamRoles;

namespace EXETeamMatching.IdentitySemester.Application.Services;

public class IdentityService(IIdentityStore store, IPasswordService passwords, ITokenIssuer tokens, IGoogleIdTokenValidator googleTokens) : IAuthenticationService
{
    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var user = await store.UserByEmail(request.Email.Trim().ToLowerInvariant(), cancellationToken);
        if (user is null || !passwords.Verify(user, request.Password))
            throw new IdentityException(401, "Invalid email or password.");
        return await IssueLoginAsync(user, cancellationToken);
    }

    public async Task<LoginResponse> GoogleLoginAsync(GoogleLoginRequest request, CancellationToken ct)
    {
        var identity = await googleTokens.ValidateAsync(request.Credential, ct);
        var email = Required(identity.Email).ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(identity.Subject) || !identity.EmailVerified ||
            (!googleTokens.IsAllowedEmail(email) && !await store.GoogleEmailAllowed(email, ct)))
            throw new IdentityException(403, "This Google account is not allowed to access the system.");

        var user = await store.UserByGoogleSubject(identity.Subject, ct);
        if (user is not null)
        {
            if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
            {
                var emailOwner = await store.UserByEmail(email, ct);
                if (emailOwner is not null && emailOwner.Id != user.Id)
                    throw new IdentityException(409, "Google email is already linked to a different account.");
                user.Email = email;
                user.UpdatedAt = DateTime.UtcNow;
                await store.Save(ct);
            }
            return await IssueLoginAsync(user, ct);
        }

        user = await store.UserByEmail(email, ct);
        if (user is null)
        {
            var studentRole = await store.RoleByName("Student", ct);
            user = new User
            {
                Email = email,
                Username = string.IsNullOrWhiteSpace(identity.DisplayName) ? email : identity.DisplayName.Trim(),
                RoleId = studentRole.Id,
                Role = studentRole,
                GoogleSubject = identity.Subject
            };
            store.AddUser(user);
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(user.GoogleSubject) && user.GoogleSubject != identity.Subject)
                throw new IdentityException(409, "This email is already linked to another Google account.");
            user.GoogleSubject = identity.Subject;
            user.UpdatedAt = DateTime.UtcNow;
        }

        await store.Save(ct);
        return await IssueLoginAsync(user, ct);
    }

    public async Task<AccountResponse> Account(Guid id, CancellationToken ct)
    {
        var user = await store.UserById(id, ct) ?? throw new IdentityException(401, "Account unavailable.");
        return new(user.Id, user.Username, user.Email, user.Role.Name);
    }

    public async Task<AccountResponse> UpdateAccount(Guid id, UpdateAccountRequest request, CancellationToken ct)
    {
        var user = await store.UserById(id, ct) ?? throw new IdentityException(401, "Account unavailable.");
        user.Username = Required(request.Username);
        user.UpdatedAt = DateTime.UtcNow;
        await store.Save(ct);
        return new(user.Id, user.Username, user.Email, user.Role.Name);
    }

    public async Task ChangePassword(Guid id, ChangePasswordRequest request, CancellationToken ct)
    {
        var user = await store.UserById(id, ct) ?? throw new IdentityException(401, "Account unavailable.");
        if (!passwords.Verify(user, request.CurrentPassword)) throw new IdentityException(400, "Current password is incorrect.");
        ValidatePassword(request.NewPassword);
        user.PasswordHash = passwords.Hash(user, request.NewPassword);
        user.TokenVersion++;
        user.UpdatedAt = DateTime.UtcNow;
        await store.Save(ct);
    }
    public async Task<IReadOnlyList<GoogleAllowedEmailResponse>> GoogleAccessList(CancellationToken ct)
        => (await store.GoogleAllowedEmails(ct)).Select(x => new GoogleAllowedEmailResponse(x.Id, x.Email, x.CreatedAt)).ToList();
    public async Task<GoogleEmailImportResult> ImportGoogleAccess(IEnumerable<string> rawEmails, CancellationToken ct)
    {
        var emails = rawEmails.Select(Required).Select(x => x.ToLowerInvariant()).ToHashSet(StringComparer.OrdinalIgnoreCase);
        // A department roster can cover several classes; keep this independent
        // from the roster enrollment batch limit.
        if (emails.Count is < 1 or > 2000) throw new IdentityException(400, "Import requires 1 to 2000 unique email addresses.");
        // The department roster is the authority for this import. Preserve every
        // non-empty value under its Email/Gmail column; Google authentication still
        // accepts only the verified email claim from a valid Google ID token.
        var existing = (await store.GoogleAllowedEmails(ct)).Select(x => x.Email).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var email in emails.Where(email => !existing.Contains(email)))
            store.AddGoogleAllowedEmail(new GoogleAllowedEmail { Email = email });
        await store.Save(ct);
        return new GoogleEmailImportResult(emails.Count - emails.Count(existing.Contains), emails.Count(existing.Contains));
    }
    public async Task RemoveGoogleAccess(Guid id, CancellationToken ct)
    {
        var item = (await store.GoogleAllowedEmails(ct)).SingleOrDefault(x => x.Id == id) ?? throw new IdentityException(404, "Allowed email not found.");
        store.RemoveGoogleAllowedEmail(item); await store.Save(ct);
    }

    public Task<PageResult<StudentResponse>> Students(ListQuery query, CancellationToken ct) => store.Students(query, ct);
    public async Task<StudentResponse> Student(Guid id, Guid actor, bool isAdmin, CancellationToken ct)
    {
        var student = await store.StudentById(id, ct) ?? throw new IdentityException(404, "Student not found.");
        if (!isAdmin && student.UserId != actor) throw new IdentityException(403, "You can only access your own profile.");
        return Map(student);
    }
    public async Task<GroupEnrollmentResponse> CurrentEnrollment(Guid actor, string semesterCode, CancellationToken ct)
    {
        var code = Required(semesterCode).ToUpperInvariant();
        var student = await store.StudentByUserSemester(actor, code, ct) ?? throw new IdentityException(404, "No enrollment found for this semester.");
        return new(student.Id, student.UserId, student.StudentCode, student.FullName, student.Semester.Code, student.HasGroup);
    }
    public async Task<SemesterWorkflowResponse> Workflow(string semesterCode, CancellationToken ct)
    {
        var semester = await store.SemesterByCode(Required(semesterCode).ToUpperInvariant(), ct) ?? throw new IdentityException(404, "Semester not found.");
        return new(semester.Code, semester.IsActive, semester.StartDate, semester.EndDate, semester.RegistrationDeadline, semester.TopicDeadline, semester.MentorDeadline);
    }
    public async Task<StudentResponse> CreateStudent(CreateStudentRequest request, CancellationToken ct)
    {
        ValidatePassword(request.InitialPassword);
        var semester = await FindSemester(request.SemesterCode, ct);
        var student = await BuildStudent(request.Student, semester, request.InitialPassword, ct);
        store.AddStudent(student);
        await AddRosterEmailsToGoogleAccess([student.User.Email], ct);
        await store.Save(ct);
        return Map(student);
    }
    public async Task<ImportResult> Import(ImportStudentsRequest request, string initialPassword, CancellationToken ct)
    {
        ValidatePassword(initialPassword);
        if (request.Students is null || request.Students.Count is < 1 or > 2000)
            throw new IdentityException(400, "Import requires 1 to 2000 students.");
        var semester = await FindSemester(request.SemesterCode, ct);
        var codes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var emails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var students = new List<Student>();
        foreach (var row in request.Students)
        {
            if (row is null || !codes.Add(Required(row.StudentCode)) || !emails.Add(Required(row.Email)))
                throw new IdentityException(400, "Duplicate student code or email in import.");
            if (!string.IsNullOrWhiteSpace(row.SemesterCode) && !row.SemesterCode.Trim().Equals(semester.Code, StringComparison.OrdinalIgnoreCase))
                throw new IdentityException(400, "Every Excel SemesterCode must match the selected semester.");
            students.Add(await BuildStudent(row, semester, initialPassword, ct));
        }
        // Validate the entire file before tracking inserts. SaveChanges is atomic.
        foreach (var student in students) store.AddStudent(student);
        // A roster entry is also the source of truth for Google access. Keep this
        // in the same unit of work so a partially imported roster never grants access.
        await AddRosterEmailsToGoogleAccess(students.Select(x => x.User.Email), ct);
        await store.Save(ct);
        return new(students.Count);
    }
    public async Task<StudentResponse> UpdateStudent(Guid id, UpdateStudentRequest request, CancellationToken ct)
    {
        var student = await store.StudentById(id, ct) ?? throw new IdentityException(404, "Student not found.");
        student.FullName = Required(request.FullName);
        student.Major = Required(request.Major);
        student.UpdatedAt = DateTime.UtcNow;
        await store.Save(ct);
        return Map(student);
    }
    public async Task<StudentResponse> UpdateStudentStrengthRoles(Guid id, UpdateStudentStrengthRolesRequest request,
        Guid actor, bool isAdmin, CancellationToken ct)
    {
        var student = await store.StudentById(id, ct) ?? throw new IdentityException(404, "Student not found.");
        if (!isAdmin && student.UserId != actor) throw new IdentityException(403, "You can only update your own strengths.");
        var normalized = NormalizeStrengthRoles(request.RoleCodes);
        var existing = await store.StudentStrengthRoles(id, ct);
        foreach (var role in existing) store.RemoveStudentStrengthRole(role);
        foreach (var role in normalized) store.AddStudentStrengthRole(new StudentStrengthRole { StudentId = id, RoleCode = role });
        student.UpdatedAt = DateTime.UtcNow;
        await store.Save(ct);
        student.StrengthRoles = normalized.Select(role => new StudentStrengthRole { StudentId = id, RoleCode = role }).ToList();
        return Map(student);
    }
    public async Task DeleteStudent(Guid id, CancellationToken ct)
    {
        var student = await store.StudentById(id, ct) ?? throw new IdentityException(404, "Student not found.");
        if (student.HasGroup) throw new IdentityException(409, "Remove group membership through GroupMatching before deleting this student.");
        store.RemoveStudent(student);
        await store.Save(ct);
    }
    public Task<PageResult<SemesterDto>> Semesters(ListQuery query, CancellationToken ct) => store.Semesters(query, ct);
    public async Task<SemesterDto> Semester(Guid id, CancellationToken ct) => Map(await store.SemesterById(id, ct) ?? throw new IdentityException(404, "Semester not found."));
    public async Task<SemesterDto> CreateSemester(CreateSemesterRequest request, CancellationToken ct)
    {
        ValidateDates(request.StartDate, request.EndDate, request.RegistrationDeadline, request.TopicDeadline, request.MentorDeadline);
        var code = Required(request.Code).ToUpperInvariant();
        if (await store.SemesterByCode(code, ct) is not null) throw new IdentityException(409, "Semester code already exists.");
        var semester = new Semester { Code = code, Name = Required(request.Name), StartDate = request.StartDate, EndDate = request.EndDate,
            RegistrationDeadline = request.RegistrationDeadline, TopicDeadline = request.TopicDeadline, MentorDeadline = request.MentorDeadline };
        store.AddSemester(semester);
        await store.Save(ct);
        return Map(semester);
    }
    public async Task<SemesterDto> UpdateSemester(Guid id, UpdateSemesterRequest request, CancellationToken ct)
    {
        ValidateDates(request.StartDate, request.EndDate, request.RegistrationDeadline, request.TopicDeadline, request.MentorDeadline);
        var semester = await store.SemesterById(id, ct) ?? throw new IdentityException(404, "Semester not found.");
        var oldCode = semester.Code;
        var newCode = Required(request.Code).ToUpperInvariant();
        var sameCode = oldCode.Equals(newCode, StringComparison.OrdinalIgnoreCase);
        var existing = await store.SemesterByCode(newCode, ct);
        if (!sameCode && existing is not null && existing.Id != id)
            throw new IdentityException(409, "Semester code already exists.");
        semester.Code = newCode;
        semester.Name = Required(request.Name); semester.StartDate = request.StartDate; semester.EndDate = request.EndDate;
        semester.IsActive = request.IsActive; semester.RegistrationDeadline = request.RegistrationDeadline;
        semester.TopicDeadline = request.TopicDeadline; semester.MentorDeadline = request.MentorDeadline;
        semester.UpdatedAt = DateTime.UtcNow;
        if (!sameCode)
            store.AddOutboxEvent("semester-code-changed", new SemesterCodeChangedEvent(semester.Id, oldCode, newCode, DateTime.UtcNow));
        await store.Save(ct);
        return Map(semester);
    }
    public async Task DeleteSemester(Guid id, CancellationToken ct)
    {
        var semester = await store.SemesterById(id, ct) ?? throw new IdentityException(404, "Semester not found.");
        if (await store.SemesterHasStudents(id, ct)) throw new IdentityException(409, "Semester contains students; deactivate it instead.");
        store.RemoveSemester(semester); await store.Save(ct);
    }
    public static void ValidateDates(DateTime start, DateTime end, params DateTime?[] deadlines)
    {
        if (start.Kind != DateTimeKind.Utc || end.Kind != DateTimeKind.Utc || start >= end)
            throw new IdentityException(400, "Use UTC dates with StartDate before EndDate.");
        if (deadlines.Any(x => x.HasValue) && deadlines.Any(x => !x.HasValue))
            throw new IdentityException(400, "Provide all three milestones together, or leave all unset.");
        var previous = start;
        foreach (var deadline in deadlines.Where(x => x.HasValue).Select(x => x!.Value))
        {
            if (deadline.Kind != DateTimeKind.Utc || deadline <= previous || deadline > end)
                throw new IdentityException(400, "Milestones must be UTC and ordered: start < registration < topic < mentor <= end.");
            previous = deadline;
        }
    }
    public static void ValidatePassword(string password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length is < 6 or > 128)
            throw new IdentityException(400, "Password must contain 6 to 128 characters.");
    }
    private async Task<Semester> FindSemester(string code, CancellationToken ct)
    {
        var semester = await store.SemesterByCode(Required(code).ToUpperInvariant(), ct) ?? throw new IdentityException(404, "Semester not found.");
        if (!semester.IsActive) throw new IdentityException(409, "Semester is inactive.");
        return semester;
    }
    private async Task<Student> BuildStudent(StudentImportDto row, Semester semester, string password, CancellationToken ct)
    {
        var results = new List<ValidationResult>();
        if (!Validator.TryValidateObject(row, new ValidationContext(row), results, true))
            throw new IdentityException(400, string.Join(" ", results.Select(x => x.ErrorMessage)));
        var code = Required(row.StudentCode).ToUpperInvariant();
        var email = Required(row.Email).ToLowerInvariant();
        if (await store.StudentExists(code, semester.Id, ct)) throw new IdentityException(409, "Student code already exists in this semester.");
        var user = await store.UserByEmail(email, ct);
        if (user is not null)
        {
            var existing = await store.StudentByUser(user.Id, ct);
            // An administrator can also be enrolled in a semester (for example,
            // a student account explicitly elevated to Admin). Preserve its Admin
            // role while linking the roster enrollment.
            if (user.Role.Name is not ("Student" or "Admin") || (existing is not null && !existing.StudentCode.Equals(code, StringComparison.OrdinalIgnoreCase)))
                throw new IdentityException(409, "Email belongs to a different account or student code.");
            if (await store.EnrollmentExists(user.Id, semester.Id, ct))
                throw new IdentityException(409, "Account is already enrolled in this semester.");
        }
        else
        {
            var role = await store.RoleByName("Student", ct);
            user = new User { Email = email, Username = code, RoleId = role.Id, Role = role };
            user.PasswordHash = passwords.Hash(user, password);
        }
        return new Student { User = user, UserId = user.Id, StudentCode = code, FullName = Required(row.FullName), Major = Required(row.Major), SemesterId = semester.Id, Semester = semester };
    }
    private async Task AddRosterEmailsToGoogleAccess(IEnumerable<string> rosterEmails, CancellationToken ct)
    {
        var existing = (await store.GoogleAllowedEmails(ct))
            .Select(x => x.Email)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var email in rosterEmails.Select(x => x.Trim().ToLowerInvariant()).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (!existing.Add(email)) continue;
            store.AddGoogleAllowedEmail(new GoogleAllowedEmail { Email = email });
        }
    }
    private async Task<LoginResponse> IssueLoginAsync(User user, CancellationToken ct)
    {
        var token = tokens.Issue(user);
        var student = await store.StudentByUser(user.Id, ct);
        return new(token.Token, null, token.Expiration, student is null ? null : Map(student));
    }
    private static string Required(string value) => string.IsNullOrWhiteSpace(value) ? throw new IdentityException(400, "Required value cannot be blank.") : value.Trim();
    private static List<string> NormalizeStrengthRoles(IEnumerable<string>? roles)
    {
        var normalized = (roles ?? []).Where(x => !string.IsNullOrWhiteSpace(x)).Select(x => x.Trim()).ToList();
        if (normalized.Count is < 1 or > 6 || normalized.Any(x => !TeamRoleCatalog.IsValid(x)))
            throw new IdentityException(400, "Choose between 1 and 6 supported strength roles.");
        var result = normalized.Select(TeamRoleCatalog.Normalize).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        if (result.Count != normalized.Count) throw new IdentityException(400, "Strength roles must not contain duplicates.");
        return result;
    }
    public static StudentResponse Map(Student s) => new(s.Id, s.UserId, s.StudentCode, s.FullName, s.User.Email, s.Major, s.Semester.Code, s.HasGroup,
        s.StrengthRoles.OrderBy(x => x.RoleCode).Select(x => x.RoleCode).ToList());
    public static SemesterDto Map(Semester s) => new(s.Id, s.Code, s.Name, s.StartDate, s.EndDate, s.IsActive, s.RegistrationDeadline, s.TopicDeadline, s.MentorDeadline);
}
