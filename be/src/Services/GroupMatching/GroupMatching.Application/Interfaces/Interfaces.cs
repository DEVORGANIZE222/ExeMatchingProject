using EXETeamMatching.GroupMatching.Application.DTOs;
using EXETeamMatching.GroupMatching.Domain.Entities;

namespace EXETeamMatching.GroupMatching.Application.Interfaces;

public interface IGroupRepository
{
    Task<Group?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IEnumerable<Group>> GetAllAsync(CancellationToken cancellationToken = default);
    Task AddAsync(Group group, CancellationToken cancellationToken = default);
    Task UpdateAsync(Group group, CancellationToken cancellationToken = default);
}

public interface IGroupService
{
    Task<GroupDto> CreateGroupAsync(CreateGroupRequest request, CancellationToken cancellationToken = default);
    Task AddMemberAsync(Guid groupId, AddGroupMemberRequest request, CancellationToken cancellationToken = default);
    Task RemoveMemberAsync(Guid groupId, Guid studentId, CancellationToken cancellationToken = default);
    Task LockGroupAsync(Guid groupId, CancellationToken cancellationToken = default);
}

public interface IMatchingService
{
    Task RandomMatchingAsync(string semesterCode, CancellationToken cancellationToken = default);
}

public interface ILeaderVoteService
{
    Task VoteLeaderAsync(Guid groupId, VoteLeaderRequest request, CancellationToken cancellationToken = default);
}
