using System.Text.Json;
using EXETeamMatching.Contracts.Events;
using EXETeamMatching.Contracts.TeamRoles;
using EXETeamMatching.GroupMatching.Application.DTOs;
using EXETeamMatching.GroupMatching.Application.Interfaces;
using EXETeamMatching.GroupMatching.Domain.Entities;
using EXETeamMatching.GroupMatching.Domain.Enums;

namespace EXETeamMatching.GroupMatching.Application.Services;

public sealed class GroupService(IGroupRepository repository, IIdentitySemesterClient identity) : IGroupService
{
    public async Task<PageResult<GroupDto>> ListAsync(GroupListQuery query, Guid actorUserId, bool isAdmin, CancellationToken ct = default)
    {
        query.SemesterCode = Code(query.SemesterCode);
        return await repository.ListAsync(query, ct);
    }

    public async Task<GroupDto> GetAsync(Guid id, Guid actorUserId, bool isAdmin, CancellationToken ct = default)
    {
        var group = await Group(id, ct);
        return Map(group);
    }

    public async Task<GroupDto> GetMentorRequestContextAsync(Guid id, Guid actorUserId, CancellationToken ct = default)
    {
        var group = await Group(id, ct);
        var actor = await Enrollment(actorUserId, group.SemesterCode, ct);
        if (group.LeaderStudentId != actor.StudentId)
            throw Forbidden("Only the elected group leader can request a mentor.");
        if (group.Status != GroupStatus.Locked || string.IsNullOrWhiteSpace(group.TopicTitle))
            throw Conflict("A mentor can only be requested for a locked group with a registered topic.");
        return Map(group);
    }

    public async Task<GroupDto> CreateAsync(CreateGroupRequest request, Guid actorUserId, CancellationToken ct = default)
    {
        var semester = Code(request.SemesterCode);
        var actor = await Enrollment(actorUserId, semester, ct);
        await RegistrationOpen(semester, ct);
        await using var tx = await repository.BeginSerializableTransactionAsync(ct);
        if (await repository.GetStudentGroupAsync(actor.StudentId, semester, ct) is not null)
            throw Conflict("You already belong to a group in this semester.");
        var group = new Group
        {
            GroupCode = NewCode(semester),
            GroupName = Required(request.GroupName), ProjectDescription = Required(request.ProjectDescription), SemesterCode = semester, CreatedByStudentId = actor.StudentId,
            Members = [Member(actor)]
        };
        ApplyRecruitmentNeeds(group, request.RecruitmentNeeds);
        repository.Add(group);
        MembershipEvent(actor.StudentId, true);
        Event("group-created", new GroupCreatedEvent(group.Id, group.GroupCode, group.GroupName, actor.StudentId, DateTime.UtcNow));
        await repository.SaveAsync(ct);
        await tx.CommitAsync(ct);
        return Map(group);
    }

    public async Task<GroupDto> UpdateAsync(Guid id, UpdateGroupRequest request, Guid actorUserId, bool isAdmin, CancellationToken ct = default)
    {
        var group = await Group(id, ct);
        var actor = isAdmin ? null : await Enrollment(actorUserId, group.SemesterCode, ct);
        if (group.Status != GroupStatus.Open) throw Conflict("A locked group cannot be renamed.");
        if (!isAdmin && group.CreatedByStudentId != actor!.StudentId) throw Forbidden("Only the group creator can rename an open group.");
        group.GroupName = Required(request.GroupName); group.ProjectDescription = Required(request.ProjectDescription);
        ApplyRecruitmentNeeds(group, request.RecruitmentNeeds); group.UpdatedAt = DateTime.UtcNow;
        await repository.SaveAsync(ct);
        return Map(group);
    }

