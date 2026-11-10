using System.ComponentModel.DataAnnotations;

namespace EXETeamMatching.IdentitySemester.Application.DTOs;

public record LoginRequest([Required, EmailAddress] string Email, [Required, StringLength(128)] string Password);
public record GoogleLoginRequest([Required, MinLength(5)] string Credential);
public record GoogleAllowedEmailResponse(Guid Id, string Email, DateTime CreatedAt);
public record GoogleEmailImportResult(int ImportedCount, int ExistingCount);
public record LoginResponse(string Token, string? RefreshToken, DateTime Expiration, StudentResponse? Student);
public record AccountResponse(Guid Id, string Username, string Email, string Role, string? AvatarUrl = null);
public record ActivateMentorRequest([Required, EmailAddress, StringLength(254)] string Email);
public record UpdateAccountRequest([Required, StringLength(100)] string Username);
public record ChangePasswordRequest([Required] string CurrentPassword, [Required, StringLength(128, MinimumLength = 12)] string NewPassword);
public record StudentResponse(Guid Id, Guid UserId, string StudentCode, string FullName, string Email, string Major, string SemesterCode, bool HasGroup,
    IReadOnlyList<string>? StrengthRoles = null, string? AvatarUrl = null);
public record StudentImportDto(
    [Required, StringLength(30)] string StudentCode,
    [Required, StringLength(200)] string FullName,
    [Required, StringLength(254)] string Email,
    [Required, StringLength(100)] string Major,
    [StringLength(30)] string? SemesterCode = null);
public record ImportStudentsRequest([Required] string SemesterCode, [Required, MinLength(1), MaxLength(2000)] List<StudentImportDto> Students,
    [Required, StringLength(128, MinimumLength = 6)] string InitialPassword);
public record CreateStudentRequest([Required] string SemesterCode, [Required] StudentImportDto Student,
    [Required, StringLength(128, MinimumLength = 6)] string InitialPassword);
public record UpdateStudentRequest([Required, StringLength(200)] string FullName, [Required, StringLength(100)] string Major);
public record UpdateStudentStrengthRolesRequest([Required, MinLength(1), MaxLength(6)] List<string> RoleCodes);
public record ImportResult(int ImportedCount);
public record SemesterDto(Guid Id, string Code, string Name, DateTime StartDate, DateTime EndDate, bool IsActive,
    DateTime? RegistrationDeadline = null, DateTime? TopicDeadline = null, DateTime? MentorDeadline = null);
public record CreateSemesterRequest([Required, StringLength(30)] string Code, [Required, StringLength(100)] string Name,
    DateTime StartDate, DateTime EndDate, DateTime? RegistrationDeadline = null, DateTime? TopicDeadline = null, DateTime? MentorDeadline = null);
public record UpdateSemesterRequest([Required, StringLength(30)] string Code, [Required, StringLength(100)] string Name, DateTime StartDate, DateTime EndDate,
    bool IsActive, DateTime? RegistrationDeadline = null, DateTime? TopicDeadline = null, DateTime? MentorDeadline = null);
public class ListQuery
{
    [Range(1, int.MaxValue)] public int Page { get; set; } = 1;
    [Range(1, 2000)] public int PageSize { get; set; } = 20;
    [StringLength(200)] public string? Search { get; set; }
    public string? SemesterCode { get; set; }
    public bool? HasGroup { get; set; }
    public bool? IsActive { get; set; }
    public string SortBy { get; set; } = "code";
    public bool Descending { get; set; }
}
public record PageResult<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize);
public record GroupEnrollmentResponse(Guid StudentId, Guid UserId, string StudentCode, string FullName, string SemesterCode, bool HasGroup,
    string Email = "", string Major = "", IReadOnlyList<string>? StrengthRoles = null, string? AvatarUrl = null);
public record SemesterWorkflowResponse(string SemesterCode, bool IsActive, DateTime StartDate, DateTime EndDate,
    DateTime? RegistrationDeadline, DateTime? TopicDeadline, DateTime? MentorDeadline);
