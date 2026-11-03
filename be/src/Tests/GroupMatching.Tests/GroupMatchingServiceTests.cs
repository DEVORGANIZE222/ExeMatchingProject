using EXETeamMatching.GroupMatching.Application.DTOs;
using EXETeamMatching.GroupMatching.Application.Interfaces;
using EXETeamMatching.GroupMatching.Application.Services;
using EXETeamMatching.GroupMatching.Domain.Entities;
using EXETeamMatching.GroupMatching.Domain.Enums;
using Xunit;

namespace EXETeamMatching.GroupMatching.Tests;

public class GroupMatchingServiceTests
{
    [Fact]
    public async Task Group_lifecycle_enforces_capacity_majority_lock_and_topic_rules()
    {
        var store = new MemoryStore();
        var identity = new FakeIdentity();
        var service = new GroupService(store, identity);
        var students = Enumerable.Range(1, 6).Select(i => new EnrollmentContext(Guid.NewGuid(), Guid.NewGuid(), $"S{i}", $"Student {i}", "FA26", false)).ToArray();

        identity.Current = students[0];
        var group = await service.CreateAsync(new CreateGroupRequest("Alpha", "FA26"), students[0].UserId);
        for (var i = 1; i < 5; i++)
        {
            identity.Current = students[i];
            group = await service.JoinAsync(group.Id, students[i].UserId);
        }
        Assert.Equal(5, group.MemberCount);
        identity.Current = students[5];
        await Assert.ThrowsAsync<GroupException>(() => service.JoinAsync(group.Id, students[5].UserId));

        foreach (var voter in students.Take(3))
        {
            identity.Current = voter;
            group = await service.VoteAsync(group.Id, new VoteLeaderRequest(students[0].StudentId), voter.UserId);
        }
        Assert.Equal(students[0].StudentId, group.LeaderStudentId);
        identity.Current = students[0];
        group = await service.LockAsync(group.Id, students[0].UserId);
        Assert.Equal(GroupStatus.Locked, group.Status);
        group = await service.RegisterTopicAsync(group.Id, new RegisterTopicRequest("Reliable distributed matching"), students[0].UserId);
        Assert.Equal("Reliable distributed matching", group.TopicTitle);
        Assert.NotEmpty(store.Outbox);
    }

    [Fact]
    public async Task Random_matching_only_creates_valid_groups_of_four_or_five()
    {
        var store = new MemoryStore();
        var identity = new FakeIdentity { MatchingWindow = true };
        identity.Unmatched = Enumerable.Range(1, 8).Select(i => new EnrollmentContext(Guid.NewGuid(), Guid.NewGuid(), $"R{i}", $"Random {i}", "FA26", false)).ToList();
        var result = await new MatchingService(store, identity).RandomMatchingAsync("FA26");
        Assert.Equal(8, result.MatchedStudents);
        Assert.Equal(2, result.CreatedGroups);
        Assert.All(store.Groups, group => Assert.InRange(group.Members.Count, 4, 5));

        identity.Unmatched = Enumerable.Range(1, 6).Select(i => new EnrollmentContext(Guid.NewGuid(), Guid.NewGuid(), $"X{i}", $"Invalid {i}", "FA27", false)).ToList();
        await Assert.ThrowsAsync<GroupException>(() => new MatchingService(new MemoryStore(), identity).RandomMatchingAsync("FA27"));
    }

    private sealed class FakeIdentity : IIdentitySemesterClient
    {
        public EnrollmentContext Current { get; set; } = null!;
        public bool MatchingWindow { get; set; }
        public List<EnrollmentContext> Unmatched { get; set; } = [];
        public Task<EnrollmentContext> CurrentEnrollmentAsync(string semesterCode, CancellationToken ct = default) => Task.FromResult(Current);
        public Task<SemesterWorkflowContext> WorkflowAsync(string semesterCode, CancellationToken ct = default) => Task.FromResult(MatchingWindow
            ? new SemesterWorkflowContext(semesterCode, true, DateTime.UtcNow.AddDays(-10), DateTime.UtcNow.AddDays(10), DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(7))
            : new SemesterWorkflowContext(semesterCode, true, DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(10), DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(5), DateTime.UtcNow.AddDays(7)));
        public Task<IReadOnlyList<EnrollmentContext>> UnmatchedEnrollmentsAsync(string semesterCode, CancellationToken ct = default) => Task.FromResult<IReadOnlyList<EnrollmentContext>>(Unmatched.Where(x => x.SemesterCode == semesterCode).ToList());
    }

    private sealed class MemoryStore : IGroupRepository
    {
        private readonly List<Group> _groups = [];
        public IReadOnlyList<Group> Groups => _groups;
        public List<GroupEventOutbox> Outbox { get; } = [];
        public Task<Group?> GetByIdAsync(Guid id, CancellationToken ct = default) => Task.FromResult(_groups.SingleOrDefault(x => x.Id == id));
        public Task<PageResult<GroupDto>> ListAsync(GroupListQuery query, CancellationToken ct = default) => Task.FromResult(new PageResult<GroupDto>([], 0, query.Page, query.PageSize));
        public Task<Group?> GetStudentGroupAsync(Guid studentId, string semesterCode, CancellationToken ct = default) => Task.FromResult(_groups.SingleOrDefault(x => x.SemesterCode == semesterCode && x.Members.Any(m => m.StudentId == studentId)));
        public Task<List<Group>> OpenGroupsAsync(string semesterCode, CancellationToken ct = default) => Task.FromResult(_groups.Where(x => x.SemesterCode == semesterCode && x.Status == GroupStatus.Open).ToList());
        public void Add(Group group) => _groups.Add(group);
        public void AddMember(GroupMember member) { }
        public void AddVote(LeaderVote vote) { }
        public void Remove(Group group) => _groups.Remove(group);
        public void AddOutbox(GroupEventOutbox item) => Outbox.Add(item);
        public Task SaveAsync(CancellationToken ct = default) => Task.CompletedTask;
        public Task<IGroupTransaction> BeginSerializableTransactionAsync(CancellationToken ct = default) => Task.FromResult<IGroupTransaction>(new MemoryTransaction());
    }
    private sealed class MemoryTransaction : IGroupTransaction
    {
        public Task CommitAsync(CancellationToken ct = default) => Task.CompletedTask;
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }
}