    public async Task DeleteAsync(Guid id, Guid actorUserId, bool isAdmin, CancellationToken ct = default)
    {
        var group = await Group(id, ct);
        var actor = isAdmin ? null : await Enrollment(actorUserId, group.SemesterCode, ct);
        if (group.Status != GroupStatus.Open) throw Conflict("A locked group cannot be deleted.");
        if (!isAdmin && group.CreatedByStudentId != actor!.StudentId) throw Forbidden("Only the group creator can delete an open group.");
        foreach (var member in group.Members) MembershipEvent(member.StudentId, false);
        repository.Remove(group);
        await repository.SaveAsync(ct);
    }

    public async Task<GroupDto> JoinAsync(Guid id, Guid actorUserId, CancellationToken ct = default)
    {
        var group = await Group(id, ct);
        var actor = await Enrollment(actorUserId, group.SemesterCode, ct);
        await RegistrationOpen(group.SemesterCode, ct);
        await using var tx = await repository.BeginSerializableTransactionAsync(ct);
        group = await Group(id, ct);
        if (group.Status != GroupStatus.Open) throw Conflict("This group is already locked.");
        if (group.Members.Count >= 5) throw Conflict("A group can contain at most 5 members.");
        if (await repository.GetStudentGroupAsync(actor.StudentId, group.SemesterCode, ct) is not null) throw Conflict("You already belong to a group in this semester.");
        var member = Member(actor);
        group.Members.Add(member);
        repository.AddMember(member);
        group.UpdatedAt = DateTime.UtcNow;
        MembershipEvent(actor.StudentId, true);
        await repository.SaveAsync(ct); await tx.CommitAsync(ct);
        return Map(group);
    }

    public async Task LeaveAsync(Guid id, Guid actorUserId, bool isAdmin, CancellationToken ct = default)
    {
        var group = await Group(id, ct);
        var actor = isAdmin ? null : await Enrollment(actorUserId, group.SemesterCode, ct);
        if (group.Status != GroupStatus.Open) throw Conflict("A locked group cannot be left.");
        var member = isAdmin ? throw BadRequest("Use the administrator member-removal endpoint.") : group.Members.SingleOrDefault(x => x.StudentId == actor!.StudentId);
        if (member is null) throw Forbidden("You are not a member of this group.");
        group.Members.Remove(member);
        group.Votes.Clear();
        group.LeaderStudentId = null;
        foreach (var item in group.Members) item.Role = MemberRole.Member;
        MembershipEvent(member.StudentId, false);
        if (group.Members.Count == 0) repository.Remove(group); else group.UpdatedAt = DateTime.UtcNow;
        await repository.SaveAsync(ct);
    }

    public async Task RemoveMemberAsAdminAsync(Guid id, Guid studentId, CancellationToken ct = default)
    {
        var group = await Group(id, ct);
        if (group.Status != GroupStatus.Open) throw Conflict("A locked group cannot be changed.");
        var member = group.Members.SingleOrDefault(x => x.StudentId == studentId) ?? throw new GroupException(404, "Member not found in this group.");
        group.Members.Remove(member);
        group.Votes.Clear(); group.LeaderStudentId = null;
        foreach (var item in group.Members) item.Role = MemberRole.Member;
        MembershipEvent(member.StudentId, false);
        if (group.Members.Count == 0) repository.Remove(group); else group.UpdatedAt = DateTime.UtcNow;
        await repository.SaveAsync(ct);
    }

