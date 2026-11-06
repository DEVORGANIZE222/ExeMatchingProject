using EXETeamMatching.GroupMatching.Application.DTOs;
using EXETeamMatching.GroupMatching.Application.Interfaces;
using EXETeamMatching.GroupMatching.Application.Services;
using EXETeamMatching.Mentor.Grpc;
using Grpc.Core;

namespace EXETeamMatching.GroupMatching.Api.Clients;

public sealed class MentorGrpcRecommendationClient(MentorGrpcService.MentorGrpcServiceClient client)
    : IMentorRecommendationClient
{
    public async Task<IReadOnlyList<MentorRecommendationDto>> GetAvailableAsync(CancellationToken ct = default)
    {
        try
        {
            var response = await client.GetMentorsAsync(new GetMentorsRequest { PageNumber = 1, PageSize = 100 },
                cancellationToken: ct);
            return response.Mentors
                .Select(item => new MentorRecommendationDto(
                    Guid.TryParse(item.Id, out var id) ? id : Guid.Empty,
                    item.FullName, item.Email, item.Department, item.MaxQuota, item.CurrentAssigned,
                    Math.Max(0, item.MaxQuota - item.CurrentAssigned)))
                .Where(item => item.Id != Guid.Empty && item.AvailableQuota > 0)
                .ToList();
        }
        catch (RpcException ex)
        {
            throw new GroupException(503, $"Mentor recommendation service is unavailable: {ex.Status.Detail}");
        }
    }
}
