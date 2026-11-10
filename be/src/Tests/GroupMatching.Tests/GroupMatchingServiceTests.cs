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
        var group = await service.CreateAsync(new CreateGroupRequest
        {
            GroupName = "Alpha", SemesterCode = "FA26", ProjectDescription = "A reliable distributed matching platform.",
            RecruitmentNeeds = [new RecruitmentNeedRequest { RoleCode = "Backend", Slots = 1 }, new RecruitmentNeedRequest { RoleCode = "UIUX", Slots = 1 }]
        }, students[0].UserId);
        Assert.Equal("A reliable distributed matching platform.", group.ProjectDescription);
        Assert.Equal(2, group.RecruitmentNeeds!.Count);
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

        identity.Unmatched = Enumerable.Range(1, 6).Select(i => new EnrollmentContext(Guid.NewGuid(), Guid.NewGuid(), $"X{i}", $"Flexible {i}", "FA27", false, $"x{i}@fpt.edu.vn", "SE")).ToList();
        var flexStore = new MemoryStore();
        var flexResult = await new MatchingService(flexStore, new FakeIdentity { Unmatched = identity.Unmatched }).RandomMatchingAsync("FA27");
        Assert.Equal(6, flexResult.MatchedStudents);
        Assert.Equal(2, flexResult.CreatedGroups);
        Assert.Equal(new[] { 4, 2 }, flexStore.Groups.Select(g => g.Members.Count).ToArray());
    }

    [Fact]
    public async Task Member_can_invite_by_identifier_and_update_group_name_and_topic()
    {
        var store = new MemoryStore();
        var s1 = new EnrollmentContext(Guid.NewGuid(), Guid.NewGuid(), "SE1001", "Student One", "FA26", false, "s1@fpt.edu.vn", "SE");
        var s2 = new EnrollmentContext(Guid.NewGuid(), Guid.NewGuid(), "SE1002", "Student Two", "FA26", false, "s2@fpt.edu.vn", "MKT");
        var identity = new FakeIdentity { Current = s1, Unmatched = [s1, s2] };
        var service = new GroupService(store, identity);

        var group = await service.CreateAsync(new CreateGroupRequest
        {
            GroupName = "Alpha",
            SemesterCode = "FA26",
            ProjectDescription = "Initial description.",
            RecruitmentNeeds = [new RecruitmentNeedRequest { RoleCode = "Backend", Slots = 1 }, new RecruitmentNeedRequest { RoleCode = "Marketing", Slots = 1 }]
        }, s1.UserId);

        var candidates = await service.SearchInviteCandidatesAsync(group.Id, "SE1002", s1.UserId, false);
        Assert.Single(candidates);
        Assert.Equal("Student Two", candidates[0].FullName);

        group = await service.InviteMemberAsync(group.Id, new InviteMemberRequest("s2@fpt.edu.vn"), s1.UserId, false);
        Assert.Equal(2, group.MemberCount);
        Assert.Contains(group.Members, m => m.Email == "s2@fpt.edu.vn");

        identity.Current = s2;
        group = await service.UpdateAsync(group.Id, new UpdateGroupRequest
        {
            GroupName = "Beta Team",
            ProjectDescription = "Updated project description.",
            TopicTitle = "New Startup Topic",
            RecruitmentNeeds = [new RecruitmentNeedRequest { RoleCode = "Backend", Slots = 1 }, new RecruitmentNeedRequest { RoleCode = "Marketing", Slots = 1 }]
        }, s2.UserId, false);
        Assert.Equal("Beta Team", group.GroupName);
        Assert.Equal("New Startup Topic", group.TopicTitle);
        Assert.Equal(2, group.RecruitmentNeeds!.Count);
    }

    [Fact]
    public async Task Demo_members_fill_group_and_follow_the_current_vote_when_demo_mode_is_enabled()
    {
        var store = new MemoryStore();
        var identity = new FakeIdentity();
        var service = new GroupService(store, identity);
        var students = Enumerable.Range(1, 2)
            .Select(i => new EnrollmentContext(Guid.NewGuid(), Guid.NewGuid(), $"D{i}", $"Demo {i}", "FA26", false))
            .ToArray();

        identity.Current = students[0];
        var group = await service.CreateAsync(new CreateGroupRequest
        {
            GroupName = "Demo group",
            SemesterCode = "FA26",
            ProjectDescription = "A group used to test the demo flow."
        }, students[0].UserId);
        identity.Current = students[1];
        group = await service.JoinAsync(group.Id, students[1].UserId);

        identity.Current = students[0];
        group = await service.SeedDemoMembersAsync(group.Id, students[0].UserId, false);
        Assert.Equal(5, group.MemberCount);
        Assert.Equal(3, group.Members.Count(member => member.IsDemo));

        identity.Current = students[0];
        group = await service.VoteAsync(
            group.Id,
            new VoteLeaderRequest(students[0].StudentId),
            students[0].UserId);
        Assert.Null(group.LeaderStudentId);
        Assert.Single(store.Groups.Single().Votes);

        group = await service.VoteAsync(
            group.Id,
            new VoteLeaderRequest(students[0].StudentId),
            students[0].UserId,
            allowDemoVotes: true);

        Assert.Equal(students[0].StudentId, group.LeaderStudentId);
        Assert.Equal(4, store.Groups.Single().Votes.Count);
        Assert.All(store.Groups.Single().Votes.Where(vote => group.Members.Single(member => member.StudentId == vote.VoterStudentId).IsDemo),
            vote => Assert.Equal(students[0].StudentId, vote.NominatedStudentId));
    }

    [Fact]
    public async Task Random_matching_skips_locked_group_members_and_sets_needs_on_partial_groups()
    {
        var store = new MemoryStore();
        var sLocked = Enumerable.Range(1, 4)
            .Select(i => new EnrollmentContext(Guid.NewGuid(), Guid.NewGuid(), $"L{i}", $"Locked {i}", "FA26", false, $"l{i}@fpt.edu.vn", "SE", ["Backend"]))
            .ToArray();
        var lockedGroup = new Group
        {
            GroupCode = "GRP-FA26-LOCKED",
            GroupName = "Locked Alpha",
            ProjectDescription = "Locked before random matching",
            SemesterCode = "FA26",
            Status = GroupStatus.Locked,
            LeaderStudentId = sLocked[0].StudentId
        };
        foreach (var student in sLocked)
            lockedGroup.Members.Add(new GroupMember
            {
                GroupId = lockedGroup.Id,
                StudentId = student.StudentId,
                StudentCode = student.StudentCode,
                FullName = student.FullName,
                Email = student.Email,
                Major = student.Major,
                Role = student.StudentId == sLocked[0].StudentId ? MemberRole.Leader : MemberRole.Member
            });
        store.Add(lockedGroup);

        var unmatched = Enumerable.Range(1, 4)
            .Select(i => new EnrollmentContext(Guid.NewGuid(), Guid.NewGuid(), $"U{i}", $"Unmatched {i}", "FA26", false, $"u{i}@fpt.edu.vn", "SE", ["Frontend"]))
            .ToList();
        var identity = new FakeIdentity
        {
            MatchingWindow = true,
            Current = sLocked[0],
            // Simulate IdentitySemester lagging behind on HasGroup for a student already in a Locked group.
            Unmatched = [sLocked[0], .. unmatched]
        };

        var result = await new MatchingService(store, identity).RandomMatchingAsync("FA26");

        Assert.Equal(4, result.MatchedStudents);
        Assert.Equal(1, result.CreatedGroups);
        Assert.Equal(2, store.Groups.Count);
        var created = store.Groups.Single(g => g.Id != lockedGroup.Id);
        Assert.Equal(4, created.Members.Count);
        Assert.DoesNotContain(created.Members, m => m.StudentId == sLocked[0].StudentId);
        Assert.Single(created.RecruitmentNeeds);
        Assert.DoesNotContain(created.RecruitmentNeeds, n => n.RoleCode == "Frontend");

        var myGroup = await new GroupService(store, identity).GetMyGroupAsync("FA26", sLocked[0].UserId);
        Assert.NotNull(myGroup);
        Assert.Equal(lockedGroup.Id, myGroup!.Id);
    }

    [Fact]
    public async Task First_member_can_kick_later_members_and_leader_can_lock_with_topic_then_unlock()
    {
        var store = new MemoryStore();
        var students = Enumerable.Range(1, 4)
            .Select(i => new EnrollmentContext(Guid.NewGuid(), Guid.NewGuid(), $"K{i}", $"Member {i}", "FA26", false, $"k{i}@fpt.edu.vn", "SE"))
            .ToArray();
        var identity = new FakeIdentity { Current = students[0], Unmatched = [.. students] };
        var service = new GroupService(store, identity);

        var group = await service.CreateAsync(new CreateGroupRequest
        {
            GroupName = "Host Kick Test",
            SemesterCode = "FA26",
            ProjectDescription = "Test first member kick and unlock flow"
        }, students[0].UserId);

        for (var i = 1; i < 4; i++)
        {
            identity.Current = students[i];
            group = await service.JoinAsync(group.Id, students[i].UserId);
        }

        // Later member cannot kick anyone
        identity.Current = students[1];
        await Assert.ThrowsAsync<GroupException>(() => service.RemoveMemberAsync(group.Id, students[2].StudentId, students[1].UserId, false));

        // First member (creator) can kick later member, and cannot self-kick
        identity.Current = students[0];
        await Assert.ThrowsAsync<GroupException>(() => service.RemoveMemberAsync(group.Id, students[0].StudentId, students[0].UserId, false));
        await service.RemoveMemberAsync(group.Id, students[3].StudentId, students[0].UserId, false);
        Assert.Equal(3, store.Groups.Single().Members.Count);

        // Re-join 4th member, elect leader, set topic while Open, lock group -> TopicRegisteredAt should be populated -> unlock works
        identity.Current = students[3];
        group = await service.JoinAsync(group.Id, students[3].UserId);
        await service.UpdateAsync(group.Id, new UpdateGroupRequest
        {
            GroupName = "Host Kick Test",
            ProjectDescription = "Test first member kick and unlock flow",
            TopicTitle = "Ready Topic Before Lock"
        }, students[3].UserId, false);

        foreach (var voter in students.Take(3))
        {
            identity.Current = voter;
            group = await service.VoteAsync(group.Id, new VoteLeaderRequest(students[0].StudentId), voter.UserId);
        }
        identity.Current = students[0];
        group = await service.LockAsync(group.Id, students[0].UserId);
        Assert.Equal(GroupStatus.Locked, group.Status);
        Assert.NotNull(group.TopicRegisteredAt);

        group = await service.UnlockAsync(group.Id, students[0].UserId, false);
        Assert.Equal(GroupStatus.Open, group.Status);
    }

    private sealed class FakeIdentity : IIdentitySemesterClient
    {
        public EnrollmentContext Current { get; set; } = null!;
        public bool MatchingWindow { get; set; }
        public List<EnrollmentContext> Unmatched { get; set; } = [];
        public Task<EnrollmentContext> CurrentEnrollmentAsync(string semesterCode, CancellationToken ct = default) => Task.FromResult(Current);
        public Task<EnrollmentContext> LookupEnrollmentAsync(string semesterCode, string identifier, CancellationToken ct = default)
        {
            var found = Unmatched.SingleOrDefault(x => x.SemesterCode == semesterCode &&
                (x.Email.Equals(identifier, StringComparison.OrdinalIgnoreCase) || x.StudentCode.Equals(identifier, StringComparison.OrdinalIgnoreCase)));
            return found is not null ? Task.FromResult(found) : throw new GroupException(404, "Student not found.");
        }
        public Task<IReadOnlyList<EnrollmentContext>> SearchEnrollmentsAsync(string semesterCode, string query, CancellationToken ct = default)
        {
            var list = Unmatched.Where(x => x.SemesterCode == semesterCode &&
                (x.Email.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                 x.StudentCode.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                 x.FullName.Contains(query, StringComparison.OrdinalIgnoreCase))).ToList();
            return Task.FromResult<IReadOnlyList<EnrollmentContext>>(list);
        }
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
        public Task<HashSet<Guid>> GetSemesterMemberIdsAsync(string semesterCode, CancellationToken ct = default)
            => Task.FromResult(_groups.Where(x => x.SemesterCode == semesterCode).SelectMany(x => x.Members).Select(m => m.StudentId).ToHashSet());
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
