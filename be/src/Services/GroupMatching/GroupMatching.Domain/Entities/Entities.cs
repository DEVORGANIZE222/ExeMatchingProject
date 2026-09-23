using EXETeamMatching.GroupMatching.Domain.Enums;
using EXETeamMatching.SharedKernel.Domain;

namespace EXETeamMatching.GroupMatching.Domain.Entities;

public class Group : BaseEntity
{
    public string GroupCode { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;
    public string TopicTitle { get; set; } = string.Empty;
    public string SemesterCode { get; set; } = string.Empty;
    public GroupStatus Status { get; set; } = GroupStatus.Draft;
    public Guid LeaderStudentId { get; set; }
    public List<GroupMember> Members { get; set; } = new();
}

public class GroupMember : BaseEntity
{
    public Guid GroupId { get; set; }
    public Group Group { get; set; } = null!;
    public Guid StudentId { get; set; }
    public string StudentCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public MemberRole Role { get; set; } = MemberRole.Member;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}

public class GroupInvitation : BaseEntity
{
    public Guid GroupId { get; set; }
    public Guid InviterStudentId { get; set; }
    public Guid InviteeStudentId { get; set; }
    public InvitationStatus Status { get; set; } = InvitationStatus.Pending;
}

public class LeaderVote : BaseEntity
{
    public Guid GroupId { get; set; }
    public Guid VoterStudentId { get; set; }
    public Guid NominatedStudentId { get; set; }
    public DateTime VotedAt { get; set; } = DateTime.UtcNow;
}
