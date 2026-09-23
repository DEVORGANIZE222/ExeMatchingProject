namespace EXETeamMatching.GroupMatching.Domain.Enums;

public enum GroupStatus
{
    Draft = 0,
    Open = 1,
    Locked = 2,
    Completed = 3
}

public enum MemberRole
{
    Member = 0,
    Leader = 1
}

public enum InvitationStatus
{
    Pending = 0,
    Accepted = 1,
    Rejected = 2
}
