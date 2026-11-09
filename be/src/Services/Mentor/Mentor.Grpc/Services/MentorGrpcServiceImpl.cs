using Grpc.Core;
using EXETeamMatching.Mentor.Application.DTOs;
using EXETeamMatching.Mentor.Application.Interfaces;

namespace EXETeamMatching.Mentor.Grpc.Services;

public class MentorGrpcServiceImpl(IMentorService mentorService) : MentorGrpcService.MentorGrpcServiceBase
{
    public override async Task<MentorResponse> GetMentor(GetMentorRequest request, ServerCallContext context)
    {
        if (!Guid.TryParse(request.Id, out var mentorId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Mentor id must be a GUID."));

        var mentor = await mentorService.GetMentorByIdAsync(mentorId, context.CancellationToken);
        return mentor is null
            ? throw new RpcException(new Status(StatusCode.NotFound, "Mentor not found."))
            : Map(mentor);
    }

    public override async Task<GetMentorsResponse> GetMentors(GetMentorsRequest request, ServerCallContext context)
    {
        if (request.PageNumber < 1 || request.PageSize is < 1 or > MentorSearchQuery.MaxPageSize)
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Page number or size is invalid."));

        var page = await mentorService.SearchMentorsAsync(
            new MentorSearchQuery { PageIndex = request.PageNumber, PageSize = request.PageSize },
            context.CancellationToken);
        var response = new GetMentorsResponse { TotalCount = page.TotalCount };
        response.Mentors.AddRange(page.Items.Select(Map));
        return response;
    }

    public override async Task<MentorQuotaResponse> GetMentorQuota(GetMentorQuotaRequest request, ServerCallContext context)
    {
        if (!Guid.TryParse(request.MentorId, out var mentorId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Mentor id must be a GUID."));

        var quota = await mentorService.GetMentorQuotaAsync(mentorId, context.CancellationToken)
            ?? throw new RpcException(new Status(StatusCode.NotFound, "Mentor quota not found."));

        return new MentorQuotaResponse
        {
            MentorId = request.MentorId,
            MaxQuota = quota.MaxQuota,
            CurrentAssigned = quota.CurrentAssigned,
            AvailableQuota = Math.Max(0, quota.MaxQuota - quota.CurrentAssigned)
        };
    }

    private static MentorResponse Map(Application.DTOs.MentorResponse mentor) => new()
    {
        Id = mentor.Id.ToString(),
        UserId = mentor.UserId.ToString(),
        FullName = mentor.FullName,
        Email = mentor.Email,
        Department = mentor.Department,
        MaxQuota = mentor.MaxQuota,
        CurrentAssigned = mentor.CurrentAssigned
    };
}
