using Grpc.Core;
using EXETeamMatching.Mentor.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EXETeamMatching.Mentor.Grpc.Services;

public class MentorGrpcServiceImpl(MentorDbContext db) : MentorGrpcService.MentorGrpcServiceBase
{
    public override async Task<MentorResponse> GetMentor(GetMentorRequest request, ServerCallContext context)
    {
        if (!Guid.TryParse(request.Id, out var mentorId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Mentor id must be a GUID."));

        var mentor = await db.Mentors.AsNoTracking().Include(item => item.Quota)
            .SingleOrDefaultAsync(item => item.Id == mentorId, context.CancellationToken);
        return mentor is null
            ? throw new RpcException(new Status(StatusCode.NotFound, "Mentor not found."))
            : Map(mentor.Id, mentor.UserId, mentor.FullName, mentor.Email, mentor.Department,
                mentor.Quota?.MaxQuota ?? 0, mentor.Quota?.CurrentAssigned ?? 0);
    }

    public override async Task<GetMentorsResponse> GetMentors(GetMentorsRequest request, ServerCallContext context)
    {
        if (request.PageNumber < 1 || request.PageSize is < 1 or > 100)
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Page number or size is invalid."));

        var mentors = db.Mentors.AsNoTracking().Include(item => item.Quota);
        var response = new GetMentorsResponse
        {
            TotalCount = await mentors.CountAsync(context.CancellationToken)
        };
        var page = await mentors.OrderBy(item => item.FullName)
            .Skip((request.PageNumber - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(context.CancellationToken);
        response.Mentors.AddRange(page.Select(item => Map(item.Id, item.UserId, item.FullName, item.Email,
            item.Department, item.Quota?.MaxQuota ?? 0, item.Quota?.CurrentAssigned ?? 0)));
        return response;
    }

    public override async Task<MentorQuotaResponse> GetMentorQuota(GetMentorQuotaRequest request, ServerCallContext context)
    {
        if (!Guid.TryParse(request.MentorId, out var mentorId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Mentor id must be a GUID."));

        var quota = await db.MentorQuotas.AsNoTracking()
            .SingleOrDefaultAsync(item => item.MentorId == mentorId, context.CancellationToken);
        if (quota is null)
            throw new RpcException(new Status(StatusCode.NotFound, "Mentor quota not found."));

        return new MentorQuotaResponse
        {
            MentorId = request.MentorId,
            MaxQuota = quota.MaxQuota,
            CurrentAssigned = quota.CurrentAssigned,
            AvailableQuota = Math.Max(0, quota.MaxQuota - quota.CurrentAssigned)
        };
    }

    private static MentorResponse Map(Guid id, Guid userId, string fullName, string email, string department,
        int maxQuota, int currentAssigned) => new()
    {
        Id = id.ToString(),
        UserId = userId.ToString(),
        FullName = fullName,
        Email = email,
        Department = department,
        MaxQuota = maxQuota,
        CurrentAssigned = currentAssigned
    };
}
