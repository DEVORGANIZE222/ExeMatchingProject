using System.Data;
using EXETeamMatching.Mentor.Application.DTOs;
using EXETeamMatching.Mentor.Domain.Entities;

namespace EXETeamMatching.Mentor.Application.Interfaces;

/// <summary>Database transaction handle exposed to the application layer.</summary>
public interface IMentorTransaction : IAsyncDisposable
{
    Task CommitAsync(CancellationToken cancellationToken = default);
}

/// <summary>
/// Data access for the Mentor bounded context. Methods suffixed <c>ForUpdate</c> return
/// change-tracked entities; persist them with <see cref="SaveChangesAsync"/>.
/// </summary>
public interface IMentorRepository
{
    // Mentor profiles & quotas
    Task<MentorUser?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<MentorUser?> GetByIdForUpdateAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IEnumerable<MentorUser>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<(IReadOnlyList<MentorUser> Items, int TotalCount)> SearchAsync(
        string? search, string? department, string? expertise, int skip, int take,
        CancellationToken cancellationToken = default);
    Task<MentorUser?> GetByUserIdForUpdateAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<Guid?> GetIdByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<bool> ExistsByUserIdOrEmailAsync(Guid userId, string email, CancellationToken cancellationToken = default);
    Task<MentorQuota?> GetQuotaByMentorIdAsync(Guid mentorId, CancellationToken cancellationToken = default);
    void AddMentor(MentorUser mentor);
    void RemoveMentor(MentorUser mentor);
    Task DeleteMentorWorkspaceDataAsync(Guid mentorId, CancellationToken cancellationToken = default);

    // Mentor requests
    Task<bool> HasActiveRequestForGroupAsync(Guid groupId, CancellationToken cancellationToken = default);
    Task<GroupMentorStatusResponse?> GetLatestActiveRequestStatusAsync(Guid groupId, CancellationToken cancellationToken = default);
    Task<MentorRequest?> GetRequestForUpdateAsync(Guid requestId, Guid mentorId, CancellationToken cancellationToken = default);
    Task<List<MentorRequestDto>> GetRequestsForMentorAsync(Guid mentorId, CancellationToken cancellationToken = default);
    void AddRequest(MentorRequest request);

    // Assigned groups / progress
    Task<List<MentorProgressResponse>> GetGroupProgressListAsync(Guid mentorId, CancellationToken cancellationToken = default);
    Task<bool> IsGroupAssignedAsync(Guid mentorId, Guid groupId, CancellationToken cancellationToken = default);
    Task<MentorGroupProgress?> GetGroupProgressForUpdateAsync(Guid mentorId, Guid groupId, CancellationToken cancellationToken = default);
    void AddGroupProgress(MentorGroupProgress progress);

    // Appointments
    Task<List<MentorAppointmentResponse>> GetAppointmentsAsync(Guid mentorId, CancellationToken cancellationToken = default);
    Task<MentorAppointment?> GetAppointmentForUpdateAsync(Guid id, Guid mentorId, CancellationToken cancellationToken = default);
    void AddAppointment(MentorAppointment appointment);
    void RemoveAppointment(MentorAppointment appointment);

    // Notifications
    Task<List<MentorNotificationResponse>> GetNotificationsAsync(Guid mentorId, int take, CancellationToken cancellationToken = default);
    Task<MentorNotification?> GetNotificationForUpdateAsync(Guid id, Guid mentorId, CancellationToken cancellationToken = default);
    Task MarkAllNotificationsReadAsync(Guid mentorId, CancellationToken cancellationToken = default);
    void AddNotification(MentorNotification notification);

    // Student notifications
    Task<List<StudentNotificationResponse>> GetStudentNotificationsAsync(Guid groupId, int take, CancellationToken cancellationToken = default);
    Task<StudentNotification?> GetStudentNotificationForUpdateAsync(Guid id, Guid groupId, CancellationToken cancellationToken = default);
    Task MarkAllStudentNotificationsReadAsync(Guid groupId, CancellationToken cancellationToken = default);
    void AddStudentNotification(StudentNotification notification);

