using EXETeamMatching.IdentitySemester.Application.DTOs;
using EXETeamMatching.IdentitySemester.Domain.Entities;

namespace EXETeamMatching.IdentitySemester.Application.Interfaces;

public interface IIdentityStore
{
    Task<User?> UserByEmail(string email, CancellationToken ct);
    Task<User?> UserByGoogleSubject(string subject, CancellationToken ct);
    Task<User?> UserById(Guid id, CancellationToken ct);
    Task<Student?> StudentById(Guid id, CancellationToken ct);
    Task<Student?> StudentByUser(Guid id, CancellationToken ct);
    Task<Semester?> SemesterById(Guid id, CancellationToken ct);
    Task<Semester?> SemesterByCode(string code, CancellationToken ct);
    Task<PageResult<StudentResponse>> Students(ListQuery query, CancellationToken ct);
    Task<PageResult<SemesterDto>> Semesters(ListQuery query, CancellationToken ct);
    Task<bool> StudentExists(string code, Guid semesterId, CancellationToken ct);
    Task<bool> EnrollmentExists(Guid userId, Guid semesterId, CancellationToken ct);
    Task<bool> SemesterHasStudents(Guid id, CancellationToken ct);
    Task<Role> RoleByName(string name, CancellationToken ct);
    Task<bool> GoogleEmailAllowed(string email, CancellationToken ct);
    Task<IReadOnlyList<GoogleAllowedEmail>> GoogleAllowedEmails(CancellationToken ct);
    void AddStudent(Student student);
    void AddUser(User user);
    void RemoveStudent(Student student);
    void AddSemester(Semester semester);
    void RemoveSemester(Semester semester);
    void AddGoogleAllowedEmail(GoogleAllowedEmail email);
    void RemoveGoogleAllowedEmail(GoogleAllowedEmail email);
    Task Save(CancellationToken ct);
}
public interface IPasswordService
{
    string Hash(User user, string password);
    bool Verify(User user, string password);
}
public interface ITokenIssuer
{
    (string Token, DateTime Expiration) Issue(User user);
}
public record GoogleIdentity(string Subject, string Email, bool EmailVerified, string? HostedDomain, string? DisplayName);
public interface IGoogleIdTokenValidator
{
    Task<GoogleIdentity> ValidateAsync(string credential, CancellationToken ct);
    bool IsAllowedEmail(string email);
}
public interface IStudentImportReader
{
    List<StudentImportDto> Read(Stream stream);
}
public interface IGoogleEmailImportReader
{
    List<string> Read(Stream stream);
}
public sealed class IdentityException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}
