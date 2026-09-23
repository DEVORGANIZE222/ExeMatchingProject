using EXETeamMatching.Mentor.Domain.Entities;

namespace EXETeamMatching.Mentor.Application.DTOs;

public record MentorResponse(
    Guid Id,
    Guid UserId,
    string FullName,
    string Email,
    string Department,
    string Expertise,
    int MaxQuota,
    int CurrentAssigned
);

public record MentorRequestDto(
    Guid Id,
    Guid GroupId,
    Guid MentorId,
    string Message,
    RequestStatus Status,
    DateTime CreatedAt
);

public record MentorDecisionDto(
    Guid RequestId,
    bool IsAccepted,
    string DecisionReason
);
