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

    public async Task<GroupDto> SeedDemoMembersAsync(Guid id, Guid actorUserId, bool isAdmin, CancellationToken ct = default)
    {
        await using var tx = await repository.BeginSerializableTransactionAsync(ct);
        var group = await Group(id, ct);
        if (!isAdmin)
        {
            var actor = await Enrollment(actorUserId, group.SemesterCode, ct);
            if (!group.Members.Any(member => member.StudentId == actor.StudentId))
                throw Forbidden("Only a member of this group can seed demo members.");
        }
        if (group.Status != GroupStatus.Open)
            throw Conflict("Demo members can only be seeded into an open group.");
        if (group.Members.Count >= 5)
            throw Conflict("This group already has the maximum of 5 members.");

        var missingMembers = 5 - group.Members.Count;
        for (var index = 1; index <= missingMembers; index++)
        {
            var member = new GroupMember
            {
                GroupId = group.Id,
                StudentId = Guid.NewGuid(),
                StudentCode = $"DEMO-{Guid.NewGuid():N}"[..13].ToUpperInvariant(),
                FullName = $"Demo Member {index}",
                IsDemo = true,
                JoinedAt = DateTime.UtcNow
            };
            group.Members.Add(member);
            repository.AddMember(member);
        }

        group.UpdatedAt = DateTime.UtcNow;
        await repository.SaveAsync(ct);
        await tx.CommitAsync(ct);
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
        if (!isAdmin && !group.Members.Any(x => x.StudentId == actor!.StudentId) && group.CreatedByStudentId != actor!.StudentId)
            throw Forbidden("Only members of this group can edit its details.");
        group.GroupName = Required(request.GroupName);
        group.ProjectDescription = Required(request.ProjectDescription);
        if (request.TopicTitle is not null)
        {
            var trimmedTopic = request.TopicTitle.Trim();
            if (trimmedTopic.Length > 0 && trimmedTopic.Length < 3)
                throw BadRequest("Topic title must be at least 3 characters.");
            group.TopicTitle = trimmedTopic.Length > 0 ? trimmedTopic : null;
            if (group.Status == GroupStatus.Locked && !string.IsNullOrWhiteSpace(group.TopicTitle))
                group.TopicRegisteredAt ??= DateTime.UtcNow;
        }
        if (group.Status == GroupStatus.Open)
            ApplyRecruitmentNeeds(group, request.RecruitmentNeeds);
        group.UpdatedAt = DateTime.UtcNow;
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

    public async Task<GroupDto> InviteMemberAsync(Guid id, InviteMemberRequest request, Guid actorUserId, bool isAdmin, CancellationToken ct = default)
    {
        var identifier = Required(request.Identifier);
        var group = await Group(id, ct);
        if (!isAdmin)
        {
            var actor = await Enrollment(actorUserId, group.SemesterCode, ct);
            if (!group.Members.Any(x => x.StudentId == actor.StudentId) && group.CreatedByStudentId != actor.StudentId)
                throw Forbidden("Chỉ thành viên trong nhóm mới có thể mời bạn vào nhóm.");
            await RegistrationOpen(group.SemesterCode, ct);
        }
        var target = await identity.LookupEnrollmentAsync(group.SemesterCode, identifier, ct);
        await using var tx = await repository.BeginSerializableTransactionAsync(ct);
        group = await Group(id, ct);
        if (group.Status != GroupStatus.Open) throw Conflict("Nhóm đã khóa, không thể thêm thành viên mới.");
        if (group.Members.Count >= 5) throw Conflict("Nhóm đã đủ tối đa 5 thành viên.");
        if (group.Members.Any(x => x.StudentId == target.StudentId))
            throw Conflict("Sinh viên này đã là thành viên trong nhóm.");
        if (await repository.GetStudentGroupAsync(target.StudentId, group.SemesterCode, ct) is not null)
            throw Conflict("Sinh viên này đã thuộc một nhóm khác trong học kỳ.");
        var member = Member(target);
        group.Members.Add(member);
        repository.AddMember(member);
        group.UpdatedAt = DateTime.UtcNow;
        MembershipEvent(target.StudentId, true);
        await repository.SaveAsync(ct);
        await tx.CommitAsync(ct);
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

    public async Task<GroupDto> VoteAsync(Guid id, VoteLeaderRequest request, Guid actorUserId, CancellationToken ct = default, bool allowDemoVotes = false)
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
        if (allowDemoVotes)
        {
            foreach (var demoMember in group.Members.Where(member => member.IsDemo))
            {
                var demoVote = group.Votes.SingleOrDefault(item => item.VoterStudentId == demoMember.StudentId);
                if (demoVote is null)
                {
                    demoVote = new LeaderVote
                    {
                        GroupId = group.Id,
                        VoterStudentId = demoMember.StudentId,
                        NominatedStudentId = request.NominatedStudentId
                    };
                    group.Votes.Add(demoVote);
                    repository.AddVote(demoVote);
                }
                else
                {
                    demoVote.NominatedStudentId = request.NominatedStudentId;
                    demoVote.VotedAt = DateTime.UtcNow;
                    demoVote.UpdatedAt = DateTime.UtcNow;
                }
            }
        }
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
        group.TopicTitle = Required(request.TopicTitle);
        group.TopicRegisteredAt ??= DateTime.UtcNow;
        group.UpdatedAt = DateTime.UtcNow;
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
    internal static GroupMember Member(EnrollmentContext item) => new()
    {
        StudentId = item.StudentId,
        StudentCode = item.StudentCode,
        FullName = item.FullName,
        Email = item.Email ?? string.Empty,
        Major = item.Major ?? string.Empty,
        JoinedAt = DateTime.UtcNow
    };
    private static GroupDto Map(Group group) => new(group.Id, group.GroupCode, group.GroupName, group.SemesterCode, group.Status,
        group.LeaderStudentId, group.TopicTitle, group.TopicRegisteredAt, group.Members.Count,
        group.Members.OrderBy(x => x.JoinedAt).Select(x => new GroupMemberDto(x.StudentId, x.StudentCode, x.FullName, x.Role, x.JoinedAt, x.IsDemo, x.Email, x.Major)).ToList(),
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
        await identity.WorkflowAsync(code, ct);
        var candidates = (await identity.UnmatchedEnrollmentsAsync(code, ct)).OrderBy(x => x.StudentCode).ToList();
        await using var tx = await repository.BeginSerializableTransactionAsync(ct);
        var groups = await repository.OpenGroupsAsync(code, ct);
        var existingIds = groups.SelectMany(x => x.Members).Select(x => x.StudentId).ToHashSet();
        candidates = candidates.Where(x => !existingIds.Contains(x.StudentId)).ToList();
        if (candidates.Count == 0)
            return new RandomMatchingResult(0, 0, 0);

        var index = 0; var added = 0;
        foreach (var group in groups.OrderBy(x => x.CreatedAt))
            while (index < candidates.Count && group.Members.Count < 4)
            {
                var member = GroupService.Member(candidates[index++]);
                group.Members.Add(member);
                repository.AddMember(member);
                added++;
            }

        var remaining = candidates.Count - index;
        var freeSlots = groups.Sum(x => Math.Max(0, 5 - x.Members.Count));
        var fill = 0;
        if (freeSlots > 0 && remaining > 0)
        {
            var partitionableFill = Enumerable.Range(0, Math.Min(freeSlots, remaining) + 1)
                .Reverse()
                .FirstOrDefault(x => IsPartitionable(remaining - x));
            fill = partitionableFill > 0 || IsPartitionable(remaining)
                ? partitionableFill
                : Math.Min(freeSlots, remaining);
        }
        foreach (var group in groups.OrderBy(x => x.CreatedAt))
            while (fill > 0 && index < candidates.Count && group.Members.Count < 5)
            {
                var member = GroupService.Member(candidates[index++]);
                group.Members.Add(member);
                repository.AddMember(member);
                fill--; added++;
            }

        remaining = candidates.Count - index;
        var created = 0;
        foreach (var size in PartitionAny(remaining))
        {
            var rawCode = $"GRP-{code}-{Guid.NewGuid():N}";
            var group = new Group { GroupCode = rawCode[..Math.Min(64, rawCode.Length)], GroupName = $"Nhóm ghép ngẫu nhiên {created + 1}", ProjectDescription = "Nhóm được tạo từ thuật toán ghép ngẫu nhiên.", SemesterCode = code };
            for (var i = 0; i < size; i++) group.Members.Add(GroupService.Member(candidates[index++]));
            repository.Add(group); created++;
        }
        foreach (var student in candidates) repository.AddOutbox(new GroupEventOutbox { Topic = "student-group-membership-changed", Payload = JsonSerializer.Serialize(new StudentGroupMembershipChangedEvent(student.StudentId, true, DateTime.UtcNow)) });
        await repository.SaveAsync(ct); await tx.CommitAsync(ct);
        return new RandomMatchingResult(added, created, candidates.Count);
    }
    private static bool IsPartitionable(int n) => n == 0 || Enumerable.Range(0, n / 5 + 1).Any(fives => (n - 5 * fives) >= 0 && (n - 5 * fives) % 4 == 0);
    private static IEnumerable<int> Partition(int n)
    {
        for (var fives = n / 5; fives >= 0; fives--) if ((n - 5 * fives) % 4 == 0)
        { for (var i = 0; i < fives; i++) yield return 5; for (var i = 0; i < (n - 5 * fives) / 4; i++) yield return 4; yield break; }
    }
    private static IEnumerable<int> PartitionAny(int n)
    {
        if (n <= 0) yield break;
        if (IsPartitionable(n))
        {
            foreach (var size in Partition(n)) yield return size;
            yield break;
        }
        while (n > 0)
        {
            if (n <= 5) { yield return n; yield break; }
            if (n == 6) { yield return 4; yield return 2; yield break; }
            if (n == 7) { yield return 4; yield return 3; yield break; }
            yield return 5;
            n -= 5;
        }
    }
}

public sealed class GroupException(int statusCode, string message) : Exception(message) { public int StatusCode { get; } = statusCode; }
