using EXETeamMatching.GroupMatching.Domain.Enums;

namespace EXETeamMatching.GroupMatching.Application.DTOs;

public record CreateGroupRequest(string GroupName, string TopicTitle, string SemesterCode, Guid CreatorStudentId);
public record AddGroupMemberRequest(Guid StudentId, string StudentCode, string FullName);
public record VoteLeaderRequest(Guid VoterStudentId, Guid NominatedStudentId);

public record GroupDto(
    Guid Id,
    string GroupCode,
    string GroupName,
    string TopicTitle,
    string SemesterCode,
    GroupStatus Status,
    Guid LeaderStudentId,
    List<GroupMemberDto> Members
);

public record GroupMemberDto(
    Guid Id,
    Guid StudentId,
    string StudentCode,
    string FullName,
    MemberRole Role,
    DateTime JoinedAt
);
