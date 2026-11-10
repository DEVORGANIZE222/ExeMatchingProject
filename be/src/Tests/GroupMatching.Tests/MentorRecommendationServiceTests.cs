using EXETeamMatching.GroupMatching.Application.DTOs;
using EXETeamMatching.GroupMatching.Application.Interfaces;
using EXETeamMatching.GroupMatching.Application.Services;
using EXETeamMatching.GroupMatching.Domain.Enums;
using Xunit;

namespace EXETeamMatching.GroupMatching.Tests;

public class MentorRecommendationServiceTests
{
    [Fact]
    public async Task Returns_available_mentors_only_after_locked_group_has_topic()
    {
        var group = new GroupDto(Guid.NewGuid(), "FA26-G01", "Alpha", "FA26", GroupStatus.Locked,
            Guid.NewGuid(), "Distributed matching", DateTime.UtcNow, 4, []);
        var mentor = new MentorRecommendationDto(Guid.NewGuid(), "Mentor A", "mentor@example.edu", "SE", 5, 2, 3);
        var service = new MentorRecommendationService(new FixedGroups(group), new FixedMentors([mentor]));

        var result = await service.GetForGroupAsync(group.Id, Guid.NewGuid(), false);

        Assert.Single(result);
        Assert.Equal(mentor.Id, result[0].Id);
    }

    [Fact]
    public async Task Rejects_recommendation_before_group_is_eligible()
    {
        var group = new GroupDto(Guid.NewGuid(), "FA26-G01", "Alpha", "FA26", GroupStatus.Open,
            null, null, null, 4, []);
        var service = new MentorRecommendationService(new FixedGroups(group), new FixedMentors([]));

        var exception = await Assert.ThrowsAsync<GroupException>(() => service.GetForGroupAsync(group.Id, Guid.NewGuid(), false));

        Assert.Equal(409, exception.StatusCode);
    }

    private sealed class FixedMentors(IReadOnlyList<MentorRecommendationDto> result) : IMentorRecommendationClient
    {
        public Task<IReadOnlyList<MentorRecommendationDto>> GetAvailableAsync(CancellationToken ct = default) => Task.FromResult(result);
    }

    private sealed class FixedGroups(GroupDto group) : IGroupService
    {
        public Task<GroupDto> GetAsync(Guid id, Guid actorUserId, bool isAdmin, CancellationToken ct = default) => Task.FromResult(group);
        public Task<GroupDto> SeedDemoMembersAsync(Guid id, Guid actorUserId, bool isAdmin, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<GroupDto> GetMentorRequestContextAsync(Guid id, Guid actorUserId, CancellationToken ct = default) => Task.FromResult(group);
        public Task<PageResult<GroupDto>> ListAsync(GroupListQuery query, Guid actorUserId, bool isAdmin, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<GroupDto> CreateAsync(CreateGroupRequest request, Guid actorUserId, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<GroupDto> UpdateAsync(Guid id, UpdateGroupRequest request, Guid actorUserId, bool isAdmin, CancellationToken ct = default) => throw new NotSupportedException();
        public Task DeleteAsync(Guid id, Guid actorUserId, bool isAdmin, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<GroupDto> JoinAsync(Guid id, Guid actorUserId, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<GroupDto> InviteMemberAsync(Guid id, InviteMemberRequest request, Guid actorUserId, bool isAdmin, CancellationToken ct = default) => throw new NotSupportedException();
        public Task LeaveAsync(Guid id, Guid actorUserId, bool isAdmin, CancellationToken ct = default) => throw new NotSupportedException();
        public Task RemoveMemberAsAdminAsync(Guid id, Guid studentId, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<GroupDto> VoteAsync(Guid id, VoteLeaderRequest request, Guid actorUserId, CancellationToken ct = default, bool allowDemoVotes = false) => throw new NotSupportedException();
        public Task<GroupDto> LockAsync(Guid id, Guid actorUserId, CancellationToken ct = default) => throw new NotSupportedException();
        public Task<GroupDto> RegisterTopicAsync(Guid id, RegisterTopicRequest request, Guid actorUserId, CancellationToken ct = default) => throw new NotSupportedException();
    }
}