    public async Task<GroupDto> VoteAsync(Guid id, VoteLeaderRequest request, Guid actorUserId, CancellationToken ct = default)
    {
        var group = await Group(id, ct); var actor = await Enrollment(actorUserId, group.SemesterCode, ct);
        await RegistrationOpen(group.SemesterCode, ct);
        if (group.Status != GroupStatus.Open) throw Conflict("A leader cannot be changed after the group is locked.");
        if (!group.Members.Any(x => x.StudentId == actor.StudentId)) throw Forbidden("Only group members can vote.");
        if (!group.Members.Any(x => x.StudentId == request.NominatedStudentId)) throw BadRequest("The nominee must be a group member.");
        var vote = group.Votes.SingleOrDefault(x => x.VoterStudentId == actor.StudentId);
        if (vote is null)
        {
            vote = new LeaderVote { GroupId = group.Id, VoterStudentId = actor.StudentId, NominatedStudentId = request.NominatedStudentId };
            group.Votes.Add(vote);
            repository.AddVote(vote);
        }
        else { vote.NominatedStudentId = request.NominatedStudentId; vote.VotedAt = DateTime.UtcNow; vote.UpdatedAt = DateTime.UtcNow; }
        var winner = group.Votes.GroupBy(x => x.NominatedStudentId).OrderByDescending(x => x.Count()).FirstOrDefault();
        if (winner is not null && winner.Count() > group.Members.Count / 2 && group.LeaderStudentId != winner.Key)
        {
            group.LeaderStudentId = winner.Key;
            foreach (var member in group.Members) member.Role = member.StudentId == winner.Key ? MemberRole.Leader : MemberRole.Member;
            Event("leader-elected", new LeaderElectedEvent(group.Id, winner.Key, DateTime.UtcNow));
        }
        await repository.SaveAsync(ct); return Map(group);
    }

    public async Task<GroupDto> LockAsync(Guid id, Guid actorUserId, CancellationToken ct = default)
    {
        var group = await Group(id, ct); var actor = await Enrollment(actorUserId, group.SemesterCode, ct);
        await TopicWindow(group.SemesterCode, ct);
        if (group.Status != GroupStatus.Open) throw Conflict("This group is already locked.");
        if (group.LeaderStudentId != actor.StudentId) throw Forbidden("Only the elected leader can lock this group.");
        if (group.Members.Count is < 4 or > 5) throw Conflict("A group must contain 4 or 5 members before it can be locked.");
        group.Status = GroupStatus.Locked; group.UpdatedAt = DateTime.UtcNow;
        Event("group-locked", new GroupLockedEvent(group.Id, group.GroupCode, group.Members.Count, DateTime.UtcNow));
        await repository.SaveAsync(ct); return Map(group);
    }

    public async Task<GroupDto> RegisterTopicAsync(Guid id, RegisterTopicRequest request, Guid actorUserId, CancellationToken ct = default)
    {
        var group = await Group(id, ct); var actor = await Enrollment(actorUserId, group.SemesterCode, ct);
        await TopicWindow(group.SemesterCode, ct);
        if (group.Status != GroupStatus.Locked) throw Conflict("Only a locked group can register a topic.");
        if (group.LeaderStudentId != actor.StudentId) throw Forbidden("Only the elected leader can register the topic.");
        if (group.TopicRegisteredAt is not null) throw Conflict("This group already registered its topic.");
        group.TopicTitle = Required(request.TopicTitle); group.TopicRegisteredAt = DateTime.UtcNow; group.UpdatedAt = DateTime.UtcNow;
        Event("topic-registered", new TopicRegisteredEvent(group.Id, group.GroupCode, group.TopicTitle, group.TopicRegisteredAt.Value));
        await repository.SaveAsync(ct); return Map(group);
    }

