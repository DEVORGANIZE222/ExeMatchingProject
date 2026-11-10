using EXETeamMatching.GroupMatching.Domain.Enums;
using EXETeamMatching.SharedKernel.Domain;

namespace EXETeamMatching.GroupMatching.Domain.Entities;

public class Group : BaseEntity
{
    public string GroupCode { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;
    public string ProjectDescription { get; set; } = string.Empty;
    public string? TopicTitle { get; set; }
    public string SemesterCode { get; set; } = string.Empty;
    public GroupStatus Status { get; set; } = GroupStatus.Open;
    // Student identities belong to IdentitySemester. They intentionally are not
    // foreign keys because group_matching_db remains independent.
    public Guid? LeaderStudentId { get; set; }
    public Guid? CreatedByStudentId { get; set; }
    public DateTime? TopicRegisteredAt { get; set; }
    public List<GroupMember> Members { get; set; } = new();
    public List<LeaderVote> Votes { get; set; } = new();
    public List<GroupRecruitmentNeed> RecruitmentNeeds { get; set; } = new();
}

/// <summary>Open positions stated by a group. RoleCode uses Contracts.TeamRoles vocabulary.</summary>
public class GroupRecruitmentNeed : BaseEntity
{
    public Guid GroupId { get; set; }
    public Group Group { get; set; } = null!;
    public string RoleCode { get; set; } = string.Empty;
    public int Slots { get; set; }
}

public class GroupMember : BaseEntity
{
    public Guid GroupId { get; set; }
    public Group Group { get; set; } = null!;
    public Guid StudentId { get; set; }
    public string StudentCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Major { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public MemberRole Role { get; set; } = MemberRole.Member;
    public bool IsDemo { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}

public class LeaderVote : BaseEntity
{
    public Guid GroupId { get; set; }
    public Guid VoterStudentId { get; set; }
    public Guid NominatedStudentId { get; set; }
    public DateTime VotedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Reliable Kafka event persisted with the group transaction.</summary>
public class GroupEventOutbox : BaseEntity
{
    public string Topic { get; set; } = string.Empty;
    public string Payload { get; set; } = string.Empty;
    public DateTime? PublishedAt { get; set; }
}
