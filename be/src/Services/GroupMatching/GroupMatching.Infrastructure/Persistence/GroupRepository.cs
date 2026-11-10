using System.Data;
using EXETeamMatching.GroupMatching.Application.DTOs;
using EXETeamMatching.GroupMatching.Application.Interfaces;
using EXETeamMatching.GroupMatching.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace EXETeamMatching.GroupMatching.Infrastructure.Persistence;

public sealed class GroupRepository(GroupMatchingDbContext db) : IGroupRepository
{
    public Task<Group?> GetByIdAsync(Guid id, CancellationToken ct = default) => db.Groups
        .Include(x => x.Members).Include(x => x.Votes).Include(x => x.RecruitmentNeeds).SingleOrDefaultAsync(x => x.Id == id, ct);

    public async Task<PageResult<GroupDto>> ListAsync(GroupListQuery query, CancellationToken ct = default)
    {
        var semester = query.SemesterCode.Trim().ToUpperInvariant();
        var groups = db.Groups.AsNoTracking().Include(x => x.Members).Include(x => x.RecruitmentNeeds).Where(x => x.SemesterCode == semester);
        if (query.Status.HasValue) groups = groups.Where(x => x.Status == query.Status.Value);
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLower();
            groups = groups.Where(x => x.GroupName.ToLower().Contains(term) ||
                x.ProjectDescription.ToLower().Contains(term) ||
                (x.TopicTitle != null && x.TopicTitle.ToLower().Contains(term)) || x.GroupCode.ToLower().Contains(term));
        }
        var total = await groups.CountAsync(ct);
        var entities = await groups.OrderBy(x => x.CreatedAt).ThenBy(x => x.GroupName).ThenBy(x => x.GroupCode).Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync(ct);
        return new PageResult<GroupDto>(entities.Select(Map).ToList(), total, query.Page, query.PageSize);
    }

    public Task<Group?> GetStudentGroupAsync(Guid studentId, string semesterCode, CancellationToken ct = default) => db.Groups
        .Include(x => x.Members).Include(x => x.Votes).Include(x => x.RecruitmentNeeds)
        .SingleOrDefaultAsync(x => x.SemesterCode == semesterCode && x.Members.Any(m => m.StudentId == studentId), ct);

    public async Task<HashSet<Guid>> GetSemesterMemberIdsAsync(string semesterCode, CancellationToken ct = default)
    {
        var code = semesterCode.Trim().ToUpperInvariant();
        var ids = await db.Groups
            .Where(g => g.SemesterCode == code)
            .SelectMany(g => g.Members.Select(m => m.StudentId))
            .ToListAsync(ct);
        return ids.ToHashSet();
    }

    public Task<List<Group>> OpenGroupsAsync(string semesterCode, CancellationToken ct = default) => db.Groups
        .Include(x => x.Members).Include(x => x.Votes).Include(x => x.RecruitmentNeeds)
        .Where(x => x.SemesterCode == semesterCode && x.Status == Domain.Enums.GroupStatus.Open)
        .OrderBy(x => x.CreatedAt).ToListAsync(ct);

    public Task<int> CountLockedGroupsAsync(string semesterCode, CancellationToken ct = default) => db.Groups
        .CountAsync(x => x.SemesterCode == semesterCode && x.Status == Domain.Enums.GroupStatus.Locked, ct);

    public void Add(Group group) => db.Groups.Add(group);
    public void AddMember(GroupMember member) => db.GroupMembers.Add(member);
    public void AddVote(LeaderVote vote) => db.LeaderVotes.Add(vote);
    public void Remove(Group group) => db.Groups.Remove(group);
    public void RemoveRange(IEnumerable<Group> groups) => db.Groups.RemoveRange(groups);
    public void AddOutbox(GroupEventOutbox item) => db.GroupEventOutbox.Add(item);
    public Task SaveAsync(CancellationToken ct = default) => db.SaveChangesAsync(ct);

    public async Task<IGroupTransaction> BeginSerializableTransactionAsync(CancellationToken ct = default)
        => new EfGroupTransaction(await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct));

    public static GroupDto Map(Group group) => new(group.Id, group.GroupCode, group.GroupName, group.SemesterCode, group.Status,
        group.LeaderStudentId, group.TopicTitle, group.TopicRegisteredAt, group.Members.Count,
        group.Members.OrderBy(x => x.JoinedAt).ThenBy(x => x.Id).Select(m => new GroupMemberDto(m.StudentId, m.StudentCode, m.FullName, m.Role, m.JoinedAt, m.IsDemo, m.Email, m.Major, m.AvatarUrl)).ToList(),
        group.ProjectDescription,
        group.RecruitmentNeeds.OrderBy(x => x.RoleCode).Select(x => new RecruitmentNeedDto(x.RoleCode, x.Slots)).ToList(),
        group.CreatedByStudentId);

    private sealed class EfGroupTransaction(IDbContextTransaction transaction) : IGroupTransaction
    {
        public Task CommitAsync(CancellationToken ct = default) => transaction.CommitAsync(ct);
        public ValueTask DisposeAsync() => transaction.DisposeAsync();
    }
}
