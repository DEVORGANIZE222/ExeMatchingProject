using EXETeamMatching.Mentor.Application.DTOs;
using EXETeamMatching.Mentor.Domain.Entities;

namespace EXETeamMatching.Mentor.Application.Interfaces;

public interface IMentorRepository
{
    Task<MentorUser?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IEnumerable<MentorUser>> GetAllAsync(CancellationToken cancellationToken = default);
}

public interface IMentorService
{
    Task<IEnumerable<MentorResponse>> GetMentorsAsync(CancellationToken cancellationToken = default);
    Task<MentorResponse?> GetMentorByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task RequestMentorAsync(Guid groupId, Guid mentorId, string message, CancellationToken cancellationToken = default);
    Task ProcessDecisionAsync(MentorDecisionDto decision, CancellationToken cancellationToken = default);
}

public interface IMentorQuotaService
{
    Task<bool> CheckQuotaAvailableAsync(Guid mentorId, CancellationToken cancellationToken = default);
}
