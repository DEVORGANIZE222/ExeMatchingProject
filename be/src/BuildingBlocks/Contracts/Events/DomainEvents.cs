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
    DateTime CreatedAt
);

public record GroupLockedEvent(
    Guid GroupId,
    string GroupCode,
    int MemberCount,
    DateTime LockedAt
);

public record LeaderElectedEvent(
    Guid GroupId,
    Guid LeaderStudentId,
    DateTime ElectedAt
);

public record TopicRegisteredEvent(
    Guid GroupId,
    string TopicCode,
    string TopicTitle,
    DateTime RegisteredAt
);

public record MentorRequestedEvent(
    Guid RequestId,
    Guid GroupId,
    Guid MentorId,
    string Message,
    DateTime RequestedAt
);

public record MentorDecisionEvent(
    Guid RequestId,
    Guid GroupId,
    Guid MentorId,
    bool IsAccepted,
    string DecisionReason,
    DateTime DecidedAt
);