    private async Task<EnrollmentContext> Enrollment(Guid actorUserId, string semester, CancellationToken ct)
    {
        var enrollment = await identity.CurrentEnrollmentAsync(semester, ct);
        if (enrollment.UserId != actorUserId) throw Forbidden("Enrollment does not match the authenticated account.");
        return enrollment;
    }
    private async Task RegistrationOpen(string semester, CancellationToken ct)
    {
        var schedule = await identity.WorkflowAsync(semester, ct);
        if (!schedule.IsActive || schedule.RegistrationDeadline is null || DateTime.UtcNow < schedule.StartDate || DateTime.UtcNow >= schedule.RegistrationDeadline)
            throw Conflict("Free group registration is not open for this semester.");
    }
    private async Task TopicWindow(string semester, CancellationToken ct)
    {
        var schedule = await identity.WorkflowAsync(semester, ct);
        if (!schedule.IsActive || schedule.TopicDeadline is null || DateTime.UtcNow >= schedule.TopicDeadline)
            throw Conflict("Topic registration is closed for this semester.");
    }
    private async Task<Group> Group(Guid id, CancellationToken ct) => await repository.GetByIdAsync(id, ct) ?? throw new GroupException(404, "Group not found.");
    private void Event<T>(string topic, T payload) where T : class => repository.AddOutbox(new GroupEventOutbox { Topic = topic, Payload = JsonSerializer.Serialize(payload) });
    private void MembershipEvent(Guid studentId, bool hasGroup) => Event("student-group-membership-changed", new StudentGroupMembershipChangedEvent(studentId, hasGroup, DateTime.UtcNow));
    private static GroupMember Member(EnrollmentContext item) => new() { StudentId = item.StudentId, StudentCode = item.StudentCode, FullName = item.FullName, JoinedAt = DateTime.UtcNow };
    private static GroupDto Map(Group group) => new(group.Id, group.GroupCode, group.GroupName, group.SemesterCode, group.Status,
        group.LeaderStudentId, group.TopicTitle, group.TopicRegisteredAt, group.Members.Count,
        group.Members.OrderBy(x => x.JoinedAt).Select(x => new GroupMemberDto(x.StudentId, x.StudentCode, x.FullName, x.Role, x.JoinedAt)).ToList(),
        group.ProjectDescription,
        group.RecruitmentNeeds.OrderBy(x => x.RoleCode).Select(x => new RecruitmentNeedDto(x.RoleCode, x.Slots)).ToList());
    private static void ApplyRecruitmentNeeds(Group group, IEnumerable<RecruitmentNeedRequest>? source)
    {
        var requested = (source ?? []).ToList();
        if (requested.Count > 4) throw BadRequest("A group can recruit at most four role types.");
        if (requested.Any(x => x.Slots is < 1 or > 4 || !TeamRoleCatalog.IsValid(x.RoleCode)))
            throw BadRequest("Recruitment roles or slots are invalid.");
        var normalized = requested.Select(x => new RecruitmentNeedDto(TeamRoleCatalog.Normalize(x.RoleCode), x.Slots)).ToList();
        if (normalized.Select(x => x.RoleCode).Distinct(StringComparer.OrdinalIgnoreCase).Count() != normalized.Count)
            throw BadRequest("Recruitment roles must not contain duplicates.");
        if (normalized.Sum(x => x.Slots) > 5 - group.Members.Count)
            throw BadRequest("Recruitment slots cannot exceed the group's available capacity.");
        group.RecruitmentNeeds.Clear();
        foreach (var item in normalized)
            group.RecruitmentNeeds.Add(new GroupRecruitmentNeed { RoleCode = item.RoleCode, Slots = item.Slots });
    }
    private static string Code(string value) => Required(value).ToUpperInvariant();
    private static string NewCode(string semester)
    {
        var code = $"GRP-{semester}-{Guid.NewGuid():N}";
        return code[..Math.Min(64, code.Length)];
    }
    private static string Required(string value) => string.IsNullOrWhiteSpace(value) ? throw BadRequest("Required value cannot be blank.") : value.Trim();
    private static GroupException Conflict(string message) => new(409, message);
    private static GroupException Forbidden(string message) => new(403, message);
    private static GroupException BadRequest(string message) => new(400, message);
}