    // Unit of work
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    Task<IMentorTransaction> BeginTransactionAsync(IsolationLevel isolationLevel, CancellationToken cancellationToken = default);
}

/// <summary>Business operations used by the REST controllers and the gRPC service.</summary>
public interface IMentorService
{
    // Mentor profiles & quotas
    Task<PagedResult<MentorResponse>> SearchMentorsAsync(MentorSearchQuery query, CancellationToken cancellationToken = default);
    Task<MentorResponse?> GetMentorByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<MentorQuotaDto?> GetMentorQuotaAsync(Guid mentorId, CancellationToken cancellationToken = default);
    Task<MentorResponse> CreateMentorAsync(CreateMentorProfileRequest request, CancellationToken cancellationToken = default);
    Task<MentorResponse> UpdateQuotaAsync(Guid id, int maxQuota, CancellationToken cancellationToken = default);
    Task DeleteMentorAsync(Guid id, CancellationToken cancellationToken = default);
    Task<MentorResponse> GetMyProfileAsync(Guid actorUserId, CancellationToken cancellationToken = default);
    Task<MentorResponse> UpdateMyProfileAsync(Guid actorUserId, UpdateMentorProfileRequest request, CancellationToken cancellationToken = default);

    // Mentor requests
    Task RequestMentorAsync(RequestActor actor, CreateMentorRequest request, CancellationToken cancellationToken = default);
    Task<GroupMentorStatusResponse> GetGroupMentorStatusAsync(Guid groupId, string? authorizationHeader, CancellationToken cancellationToken = default);
    Task ProcessDecisionAsync(Guid actorUserId, MentorDecisionDto decision, CancellationToken cancellationToken = default, string? authorizationHeader = null, string? tokenVersion = null);
    Task<List<MentorRequestDto>> GetMyRequestsAsync(Guid actorUserId, CancellationToken cancellationToken = default);

    // Mentor workspace
    Task<List<MentorProgressResponse>> GetMyGroupsAsync(Guid actorUserId, CancellationToken cancellationToken = default);
    Task<MentorTeamDetailsResponse> GetMyGroupDetailsAsync(RequestActor actor, Guid groupId, CancellationToken cancellationToken = default);
    Task<MentorProgressResponse> UpdateGroupProgressAsync(Guid actorUserId, Guid groupId, MentorProgressRequest request, CancellationToken cancellationToken = default);
    Task<List<MentorAppointmentResponse>> GetMyAppointmentsAsync(Guid actorUserId, CancellationToken cancellationToken = default);
    Task<MentorAppointmentResponse> CreateAppointmentAsync(Guid actorUserId, MentorAppointmentRequest request, CancellationToken cancellationToken = default);
    Task<MentorAppointmentResponse> UpdateAppointmentAsync(Guid actorUserId, Guid id, MentorAppointmentRequest request, CancellationToken cancellationToken = default);
    Task DeleteAppointmentAsync(Guid actorUserId, Guid id, CancellationToken cancellationToken = default);
    Task<List<MentorNotificationResponse>> GetMyNotificationsAsync(Guid actorUserId, CancellationToken cancellationToken = default);
    Task MarkNotificationReadAsync(Guid actorUserId, Guid id, CancellationToken cancellationToken = default);
    Task MarkAllNotificationsReadAsync(Guid actorUserId, CancellationToken cancellationToken = default);

    // Student notifications
    Task<List<StudentNotificationResponse>> GetMyGroupNotificationsAsync(RequestActor actor, string? semesterCode, CancellationToken cancellationToken = default);
    Task MarkMyGroupNotificationReadAsync(RequestActor actor, string? semesterCode, Guid id, CancellationToken cancellationToken = default);
    Task MarkAllMyGroupNotificationsReadAsync(RequestActor actor, string? semesterCode, CancellationToken cancellationToken = default);
}

public interface IMentorQuotaService
{
    Task<bool> CheckQuotaAvailableAsync(Guid mentorId, CancellationToken cancellationToken = default);
}
