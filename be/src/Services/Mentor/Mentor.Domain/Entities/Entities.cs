using EXETeamMatching.SharedKernel.Domain;

namespace EXETeamMatching.Mentor.Domain.Entities;

public class MentorUser : BaseEntity
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string Expertise { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public MentorQuota? Quota { get; set; }
}

public class MentorQuota : BaseEntity
{
    public Guid MentorId { get; set; }
    public MentorUser Mentor { get; set; } = null!;
    public int MaxQuota { get; set; } = 5;
    public int CurrentAssigned { get; set; } = 0;
}

public enum RequestStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2
}

public class MentorRequest : BaseEntity
{
    public Guid GroupId { get; set; }
    public Guid MentorId { get; set; }
    public MentorUser Mentor { get; set; } = null!;
    public Guid? RequesterUserId { get; set; }
    public string RequesterName { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;
    public string Topic { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public RequestStatus Status { get; set; } = RequestStatus.Pending;
    public string? DecisionReason { get; set; }
    public DateTime? DecidedAt { get; set; }
}

public class MentorGroupProgress : BaseEntity
{
    public Guid MentorId { get; set; }
    public Guid GroupId { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public string Topic { get; set; } = string.Empty;
    public string Milestone { get; set; } = string.Empty;
    public int Progress { get; set; }
    public string Feedback { get; set; } = string.Empty;
}

public class MentorAppointment : BaseEntity
{
    public Guid MentorId { get; set; }
    public Guid? GroupId { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime StartsAt { get; set; }
    public string Notes { get; set; } = string.Empty;
}

public class MentorNotification : BaseEntity
{
    public Guid MentorId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; }
}

public class StudentNotification : BaseEntity
{
    public Guid GroupId { get; set; }
    public Guid? RequestId { get; set; }
    public string MentorName { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; }
}
