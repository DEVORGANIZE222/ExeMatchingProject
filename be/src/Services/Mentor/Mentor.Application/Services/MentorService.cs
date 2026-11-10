using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using EXETeamMatching.Contracts.Events;
using EXETeamMatching.Mentor.Application.DTOs;
using EXETeamMatching.Mentor.Application.Exceptions;
using EXETeamMatching.Mentor.Application.Interfaces;
using EXETeamMatching.Mentor.Domain.Entities;
using EXETeamMatching.Messaging.Abstractions;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace EXETeamMatching.Mentor.Application.Services;

public class MentorService(
    IMentorRepository repository,
    IHttpClientFactory clients,
    IConfiguration configuration,
    IEventPublisher publisher,
    ILogger<MentorService> logger) : IMentorService, IMentorQuotaService
{
    public const string GroupsClientName = "groups";
    public const string IdentityClientName = "identity";

    private const string MentorProfileMissingMessage =
        "Mentor profile not found. Ask an administrator to activate your mentor account.";
    private const int TeamCapacity = 5;
    private const int NotificationPageSize = 100;

    // ------------------------------------------------------------------
    // Mentor profiles & quotas
    // ------------------------------------------------------------------

    public async Task<PagedResult<MentorResponse>> SearchMentorsAsync(MentorSearchQuery query, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(query);
        if (query.PageIndex < 1)
            throw new ArgumentException("Page index must be 1 or greater.");
        if (query.PageSize is < 1 or > MentorSearchQuery.MaxPageSize)
            throw new ArgumentException($"Page size must be between 1 and {MentorSearchQuery.MaxPageSize}.");

        var skip = (long)(query.PageIndex - 1) * query.PageSize;
        if (skip > int.MaxValue)
            throw new ArgumentException("Page index is too large.");

        var (items, totalCount) = await repository.SearchAsync(
            Normalize(query.Search),
            Normalize(query.Department),
            Normalize(query.Expertise),
            (int)skip,
            query.PageSize,
            cancellationToken);

        return new PagedResult<MentorResponse>(items.Select(Map).ToList(), totalCount, query.PageIndex, query.PageSize);
    }

    public async Task<MentorResponse?> GetMentorByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var mentor = await repository.GetByIdAsync(id, cancellationToken);
        return mentor is null ? null : Map(mentor);
    }

    public async Task<MentorQuotaDto?> GetMentorQuotaAsync(Guid mentorId, CancellationToken cancellationToken = default)
    {
        var quota = await repository.GetQuotaByMentorIdAsync(mentorId, cancellationToken);
        return quota is null ? null : new MentorQuotaDto(quota.MentorId, quota.MaxQuota, quota.CurrentAssigned);
    }

    public async Task<bool> CheckQuotaAvailableAsync(Guid mentorId, CancellationToken cancellationToken = default)
    {
        var quota = await repository.GetQuotaByMentorIdAsync(mentorId, cancellationToken);
        return quota is not null && quota.CurrentAssigned < quota.MaxQuota;
    }

    public async Task<MentorResponse> CreateMentorAsync(CreateMentorProfileRequest request, CancellationToken cancellationToken = default)
    {
        if (await repository.ExistsByUserIdOrEmailAsync(request.UserId, request.Email, cancellationToken))
            throw new ArgumentException("This account already has a mentor profile.");

        var mentor = new MentorUser
        {
            UserId = request.UserId,
            FullName = request.FullName.Trim(),
            Email = request.Email.Trim().ToLowerInvariant(),
            Department = request.Department.Trim(),
            Expertise = request.Expertise.Trim(),
            Phone = request.Phone.Trim()
        };
        mentor.Quota = new MentorQuota { MentorId = mentor.Id, MaxQuota = request.MaxQuota };
        repository.AddMentor(mentor);
        await repository.SaveChangesAsync(cancellationToken);
        return Map(mentor);
    }

    public async Task<MentorResponse> UpdateQuotaAsync(Guid id, int maxQuota, CancellationToken cancellationToken = default)
    {
        var mentor = await repository.GetByIdForUpdateAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException("Mentor not found.");
        var quota = mentor.Quota ??= new MentorQuota { MentorId = mentor.Id };
        if (maxQuota < quota.CurrentAssigned)
            throw new ArgumentException("Quota cannot be lower than the number of assigned groups.");
        quota.MaxQuota = maxQuota;
        quota.UpdatedAt = DateTime.UtcNow;
        await repository.SaveChangesAsync(cancellationToken);
        return Map(mentor);
    }

    public async Task DeleteMentorAsync(Guid id, CancellationToken cancellationToken = default)
    {
        // Serializable so a concurrent request approval cannot assign a group mid-delete.
        await using var transaction = await repository.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var mentor = await repository.GetByIdForUpdateAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException("Mentor not found.");
        if (mentor.Quota is { CurrentAssigned: > 0 })
            throw new ArgumentException("Cannot delete a mentor who is still assigned to groups.");

        await repository.DeleteMentorWorkspaceDataAsync(mentor.Id, cancellationToken);
        repository.RemoveMentor(mentor);
        await repository.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<MentorResponse> GetMyProfileAsync(Guid actorUserId, CancellationToken cancellationToken = default)
        => Map(await FindMineAsync(actorUserId, cancellationToken));

    public async Task<MentorResponse> UpdateMyProfileAsync(Guid actorUserId, UpdateMentorProfileRequest request, CancellationToken cancellationToken = default)
    {
        var mentor = await FindMineAsync(actorUserId, cancellationToken);
        mentor.FullName = request.FullName.Trim();
        mentor.Department = request.Department.Trim();
        mentor.Expertise = request.Expertise.Trim();
        mentor.Phone = request.Phone.Trim();
        mentor.UpdatedAt = DateTime.UtcNow;
        await repository.SaveChangesAsync(cancellationToken);
        return Map(mentor);
    }

    // ------------------------------------------------------------------
    // Mentor requests
    // ------------------------------------------------------------------

    public async Task RequestMentorAsync(RequestActor actor, CreateMentorRequest request, CancellationToken cancellationToken = default)
    {
        var group = await GetGroupRequestContextAsync(
            request.GroupId,
            actor.AuthorizationHeader,
            "Only the elected leader of a valid group can request a mentor.",
            "while validating the mentor request",
            cancellationToken);

        var mentor = await repository.GetByIdForUpdateAsync(request.MentorId, cancellationToken)
            ?? throw new KeyNotFoundException("Mentor not found.");
        if (mentor.Quota is null || mentor.Quota.CurrentAssigned >= mentor.Quota.MaxQuota)
            throw new ArgumentException("This mentor is not accepting additional groups.");
        if (await repository.HasActiveRequestForGroupAsync(request.GroupId, cancellationToken))
            throw new ArgumentException("This group already has a pending or approved mentor request.");

        var leaderMember = group.Members.FirstOrDefault(member => member.StudentId == group.LeaderStudentId);
        var requesterEmail = !string.IsNullOrWhiteSpace(actor.Email)
            ? actor.Email.Trim()
            : (leaderMember?.Email?.Trim() ?? string.Empty);

        var mentorRequest = new MentorRequest
        {
            GroupId = request.GroupId,
            MentorId = request.MentorId,
            RequesterUserId = actor.UserId,
            RequesterEmail = Truncate(requesterEmail, 254),
            GroupName = group.GroupName,
            Topic = group.TopicTitle ?? group.ProjectDescription,
            RequesterName = leaderMember?.FullName ?? "Trưởng nhóm",
            Message = request.Message.Trim()
        };
        repository.AddRequest(mentorRequest);
        repository.AddNotification(new MentorNotification
        {
            MentorId = mentor.Id,
            Type = "request",
            Title = "Yêu cầu hướng dẫn mới",
            Message = $"Nhóm {group.GroupName} vừa gửi lời mời hướng dẫn."
        });
        await repository.SaveChangesAsync(cancellationToken);

        try
        {
            var mentorEvent = new MentorRequestedEvent(
                RequestId: mentorRequest.Id,
                GroupId: mentorRequest.GroupId,
                MentorId: mentorRequest.MentorId,
                Message: mentorRequest.Message,
                RequestedAt: mentorRequest.CreatedAt,
                MentorEmail: mentor.Email,
                RequesterEmail: string.IsNullOrWhiteSpace(requesterEmail) ? null : requesterEmail,
                GroupName: group.GroupName,
                Topic: mentorRequest.Topic
            );
            await publisher.PublishAsync("mentor-requested", mentorRequest.Id.ToString(), mentorEvent, cancellationToken);
            logger.LogInformation("Published mentor-requested event for RequestId {RequestId} to Kafka", mentorRequest.Id);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to publish mentor-requested event to Kafka");
        }
    }

    public async Task<GroupMentorStatusResponse> GetGroupMentorStatusAsync(Guid groupId, string? authorizationHeader, CancellationToken cancellationToken = default)
    {
        await GetGroupRequestContextAsync(
            groupId,
            authorizationHeader,
            "Only the elected group leader can view mentor request status.",
            "while validating mentor request status",
            cancellationToken);

        return await repository.GetLatestActiveRequestStatusAsync(groupId, cancellationToken)
            ?? new GroupMentorStatusResponse(false, null, null, null, null);
    }

    public async Task ProcessDecisionAsync(Guid actorUserId, MentorDecisionDto decision, CancellationToken cancellationToken = default, string? authorizationHeader = null)
    {
        await using var transaction = await repository.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var mentor = await repository.GetByUserIdForUpdateAsync(actorUserId, cancellationToken)
            ?? throw new KeyNotFoundException("Mentor profile not found.");
        var request = await repository.GetRequestForUpdateAsync(decision.RequestId, mentor.Id, cancellationToken)
            ?? throw new KeyNotFoundException("Mentor request not found.");
        if (request.Status != RequestStatus.Pending)
            throw new ArgumentException("This mentor request has already been decided.");

        if (decision.IsAccepted)
        {
            var quota = mentor.Quota ?? throw new ArgumentException("Mentor quota is not configured.");
            if (quota.CurrentAssigned >= quota.MaxQuota)
                throw new ArgumentException("Your assigned-group quota is full.");
            quota.CurrentAssigned++;
            quota.UpdatedAt = DateTime.UtcNow;
            repository.AddGroupProgress(new MentorGroupProgress
            {
                MentorId = mentor.Id,
                GroupId = request.GroupId,
                GroupName = request.GroupName,
                Topic = request.Topic,
                Milestone = "Khởi động dự án",
                Progress = 0,
                Feedback = decision.DecisionReason.Trim()
            });
        }

        var decisionReason = decision.DecisionReason.Trim();
        request.Status = decision.IsAccepted ? RequestStatus.Approved : RequestStatus.Rejected;
        request.DecisionReason = decisionReason;
        request.DecidedAt = DateTime.UtcNow;
        request.UpdatedAt = DateTime.UtcNow;
        repository.AddStudentNotification(new StudentNotification
        {
            GroupId = request.GroupId,
            RequestId = request.Id,
            MentorName = Truncate(mentor.FullName, 200),
            GroupName = Truncate(request.GroupName, 200),
            Type = decision.IsAccepted ? "decision-approved" : "decision-rejected",
            Title = Truncate(decision.IsAccepted
                ? $"GVHD {mentor.FullName} đã chấp thuận hướng dẫn"
                : $"GVHD {mentor.FullName} đã từ chối lời mời", 200),
            Message = Truncate(decision.IsAccepted
                ? (string.IsNullOrWhiteSpace(decisionReason)
                    ? $"Giảng viên {mentor.FullName} đã đồng ý hướng dẫn nhóm {request.GroupName}."
                    : $"Lời nhắn từ giảng viên: {decisionReason}")
                : (string.IsNullOrWhiteSpace(decisionReason)
                    ? $"Giảng viên {mentor.FullName} đã từ chối yêu cầu hướng dẫn của nhóm {request.GroupName}."
                    : $"Lý do từ chối: {decisionReason}"), 2500)
        });
        await repository.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var resolvedRequesterEmail = !string.IsNullOrWhiteSpace(request.RequesterEmail)
            ? request.RequesterEmail.Trim()
            : await TryResolveGroupLeaderEmailAsync(request.GroupId, authorizationHeader, cancellationToken);

        try
        {
            var decisionEvent = new MentorDecisionEvent(
                RequestId: request.Id,
                GroupId: request.GroupId,
                MentorId: request.MentorId,
                IsAccepted: decision.IsAccepted,
                DecisionReason: request.DecisionReason,
                DecidedAt: request.DecidedAt.Value,
                RequesterEmail: string.IsNullOrWhiteSpace(resolvedRequesterEmail) ? null : resolvedRequesterEmail,
                MentorEmail: mentor.Email,
                GroupName: request.GroupName,
                MentorName: mentor.FullName
            );
            await publisher.PublishAsync("mentor-decision", request.Id.ToString(), decisionEvent, cancellationToken);
            logger.LogInformation("Published mentor-decision event for RequestId {RequestId} to Kafka", request.Id);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to publish mentor-decision event to Kafka");
        }
    }

    public async Task<List<MentorRequestDto>> GetMyRequestsAsync(Guid actorUserId, CancellationToken cancellationToken = default)
    {
        var mentorId = await repository.GetIdByUserIdAsync(actorUserId, cancellationToken)
            ?? throw new KeyNotFoundException("Mentor profile not found.");
        return await repository.GetRequestsForMentorAsync(mentorId, cancellationToken);
    }

    // ------------------------------------------------------------------
    // Mentor workspace
    // ------------------------------------------------------------------

    public async Task<List<MentorProgressResponse>> GetMyGroupsAsync(Guid actorUserId, CancellationToken cancellationToken = default)
        => await repository.GetGroupProgressListAsync(await MentorIdAsync(actorUserId, cancellationToken), cancellationToken);

    public async Task<MentorTeamDetailsResponse> GetMyGroupDetailsAsync(RequestActor actor, Guid groupId, CancellationToken cancellationToken = default)
    {
        var mentorId = await MentorIdAsync(actor.UserId, cancellationToken);
        if (!await repository.IsGroupAssignedAsync(mentorId, groupId, cancellationToken))
            throw new KeyNotFoundException("Assigned group not found.");

        var client = clients.CreateClient(GroupsClientName);
        using var request = new HttpRequestMessage(HttpMethod.Get, $"api/groups/{groupId}");
        ApplyAuthorization(request, actor.AuthorizationHeader);

        using var response = await client.SendAsync(request, cancellationToken);
        if (response.StatusCode == HttpStatusCode.NotFound)
            throw new GroupValidationException(GroupValidationFailure.NotFound, "Assigned group no longer exists.");
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"Group matching service returned {(int)response.StatusCode} while loading mentor team details.");

        var result = await response.Content.ReadFromJsonAsync<ApiResponse<GroupDetailsPayload>>(cancellationToken: cancellationToken)
            ?? throw new InvalidOperationException("The group service returned an empty response.");
        var group = result.Data ?? throw new InvalidOperationException("The group service returned no group details.");
        var contacts = await LoadTeamContactsAsync(actor, groupId, group.Members.Select(member => member.StudentId), cancellationToken);

        return new MentorTeamDetailsResponse(
            group.Id,
            group.GroupCode,
            group.GroupName,
            group.SemesterCode,
            group.Status,
            group.LeaderStudentId,
            group.TopicTitle ?? group.ProjectDescription,
            group.MemberCount,
            TeamCapacity,
            group.Members.Select(member => new MentorTeamMemberResponse(
                member.StudentId,
                member.StudentCode,
                member.FullName,
                member.Role,
                member.JoinedAt,
                member.IsDemo,
                contacts.GetValueOrDefault(member.StudentId, string.Empty))).ToList());
    }

    public async Task<MentorProgressResponse> UpdateGroupProgressAsync(Guid actorUserId, Guid groupId, MentorProgressRequest request, CancellationToken cancellationToken = default)
    {
        var mentor = await FindMineAsync(actorUserId, cancellationToken);
        var group = await repository.GetGroupProgressForUpdateAsync(mentor.Id, groupId, cancellationToken)
            ?? throw new KeyNotFoundException("Assigned group not found.");
        group.Milestone = request.Milestone.Trim();
        group.Progress = request.Progress;
        group.Feedback = request.Feedback.Trim();
        group.UpdatedAt = DateTime.UtcNow;
        repository.AddStudentNotification(new StudentNotification
        {
            GroupId = groupId,
            MentorName = Truncate(mentor.FullName, 200),
            GroupName = Truncate(group.GroupName, 200),
            Type = "progress-feedback",
            Title = Truncate($"GVHD {mentor.FullName} cập nhật tiến độ ({group.Progress}%)", 200),
            Message = Truncate(string.IsNullOrWhiteSpace(group.Feedback)
                ? $"Mốc hiện tại: {group.Milestone}."
                : $"Mốc \"{group.Milestone}\": {group.Feedback}", 2500)
        });
        await repository.SaveChangesAsync(cancellationToken);
        return ToResponse(group);
    }

    public async Task<List<MentorAppointmentResponse>> GetMyAppointmentsAsync(Guid actorUserId, CancellationToken cancellationToken = default)
        => await repository.GetAppointmentsAsync(await MentorIdAsync(actorUserId, cancellationToken), cancellationToken);

    public async Task<MentorAppointmentResponse> CreateAppointmentAsync(Guid actorUserId, MentorAppointmentRequest request, CancellationToken cancellationToken = default)
    {
        var mentorId = await MentorIdAsync(actorUserId, cancellationToken);
        ValidateAppointment(request);
        await ValidateGroupAsync(mentorId, request.GroupId, cancellationToken);
        var appointment = new MentorAppointment
        {
            MentorId = mentorId,
            GroupId = request.GroupId,
            Title = request.Title.Trim(),
            StartsAt = request.StartsAt.ToUniversalTime(),
            Notes = request.Notes.Trim()
        };
        repository.AddAppointment(appointment);
        await repository.SaveChangesAsync(cancellationToken);
        return ToResponse(appointment);
    }

    public async Task<MentorAppointmentResponse> UpdateAppointmentAsync(Guid actorUserId, Guid id, MentorAppointmentRequest request, CancellationToken cancellationToken = default)
    {
        var mentorId = await MentorIdAsync(actorUserId, cancellationToken);
        ValidateAppointment(request);
        await ValidateGroupAsync(mentorId, request.GroupId, cancellationToken);
        var appointment = await repository.GetAppointmentForUpdateAsync(id, mentorId, cancellationToken)
            ?? throw new KeyNotFoundException("Appointment not found.");
        appointment.GroupId = request.GroupId;
        appointment.Title = request.Title.Trim();
        appointment.StartsAt = request.StartsAt.ToUniversalTime();
        appointment.Notes = request.Notes.Trim();
        appointment.UpdatedAt = DateTime.UtcNow;
        await repository.SaveChangesAsync(cancellationToken);
        return ToResponse(appointment);
    }

    public async Task DeleteAppointmentAsync(Guid actorUserId, Guid id, CancellationToken cancellationToken = default)
    {
        var mentorId = await MentorIdAsync(actorUserId, cancellationToken);
        var appointment = await repository.GetAppointmentForUpdateAsync(id, mentorId, cancellationToken)
            ?? throw new KeyNotFoundException("Appointment not found.");
        repository.RemoveAppointment(appointment);
        await repository.SaveChangesAsync(cancellationToken);
    }

    public async Task<List<MentorNotificationResponse>> GetMyNotificationsAsync(Guid actorUserId, CancellationToken cancellationToken = default)
        => await repository.GetNotificationsAsync(await MentorIdAsync(actorUserId, cancellationToken), NotificationPageSize, cancellationToken);

    public async Task MarkNotificationReadAsync(Guid actorUserId, Guid id, CancellationToken cancellationToken = default)
    {
        var mentorId = await MentorIdAsync(actorUserId, cancellationToken);
        var notification = await repository.GetNotificationForUpdateAsync(id, mentorId, cancellationToken)
            ?? throw new KeyNotFoundException("Notification not found.");
        notification.IsRead = true;
        notification.UpdatedAt = DateTime.UtcNow;
        await repository.SaveChangesAsync(cancellationToken);
    }

    public async Task MarkAllNotificationsReadAsync(Guid actorUserId, CancellationToken cancellationToken = default)
        => await repository.MarkAllNotificationsReadAsync(await MentorIdAsync(actorUserId, cancellationToken), cancellationToken);

    // ------------------------------------------------------------------
    // Student notifications (responses from mentors)
    // ------------------------------------------------------------------

    public async Task<List<StudentNotificationResponse>> GetMyGroupNotificationsAsync(
        RequestActor actor, string? semesterCode, CancellationToken cancellationToken = default)
    {
        var groupId = await ResolveStudentGroupIdAsync(actor.AuthorizationHeader, semesterCode, cancellationToken);
        return groupId is null
            ? []
            : await repository.GetStudentNotificationsAsync(groupId.Value, NotificationPageSize, cancellationToken);
    }

    public async Task MarkMyGroupNotificationReadAsync(
        RequestActor actor, string? semesterCode, Guid id, CancellationToken cancellationToken = default)
    {
        var groupId = await ResolveStudentGroupIdAsync(actor.AuthorizationHeader, semesterCode, cancellationToken)
            ?? throw new KeyNotFoundException("Notification not found.");
        var notification = await repository.GetStudentNotificationForUpdateAsync(id, groupId, cancellationToken)
            ?? throw new KeyNotFoundException("Notification not found.");
        notification.IsRead = true;
        notification.UpdatedAt = DateTime.UtcNow;
        await repository.SaveChangesAsync(cancellationToken);
    }

    public async Task MarkAllMyGroupNotificationsReadAsync(
        RequestActor actor, string? semesterCode, CancellationToken cancellationToken = default)
    {
        var groupId = await ResolveStudentGroupIdAsync(actor.AuthorizationHeader, semesterCode, cancellationToken);
        if (groupId is null) return;
        await repository.MarkAllStudentNotificationsReadAsync(groupId.Value, cancellationToken);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private async Task<MentorUser> FindMineAsync(Guid actorUserId, CancellationToken cancellationToken)
        => await repository.GetByUserIdForUpdateAsync(actorUserId, cancellationToken)
            ?? throw new KeyNotFoundException(MentorProfileMissingMessage);

    private async Task<Guid> MentorIdAsync(Guid actorUserId, CancellationToken cancellationToken)
        => await repository.GetIdByUserIdAsync(actorUserId, cancellationToken)
            ?? throw new KeyNotFoundException(MentorProfileMissingMessage);

    private async Task ValidateGroupAsync(Guid mentorId, Guid? groupId, CancellationToken cancellationToken)
    {
        if (groupId.HasValue && !await repository.IsGroupAssignedAsync(mentorId, groupId.Value, cancellationToken))
            throw new ArgumentException("Select a group assigned to your mentor account.");
    }

    private static void ValidateAppointment(MentorAppointmentRequest request)
    {
        if (request.StartsAt <= DateTime.UtcNow)
            throw new ArgumentException("Appointment must be scheduled for a future date and time.");
    }

    /// <summary>
    /// Asks GroupMatching whether the caller may request a mentor for the group
    /// (elected leader, locked group, registered topic) and returns the group context.
    /// </summary>
    private async Task<GroupRequestContext> GetGroupRequestContextAsync(
        Guid groupId,
        string? authorizationHeader,
        string forbiddenMessage,
        string operation,
        CancellationToken cancellationToken)
    {
        var client = clients.CreateClient(GroupsClientName);
        using var groupRequest = new HttpRequestMessage(HttpMethod.Get, $"api/groups/{groupId}/mentor-request-context");
        ApplyAuthorization(groupRequest, authorizationHeader);

        using var groupResponse = await client.SendAsync(groupRequest, cancellationToken);
        if (groupResponse.StatusCode == HttpStatusCode.Forbidden)
            throw new GroupValidationException(GroupValidationFailure.Forbidden, forbiddenMessage);
        if (groupResponse.StatusCode == HttpStatusCode.NotFound)
            throw new GroupValidationException(GroupValidationFailure.NotFound, "Group not found.");
        if (groupResponse.StatusCode == HttpStatusCode.Conflict)
            throw new GroupValidationException(GroupValidationFailure.Conflict, "A mentor can only be requested for a locked group with a registered topic.");
        if (!groupResponse.IsSuccessStatusCode)
            throw new HttpRequestException($"Group matching service returned {(int)groupResponse.StatusCode} {operation}.");

        var groupResult = await groupResponse.Content.ReadFromJsonAsync<ApiResponse<GroupRequestContext>>(cancellationToken: cancellationToken)
            ?? throw new InvalidOperationException("The group service returned an empty response.");
        return groupResult.Data ?? throw new InvalidOperationException("The group service returned no group details.");
    }

    private async Task<Guid?> ResolveStudentGroupIdAsync(
        string? authorizationHeader, string? semesterCode, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(semesterCode))
            return null;

        var client = clients.CreateClient(GroupsClientName);
        using var groupRequest = new HttpRequestMessage(
            HttpMethod.Get,
            $"api/groups/my?semesterCode={Uri.EscapeDataString(semesterCode.Trim())}");
        ApplyAuthorization(groupRequest, authorizationHeader);

        using var groupResponse = await client.SendAsync(groupRequest, cancellationToken);
        if (groupResponse.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest)
            return null;
        if (groupResponse.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
            throw new GroupValidationException(GroupValidationFailure.Forbidden, "Only members of a group can view group notifications.");
        if (!groupResponse.IsSuccessStatusCode)
            throw new HttpRequestException($"Group matching service returned {(int)groupResponse.StatusCode} while resolving student group.");

        var groupResult = await groupResponse.Content.ReadFromJsonAsync<ApiResponse<StudentGroupPayload?>>(cancellationToken: cancellationToken);
        return groupResult?.Data?.Id;
    }

    private async Task<string?> TryResolveGroupLeaderEmailAsync(
        Guid groupId, string? authorizationHeader, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(authorizationHeader))
            return null;

        try
        {
            var client = clients.CreateClient(GroupsClientName);
            using var groupRequest = new HttpRequestMessage(HttpMethod.Get, $"api/groups/{groupId}");
            ApplyAuthorization(groupRequest, authorizationHeader);

            using var response = await client.SendAsync(groupRequest, cancellationToken);
            if (!response.IsSuccessStatusCode)
                return null;

            var payload = await response.Content.ReadFromJsonAsync<ApiResponse<GroupDetailsPayload>>(cancellationToken: cancellationToken);
            var group = payload?.Data;
            if (group is null || group.Members is null)
                return null;

            var leader = group.Members.FirstOrDefault(m => m.StudentId == group.LeaderStudentId)
                ?? group.Members.FirstOrDefault(m => !m.IsDemo && !string.IsNullOrWhiteSpace(m.Email));
            return !string.IsNullOrWhiteSpace(leader?.Email) && leader.Email.Contains('@')
                ? leader.Email.Trim()
                : null;
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Could not fallback-resolve leader email for group {GroupId}", groupId);
            return null;
        }
    }

    /// <summary>
    /// Mints a one-minute token scoped to this group's students and loads their contact
    /// emails from IdentitySemester's internal endpoint.
    /// </summary>
    private async Task<Dictionary<Guid, string>> LoadTeamContactsAsync(
        RequestActor actor, Guid groupId, IEnumerable<Guid> studentIds, CancellationToken cancellationToken)
    {
        var claims = new List<Claim>
        {
            new("sub", actor.UserId.ToString()),
            new("role", "Mentor"),
            new("ver", actor.TokenVersion ?? throw new InvalidOperationException("Authenticated token version is missing.")),
            new("scope", "mentor-team-contacts"),
            new("group_id", groupId.ToString())
        };
        claims.AddRange(studentIds.Distinct().Select(id => new Claim("student_id", id.ToString())));
        var secret = configuration["JwtSettings:Secret"]
            ?? throw new InvalidOperationException("JWT signing secret is not configured.");
        var issuer = configuration["JwtSettings:Issuer"] ?? "EXETeamMatching";
        var audience = configuration["JwtSettings:Audience"] ?? "EXETeamMatchingClients";
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret)),
            SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer,
            audience,
            claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddMinutes(1),
            signingCredentials: credentials);
        var scopedToken = new JwtSecurityTokenHandler().WriteToken(token);

        var client = clients.CreateClient(IdentityClientName);
        using var request = new HttpRequestMessage(HttpMethod.Get, $"api/internal/mentor-team-contacts?groupId={groupId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", scopedToken);
        using var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"Identity service returned {(int)response.StatusCode} while loading assigned team contacts.");
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<List<MentorTeamContactPayload>>>(cancellationToken: cancellationToken)
            ?? throw new InvalidOperationException("Identity service returned an empty team contacts response.");
        return (result.Data ?? throw new InvalidOperationException("Identity service returned no team contacts."))
            .Where(contact => contact.Email.Contains('@'))
            .ToDictionary(contact => contact.StudentId, contact => contact.Email);
    }

    private static void ApplyAuthorization(HttpRequestMessage request, string? authorizationHeader)
    {
        if (!string.IsNullOrEmpty(authorizationHeader))
            request.Headers.Authorization = AuthenticationHeaderValue.Parse(authorizationHeader);
    }

    private static string? Normalize(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string Truncate(string value, int maxLength)
        => value.Length <= maxLength ? value : value[..maxLength];

    private static MentorResponse Map(MentorUser mentor) => new(
        mentor.Id,
        mentor.UserId,
        mentor.FullName,
        mentor.Email,
        mentor.Department,
        mentor.Expertise,
        mentor.Phone,
        mentor.Quota?.MaxQuota ?? 0,
        mentor.Quota?.CurrentAssigned ?? 0);

    private static MentorProgressResponse ToResponse(MentorGroupProgress group)
        => new(group.GroupId, group.GroupName, group.Topic, group.Milestone, group.Progress, group.Feedback, group.UpdatedAt ?? group.CreatedAt);

    private static MentorAppointmentResponse ToResponse(MentorAppointment appointment)
        => new(appointment.Id, appointment.GroupId, appointment.Title, appointment.StartsAt, appointment.Notes);

    private sealed record GroupRequestContext(
        Guid Id,
        string GroupName,
        string? TopicTitle,
        string ProjectDescription,
        Guid? LeaderStudentId,
        List<GroupRequestMember> Members);

    private sealed record GroupRequestMember(Guid StudentId, string FullName, string? Email = null);

    private sealed record GroupDetailsPayload(
        Guid Id,
        string GroupCode,
        string GroupName,
        string SemesterCode,
        int Status,
        Guid? LeaderStudentId,
        string? TopicTitle,
        int MemberCount,
        List<GroupMemberPayload> Members,
        string ProjectDescription);

    private sealed record GroupMemberPayload(
        Guid StudentId,
        string StudentCode,
        string FullName,
        int Role,
        DateTime JoinedAt,
        bool IsDemo,
        string? Email = null);

    private sealed record MentorTeamContactPayload(Guid StudentId, string Email);
    private sealed record StudentGroupPayload(Guid Id);
}
