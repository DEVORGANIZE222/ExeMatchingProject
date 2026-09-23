using Grpc.Core;

namespace EXETeamMatching.Mentor.Grpc.Services;

public class MentorGrpcServiceImpl : MentorGrpcService.MentorGrpcServiceBase
{
    public override Task<MentorResponse> GetMentor(GetMentorRequest request, ServerCallContext context)
    {
        return Task.FromResult(new MentorResponse
        {
            Id = request.Id,
            UserId = Guid.NewGuid().ToString(),
            FullName = "Dr. Le Van C (gRPC)",
            Email = "clevan@fpt.edu.vn",
            Department = "Software Engineering",
            MaxQuota = 5,
            CurrentAssigned = 1
        });
    }

    public override Task<GetMentorsResponse> GetMentors(GetMentorsRequest request, ServerCallContext context)
    {
        var response = new GetMentorsResponse
        {
            TotalCount = 1
        };
        response.Mentors.Add(new MentorResponse
        {
            Id = Guid.NewGuid().ToString(),
            UserId = Guid.NewGuid().ToString(),
            FullName = "Dr. Le Van C (gRPC)",
            Email = "clevan@fpt.edu.vn",
            Department = "Software Engineering",
            MaxQuota = 5,
            CurrentAssigned = 1
        });
        return Task.FromResult(response);
    }

    public override Task<MentorQuotaResponse> GetMentorQuota(GetMentorQuotaRequest request, ServerCallContext context)
    {
        return Task.FromResult(new MentorQuotaResponse
        {
            MentorId = request.MentorId,
            MaxQuota = 5,
            CurrentAssigned = 1,
            AvailableQuota = 4
        });
    }
}
