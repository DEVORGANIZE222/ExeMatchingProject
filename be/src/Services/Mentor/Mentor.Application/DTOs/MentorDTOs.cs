using System.ComponentModel.DataAnnotations;
using EXETeamMatching.Mentor.Domain.Entities;

namespace EXETeamMatching.Mentor.Application.DTOs;

public record MentorResponse(
    Guid Id,
    Guid UserId,
    string FullName,
    string Email,
    string Department,
    string Expertise,
    string Phone,
    int MaxQuota,
    int CurrentAssigned
);

public record MentorRequestDto(
    Guid Id,
    Guid GroupId,
    Guid MentorId,
    string Message,
    RequestStatus Status,
    DateTime CreatedAt,
    string GroupName,
    string Topic,
    string RequesterName,
    string? DecisionReason,
    DateTime? DecidedAt
);

public record GroupMentorStatusResponse(
    bool HasActiveRequest,
    RequestStatus? Status,
    string? MentorName,
    string? Message,
    DateTime? CreatedAt
);

public record MentorDecisionDto(
    Guid RequestId,
    bool IsAccepted,
    [StringLength(2000)] string DecisionReason = ""
);

public record CreateMentorProfileRequest(
    [Required] Guid UserId,
    [Required, StringLength(200)] string FullName,
    [Required, EmailAddress, StringLength(254)] string Email,
    [Required, StringLength(200)] string Department,
    [StringLength(1000)] string Expertise,
    [StringLength(40)] string Phone,
    [Range(1, 50)] int MaxQuota
);

public record UpdateMentorProfileRequest(
    [Required, StringLength(200)] string FullName,
    [Required, StringLength(200)] string Department,
    [StringLength(1000)] string Expertise,
    [StringLength(40)] string Phone
);

public record MentorProgressRequest(
    [Required, StringLength(200)] string Milestone,
    [Range(0, 100)] int Progress,
    [StringLength(2000)] string Feedback
);

public record MentorProgressResponse(
    Guid GroupId,
    string GroupName,
    string Topic,
    string Milestone,
    int Progress,
    string Feedback,
    DateTime UpdatedAt
);

public record MentorTeamDetailsResponse(
    Guid GroupId,
    string GroupCode,
    string GroupName,
    string SemesterCode,
    int Status,
    Guid? LeaderStudentId,
    string Topic,
    int MemberCount,
    int Capacity,
    IReadOnlyList<MentorTeamMemberResponse> Members
);

public record MentorTeamMemberResponse(
    Guid StudentId,
    string StudentCode,
    string FullName,
    int Role,
    DateTime JoinedAt,
    bool IsDemo,
    string ContactEmail
);

public record MentorAppointmentRequest(
    [Required, StringLength(200)] string Title,
    Guid? GroupId,
    DateTime StartsAt,
    [StringLength(2000)] string Notes
);

public record MentorAppointmentResponse(
    Guid Id,
    Guid? GroupId,
    string Title,
    DateTime StartsAt,
    string Notes
);

public record MentorNotificationResponse(
    Guid Id,
    string Type,
    string Title,
    string Message,
    bool IsRead,
    DateTime CreatedAt
);

public record StudentNotificationResponse(
    Guid Id,
    Guid GroupId,
    Guid? RequestId,
    string MentorName,
    string GroupName,
    string Type,
    string Title,
    string Message,
    bool IsRead,
    DateTime CreatedAt
);

public record CreateMentorRequest(
    [Required] Guid GroupId,
    [Required] Guid MentorId,
    [Required, StringLength(200)] string GroupName,
    [StringLength(1000)] string Topic,
    [Required, StringLength(2000)] string Message
);

public record UpdateMentorQuotaRequest([Range(1, 50)] int MaxQuota);

public record MentorQuotaDto(Guid MentorId, int MaxQuota, int CurrentAssigned);

/// <summary>
/// Query-string filters for <c>GET /api/mentors</c>. Text filters are case-insensitive
/// "contains" matches; blank values are ignored.
/// </summary>
public class MentorSearchQuery
{
    public const int DefaultPageIndex = 1;
    public const int DefaultPageSize = 10;
    public const int MaxPageSize = 100;

    /// <summary>Matches mentor full name or email.</summary>
    public string? Search { get; init; }
    public string? Department { get; init; }
    public string? Expertise { get; init; }
    public int PageIndex { get; init; } = DefaultPageIndex;
    public int PageSize { get; init; } = DefaultPageSize;
}

public record PagedResult<T>(IReadOnlyList<T> Items, int TotalCount, int PageIndex, int PageSize)
{
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

/// <summary>Authenticated caller details resolved from the JWT by the API layer.</summary>
public record RequestActor(Guid UserId, string? Email, string? TokenVersion, string? AuthorizationHeader);
