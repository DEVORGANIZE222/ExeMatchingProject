using EXETeamMatching.GroupMatching.Application.DTOs;
using EXETeamMatching.GroupMatching.Application.Interfaces;
using EXETeamMatching.GroupMatching.Domain.Enums;

namespace EXETeamMatching.GroupMatching.Application.Services;

/// <summary>
/// Keeps the REST-to-gRPC orchestration in Service 2.  Mentor ownership and
/// quota remain entirely inside Service 3; GroupMatching receives DTOs only.
/// </summary>
public sealed class MentorRecommendationService(IGroupService groups, IMentorRecommendationClient mentors)
    : IMentorRecommendationService
{
    public async Task<IReadOnlyList<MentorRecommendationDto>> GetForGroupAsync(Guid groupId, Guid actorUserId,
        bool isAdmin, CancellationToken ct = default)
    {
        var group = await groups.GetAsync(groupId, actorUserId, isAdmin, ct);
        if (group.Status != GroupStatus.Locked || group.TopicRegisteredAt is null)
            throw new GroupException(409, "Mentor recommendations are available only after a locked group registers its topic.");

        return await mentors.GetAvailableAsync(ct);
    }
}
