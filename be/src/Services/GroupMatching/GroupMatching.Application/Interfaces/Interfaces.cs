using EXETeamMatching.GroupMatching.Application.DTOs;
using EXETeamMatching.GroupMatching.Domain.Entities;

namespace EXETeamMatching.GroupMatching.Application.Interfaces;

public interface IGroupRepository
{
    Task<Group?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<PageResult<GroupDto>> ListAsync(GroupListQuery query, CancellationToken ct = default);
    Task<Group?> GetStudentGroupAsync(Guid studentId, string semesterCode, CancellationToken ct = default);
    Task<HashSet<Guid>> GetSemesterMemberIdsAsync(string semesterCode, CancellationToken ct = default);
    Task<List<Group>> OpenGroupsAsync(string semesterCode, CancellationToken ct = default);
    void Add(Group group);
    void AddMember(GroupMember member);
    void AddVote(LeaderVote vote);
    void Remove(Group group);
    void AddOutbox(GroupEventOutbox item);
    Task SaveAsync(CancellationToken ct = default);
    Task<IGroupTransaction> BeginSerializableTransactionAsync(CancellationToken ct = default);
}

public interface IGroupTransaction : IAsyncDisposable
{
    Task CommitAsync(CancellationToken ct = default);
}

public interface IIdentitySemesterClient
{
    Task<EnrollmentContext> CurrentEnrollmentAsync(string semesterCode, CancellationToken ct = default);
    Task<EnrollmentContext> LookupEnrollmentAsync(string semesterCode, string identifier, CancellationToken ct = default);
    Task<IReadOnlyList<EnrollmentContext>> SearchEnrollmentsAsync(string semesterCode, string query, CancellationToken ct = default);
    Task<SemesterWorkflowContext> WorkflowAsync(string semesterCode, CancellationToken ct = default);
    Task<IReadOnlyList<EnrollmentContext>> UnmatchedEnrollmentsAsync(string semesterCode, CancellationToken ct = default);
}

public interface IGroupService
{
    Task<PageResult<GroupDto>> ListAsync(GroupListQuery query, Guid actorUserId, bool isAdmin, CancellationToken ct = default);
    Task<GroupDto?> GetMyGroupAsync(string semesterCode, Guid actorUserId, CancellationToken ct = default);
    Task<GroupDto> GetAsync(Guid id, Guid actorUserId, bool isAdmin, CancellationToken ct = default);
    Task<GroupDto> SeedDemoMembersAsync(Guid id, Guid actorUserId, bool isAdmin, CancellationToken ct = default);
    Task<GroupDto> GetMentorRequestContextAsync(Guid id, Guid actorUserId, CancellationToken ct = default);
    Task<GroupDto> CreateAsync(CreateGroupRequest request, Guid actorUserId, CancellationToken ct = default);
    Task<GroupDto> UpdateAsync(Guid id, UpdateGroupRequest request, Guid actorUserId, bool isAdmin, CancellationToken ct = default);
    Task DeleteAsync(Guid id, Guid actorUserId, bool isAdmin, CancellationToken ct = default);
    Task<GroupDto> JoinAsync(Guid id, Guid actorUserId, CancellationToken ct = default);
    Task<GroupDto> InviteMemberAsync(Guid id, InviteMemberRequest request, Guid actorUserId, bool isAdmin, CancellationToken ct = default);
    Task<IReadOnlyList<EnrollmentContext>> SearchInviteCandidatesAsync(Guid id, string query, Guid actorUserId, bool isAdmin, CancellationToken ct = default);
    Task LeaveAsync(Guid id, Guid actorUserId, bool isAdmin, CancellationToken ct = default);
    Task RemoveMemberAsAdminAsync(Guid id, Guid studentId, CancellationToken ct = default);
    Task<GroupDto> VoteAsync(Guid id, VoteLeaderRequest request, Guid actorUserId, CancellationToken ct = default, bool allowDemoVotes = false);
    Task<GroupDto> LockAsync(Guid id, Guid actorUserId, CancellationToken ct = default);
    Task<GroupDto> RegisterTopicAsync(Guid id, RegisterTopicRequest request, Guid actorUserId, CancellationToken ct = default);
}

public interface IMatchingService
{
    Task<RandomMatchingResult> RandomMatchingAsync(string semesterCode, CancellationToken cancellationToken = default);
}

/// <summary>Port owned by GroupMatching; its implementation calls Mentor's independent gRPC service.</summary>
public interface IMentorRecommendationClient
{
    Task<IReadOnlyList<MentorRecommendationDto>> GetAvailableAsync(CancellationToken ct = default);
}

public interface IMentorRecommendationService
{
    Task<IReadOnlyList<MentorRecommendationDto>> GetForGroupAsync(Guid groupId, Guid actorUserId, bool isAdmin,
        CancellationToken ct = default);
}
