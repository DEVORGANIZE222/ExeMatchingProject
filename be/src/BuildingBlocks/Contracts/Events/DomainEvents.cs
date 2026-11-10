namespace EXETeamMatching.Contracts.Events;

public record StudentImportedEvent(
    Guid StudentId,
    string StudentCode,
    string FullName,
    string Email,
    string SemesterCode,
    DateTime ImportedAt
);

public record GroupCreatedEvent(
    Guid GroupId,
    string GroupCode,
    string GroupName,
    Guid CreatorStudentId,
    DateTime CreatedAt,
    string? CreatorEmail = null
);

public record GroupLockedEvent(
    Guid GroupId,
    string GroupCode,
    int MemberCount,
    DateTime LockedAt,
    string? ContactEmail = null
);

public record LeaderElectedEvent(
    Guid GroupId,
    Guid LeaderStudentId,
    DateTime ElectedAt,
    string? LeaderEmail = null
);

public record TopicRegisteredEvent(
    Guid GroupId,
    string TopicCode,
    string TopicTitle,
    DateTime RegisteredAt,
    string? ContactEmail = null
);

public record StudentGroupMembershipChangedEvent(
    Guid StudentId,
    bool HasGroup,
    DateTime ChangedAt
);

/// <summary>Published by IdentitySemester after a successful semester-code rename.</summary>
public record SemesterCodeChangedEvent(
    Guid SemesterId,
    string OldSemesterCode,
    string NewSemesterCode,
    DateTime ChangedAt
);

/// <summary>Published by IdentitySemester whenever a student updates their strength roles.</summary>
public record StudentStrengthRolesChangedEvent(
    Guid StudentId,
    IReadOnlyList<string> RoleCodes,
    DateTime ChangedAt
);

public record MentorRequestedEvent(
    Guid RequestId,
    Guid GroupId,
    Guid MentorId,
    string Message,
    DateTime RequestedAt,
    string? MentorEmail = null,
    string? RequesterEmail = null,
    string? GroupName = null,
    string? Topic = null
);

public record MentorDecisionEvent(
    Guid RequestId,
    Guid GroupId,
    Guid MentorId,
    bool IsAccepted,
    string DecisionReason,
    DateTime DecidedAt,
    string? RequesterEmail = null,
    string? MentorEmail = null,
    string? GroupName = null,
    string? MentorName = null
);
