using System.ComponentModel.DataAnnotations;
using EXETeamMatching.GroupMatching.Domain.Enums;

namespace EXETeamMatching.GroupMatching.Application.DTOs;

// Request models intentionally use properties rather than primary-constructor records.
// ASP.NET Core validates DataAnnotations on these properties consistently for JSON bodies.
public class CreateGroupRequest
{
    public CreateGroupRequest() { }
    public CreateGroupRequest(string groupName, string semesterCode)
    {
        GroupName = groupName; SemesterCode = semesterCode; ProjectDescription = groupName;
    }

    [Required, StringLength(120, MinimumLength = 2)] public string GroupName { get; set; } = string.Empty;
    [Required, StringLength(30)] public string SemesterCode { get; set; } = string.Empty;
    [Required, StringLength(1200, MinimumLength = 3)] public string ProjectDescription { get; set; } = string.Empty;
    [MaxLength(4)] public List<RecruitmentNeedRequest> RecruitmentNeeds { get; set; } = [];
}

public class UpdateGroupRequest
{
    public UpdateGroupRequest() { }
    public UpdateGroupRequest(string groupName) { GroupName = groupName; ProjectDescription = groupName; }

    [Required, StringLength(120, MinimumLength = 2)] public string GroupName { get; set; } = string.Empty;
    [Required, StringLength(1200, MinimumLength = 3)] public string ProjectDescription { get; set; } = string.Empty;
    [StringLength(300)] public string? TopicTitle { get; set; }
    [MaxLength(4)] public List<RecruitmentNeedRequest> RecruitmentNeeds { get; set; } = [];
}

public class InviteMemberRequest
{
    public InviteMemberRequest() { }
    public InviteMemberRequest(string identifier) => Identifier = identifier;

    [Required, StringLength(254, MinimumLength = 2)] public string Identifier { get; set; } = string.Empty;
}

public class RecruitmentNeedRequest
{
    [Required, StringLength(40)] public string RoleCode { get; set; } = string.Empty;
    [Range(1, 4)] public int Slots { get; set; }
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

public record GroupMemberDto(Guid StudentId, string StudentCode, string FullName, MemberRole Role, DateTime JoinedAt, bool IsDemo = false, string Email = "", string Major = "");
public record GroupDto(Guid Id, string GroupCode, string GroupName, string SemesterCode, GroupStatus Status,
    Guid? LeaderStudentId, string? TopicTitle, DateTime? TopicRegisteredAt, int MemberCount, List<GroupMemberDto> Members,
    string ProjectDescription = "", IReadOnlyList<RecruitmentNeedDto>? RecruitmentNeeds = null);
public record RecruitmentNeedDto(string RoleCode, int Slots);
public record PageResult<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize);
public record RandomMatchingResult(int AddedToExistingGroups, int CreatedGroups, int MatchedStudents);
public record MentorRecommendationDto(Guid Id, string FullName, string Email, string Department,
    int MaxQuota, int CurrentAssigned, int AvailableQuota);
public record EnrollmentContext(Guid StudentId, Guid UserId, string StudentCode, string FullName, string SemesterCode, bool HasGroup,
    string Email = "", string Major = "", IReadOnlyList<string>? StrengthRoles = null);
public record SemesterWorkflowContext(string SemesterCode, bool IsActive, DateTime StartDate, DateTime EndDate,
    DateTime? RegistrationDeadline, DateTime? TopicDeadline, DateTime? MentorDeadline);
