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

public record CreateMentorRequest(
    [Required] Guid GroupId,
    [Required] Guid MentorId,
    [Required, StringLength(200)] string GroupName,
    [StringLength(1000)] string Topic,
    [Required, StringLength(2000)] string Message
);
