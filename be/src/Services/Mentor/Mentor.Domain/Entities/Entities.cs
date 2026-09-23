using EXETeamMatching.SharedKernel.Domain;

namespace EXETeamMatching.Mentor.Domain.Entities;

public class MentorUser : BaseEntity
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string Expertise { get; set; } = string.Empty;
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
    public string Message { get; set; } = string.Empty;
    public RequestStatus Status { get; set; } = RequestStatus.Pending;
    public string? DecisionReason { get; set; }
}