public sealed class MatchingService(IGroupRepository repository, IIdentitySemesterClient identity) : IMatchingService
{
    public async Task<RandomMatchingResult> RandomMatchingAsync(string semesterCode, CancellationToken ct = default)
    {
        var code = semesterCode.Trim().ToUpperInvariant();
        var schedule = await identity.WorkflowAsync(code, ct);
        if (!schedule.IsActive || schedule.RegistrationDeadline is null || schedule.TopicDeadline is null || DateTime.UtcNow < schedule.RegistrationDeadline || DateTime.UtcNow >= schedule.TopicDeadline)
            throw new GroupException(409, "Random matching is only available after registration closes and before the topic deadline.");
        var candidates = (await identity.UnmatchedEnrollmentsAsync(code, ct)).OrderBy(x => x.StudentCode).ToList();
        await using var tx = await repository.BeginSerializableTransactionAsync(ct);
        var groups = await repository.OpenGroupsAsync(code, ct);
        var existingIds = groups.SelectMany(x => x.Members).Select(x => x.StudentId).ToHashSet();
        candidates = candidates.Where(x => !existingIds.Contains(x.StudentId)).ToList();
        var required = groups.Sum(x => Math.Max(0, 4 - x.Members.Count));
        if (candidates.Count < required) throw new GroupException(409, "Not enough unmatched students to complete every existing open group to four members.");
        var index = 0; var added = 0;
        foreach (var group in groups.OrderBy(x => x.CreatedAt))
            while (group.Members.Count < 4)
            {
                var member = Member(candidates[index++]);
                group.Members.Add(member);
                repository.AddMember(member);
                added++;
            }
        var remaining = candidates.Count - index;
        var freeSlots = groups.Sum(x => 5 - x.Members.Count);
        var fill = Enumerable.Range(0, Math.Min(freeSlots, remaining)).Reverse().FirstOrDefault(x => IsPartitionable(remaining - x));
        foreach (var group in groups.OrderBy(x => x.CreatedAt))
            while (fill > 0 && group.Members.Count < 5)
            {
                var member = Member(candidates[index++]);
                group.Members.Add(member);
                repository.AddMember(member);
                fill--; added++;
            }
        remaining = candidates.Count - index;
        if (!IsPartitionable(remaining)) throw new GroupException(409, "The remaining students cannot be partitioned into valid groups of four or five.");
        var created = 0;
        foreach (var size in Partition(remaining))
        {
            var rawCode = $"GRP-{code}-{Guid.NewGuid():N}";
            var group = new Group { GroupCode = rawCode[..Math.Min(64, rawCode.Length)], GroupName = $"Nhóm ghép ngẫu nhiên {created + 1}", ProjectDescription = "Nhóm được tạo từ thuật toán ghép ngẫu nhiên.", SemesterCode = code };
            for (var i = 0; i < size; i++) group.Members.Add(Member(candidates[index++]));
            repository.Add(group); created++;
        }
        foreach (var student in candidates) repository.AddOutbox(new GroupEventOutbox { Topic = "student-group-membership-changed", Payload = JsonSerializer.Serialize(new StudentGroupMembershipChangedEvent(student.StudentId, true, DateTime.UtcNow)) });
        await repository.SaveAsync(ct); await tx.CommitAsync(ct);
        return new RandomMatchingResult(added, created, candidates.Count);
    }
    private static GroupMember Member(EnrollmentContext x) => new() { StudentId = x.StudentId, StudentCode = x.StudentCode, FullName = x.FullName, JoinedAt = DateTime.UtcNow };
    private static bool IsPartitionable(int n) => n == 0 || Enumerable.Range(0, n / 5 + 1).Any(fives => (n - 5 * fives) >= 0 && (n - 5 * fives) % 4 == 0);
    private static IEnumerable<int> Partition(int n)
    {
        for (var fives = n / 5; fives >= 0; fives--) if ((n - 5 * fives) % 4 == 0)
        { for (var i = 0; i < fives; i++) yield return 5; for (var i = 0; i < (n - 5 * fives) / 4; i++) yield return 4; yield break; }
    }
}

public sealed class GroupException(int statusCode, string message) : Exception(message) { public int StatusCode { get; } = statusCode; }
