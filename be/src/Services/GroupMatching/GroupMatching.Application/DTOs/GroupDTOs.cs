using System.ComponentModel.DataAnnotations;
using EXETeamMatching.GroupMatching.Domain.Enums;

namespace EXETeamMatching.GroupMatching.Application.DTOs;

// Request models intentionally use properties rather than primary-constructor records.
// ASP.NET Core validates DataAnnotations on these properties consistently for JSON bodies.
public class CreateGroupRequest
{
    public CreateGroupRequest() { }
    public CreateGroupRequest(string groupName, string semesterCode) => (GroupName, SemesterCode) = (groupName, semesterCode);

    [Required, StringLength(120, MinimumLength = 2)] public string GroupName { get; set; } = string.Empty;
    [Required, StringLength(30)] public string SemesterCode { get; set; } = string.Empty;
}

public class UpdateGroupRequest
{
    public UpdateGroupRequest() { }
    public UpdateGroupRequest(string groupName) => GroupName = groupName;

    [Required, StringLength(120, MinimumLength = 2)] public string GroupName { get; set; } = string.Empty;
}

public class VoteLeaderRequest
{
    public VoteLeaderRequest() { }
    public VoteLeaderRequest(Guid nominatedStudentId) => NominatedStudentId = nominatedStudentId;

    [Required] public Guid NominatedStudentId { get; set; }
}

public class RegisterTopicRequest
{
    public RegisterTopicRequest() { }
    public RegisterTopicRequest(string topicTitle) => TopicTitle = topicTitle;

    [Required, StringLength(300, MinimumLength = 3)] public string TopicTitle { get; set; } = string.Empty;
}

public class GroupListQuery
{
    [Required, StringLength(30)] public string SemesterCode { get; set; } = string.Empty;
    public GroupStatus? Status { get; set; }
    [StringLength(200)] public string? Search { get; set; }
    [Range(1, int.MaxValue)] public int Page { get; set; } = 1;
    [Range(1, 100)] public int PageSize { get; set; } = 20;
}

public record GroupMemberDto(Guid StudentId, string StudentCode, string FullName, MemberRole Role, DateTime JoinedAt);
public record GroupDto(Guid Id, string GroupCode, string GroupName, string SemesterCode, GroupStatus Status,
    Guid? LeaderStudentId, string? TopicTitle, DateTime? TopicRegisteredAt, int MemberCount, List<GroupMemberDto> Members);
public record PageResult<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize);
public record RandomMatchingResult(int AddedToExistingGroups, int CreatedGroups, int MatchedStudents);
public record MentorRecommendationDto(Guid Id, string FullName, string Email, string Department,
    int MaxQuota, int CurrentAssigned, int AvailableQuota);
public record EnrollmentContext(Guid StudentId, Guid UserId, string StudentCode, string FullName, string SemesterCode, bool HasGroup);
public record SemesterWorkflowContext(string SemesterCode, bool IsActive, DateTime StartDate, DateTime EndDate,
    DateTime? RegistrationDeadline, DateTime? TopicDeadline, DateTime? MentorDeadline);
