using System.Security.Claims;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Data;
using System.Net;
using EXETeamMatching.Mentor.Application.DTOs;
using EXETeamMatching.Mentor.Domain.Entities;
using EXETeamMatching.Mentor.Infrastructure.Persistence;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EXETeamMatching.Mentor.Api.Controllers;

[ApiController]
[Route("api/mentor-requests")]
[Authorize]
public class MentorRequestsController(MentorDbContext db, IHttpClientFactory clients) : ControllerBase
{
    private Guid ActorId => Guid.Parse(User.FindFirstValue("sub")!);

    [HttpPost]
    [Authorize(Roles = "Student")]
    public async Task<ActionResult<ApiResponse<bool>>> RequestMentor([FromBody] CreateMentorRequest request, CancellationToken ct)
    {
        var client = clients.CreateClient("groups");
        using var groupRequest = new HttpRequestMessage(HttpMethod.Get, $"api/groups/{request.GroupId}/mentor-request-context");
        if (Request.Headers.Authorization.Count > 0)
            groupRequest.Headers.Authorization = AuthenticationHeaderValue.Parse(Request.Headers.Authorization!);
        using var groupResponse = await client.SendAsync(groupRequest, ct);
        if (groupResponse.StatusCode == HttpStatusCode.Forbidden)
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<bool>.Fail("Only the elected leader of a valid group can request a mentor."));
        if (groupResponse.StatusCode == HttpStatusCode.NotFound)
            return NotFound(ApiResponse<bool>.Fail("Group not found."));
        if (groupResponse.StatusCode == HttpStatusCode.Conflict)
            return Conflict(ApiResponse<bool>.Fail("A mentor can only be requested for a locked group with a registered topic."));
        if (!groupResponse.IsSuccessStatusCode)
            throw new HttpRequestException($"Group matching service returned {(int)groupResponse.StatusCode} while validating the mentor request.");
        var groupResult = await groupResponse.Content.ReadFromJsonAsync<ApiResponse<GroupRequestContext>>(cancellationToken: ct)
            ?? throw new InvalidOperationException("The group service returned an empty response.");
        var group = groupResult.Data ?? throw new InvalidOperationException("The group service returned no group details.");

        var mentor = await db.Mentors.Include(x => x.Quota).SingleOrDefaultAsync(x => x.Id == request.MentorId, ct)
            ?? throw new KeyNotFoundException("Mentor not found.");
        if (mentor.Quota is null || mentor.Quota.CurrentAssigned >= mentor.Quota.MaxQuota)
            throw new ArgumentException("This mentor is not accepting additional groups.");
        if (await db.MentorRequests.AnyAsync(x => x.GroupId == request.GroupId && x.Status != RequestStatus.Rejected, ct))
            throw new ArgumentException("This group already has a pending or approved mentor request.");

        db.MentorRequests.Add(new MentorRequest
        {
            GroupId = request.GroupId,
            MentorId = request.MentorId,
            RequesterUserId = ActorId,
            GroupName = group.GroupName,
            Topic = group.TopicTitle ?? group.ProjectDescription,
            RequesterName = group.Members.FirstOrDefault(member => member.StudentId == group.LeaderStudentId)?.FullName ?? "Trưởng nhóm",
            Message = request.Message.Trim()
        });
        db.MentorNotifications.Add(new MentorNotification
        {
            MentorId = mentor.Id,
            Type = "request",
            Title = "Yêu cầu hướng dẫn mới",
            Message = $"Nhóm {group.GroupName} vừa gửi lời mời hướng dẫn."
        });
        await db.SaveChangesAsync(ct);
        return Ok(ApiResponse<bool>.Ok(true));
    }

    private sealed record GroupRequestContext(
        Guid Id,
        string GroupName,
        string? TopicTitle,
        string ProjectDescription,
        Guid? LeaderStudentId,
        List<GroupRequestMember> Members);

    private sealed record GroupRequestMember(Guid StudentId, string FullName);

    [HttpGet("groups/{groupId:guid}/status")]
    [Authorize(Roles = "Student")]
    public async Task<ActionResult<ApiResponse<GroupMentorStatusResponse>>> GroupStatus(Guid groupId, CancellationToken ct)
    {
        var client = clients.CreateClient("groups");
        using var groupRequest = new HttpRequestMessage(HttpMethod.Get, $"api/groups/{groupId}/mentor-request-context");
        if (Request.Headers.Authorization.Count > 0)
            groupRequest.Headers.Authorization = AuthenticationHeaderValue.Parse(Request.Headers.Authorization!);

        using var groupResponse = await client.SendAsync(groupRequest, ct);
        if (groupResponse.StatusCode == HttpStatusCode.Forbidden)
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse<GroupMentorStatusResponse>.Fail("Only the elected group leader can view mentor request status."));
        if (groupResponse.StatusCode == HttpStatusCode.NotFound)
            return NotFound(ApiResponse<GroupMentorStatusResponse>.Fail("Group not found."));
        if (groupResponse.StatusCode == HttpStatusCode.Conflict)
            return Conflict(ApiResponse<GroupMentorStatusResponse>.Fail("A mentor can only be requested for a locked group with a registered topic."));
        if (!groupResponse.IsSuccessStatusCode)
            throw new HttpRequestException($"Group matching service returned {(int)groupResponse.StatusCode} while validating mentor request status.");

        var groupResult = await groupResponse.Content.ReadFromJsonAsync<ApiResponse<GroupRequestContext>>(cancellationToken: ct)
            ?? throw new InvalidOperationException("The group service returned an empty response.");
        if (groupResult.Data is null)
            throw new InvalidOperationException("The group service returned no group details.");

        var request = await db.MentorRequests.AsNoTracking()
            .Where(item => item.GroupId == groupId && item.Status != RequestStatus.Rejected)
            .OrderByDescending(item => item.CreatedAt)
            .Select(item => new
            {
                item.Status,
                MentorName = item.Mentor.FullName,
                item.Message,
                item.CreatedAt
            })
            .FirstOrDefaultAsync(ct);

        var status = request is null
            ? new GroupMentorStatusResponse(false, null, null, null, null)
            : new GroupMentorStatusResponse(true, request.Status, request.MentorName, request.Message, request.CreatedAt);
        return Ok(ApiResponse<GroupMentorStatusResponse>.Ok(status));
    }

    [HttpPost("decision")]
    [Authorize(Roles = "Mentor")]
    public async Task<ActionResult<ApiResponse<bool>>> DecisionMentor([FromBody] MentorDecisionDto decision, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var mentor = await db.Mentors.Include(x => x.Quota).SingleOrDefaultAsync(x => x.UserId == ActorId, ct)
            ?? throw new KeyNotFoundException("Mentor profile not found.");
        var request = await db.MentorRequests.SingleOrDefaultAsync(
            x => x.Id == decision.RequestId && x.MentorId == mentor.Id, ct)
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
            db.MentorGroupProgress.Add(new MentorGroupProgress
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

        request.Status = decision.IsAccepted ? RequestStatus.Approved : RequestStatus.Rejected;
        request.DecisionReason = decision.DecisionReason.Trim();
        request.DecidedAt = DateTime.UtcNow;
        request.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Ok(ApiResponse<bool>.Ok(true));
    }

    [HttpGet("mine")]
    [Authorize(Roles = "Mentor")]
    public async Task<ActionResult<ApiResponse<List<MentorRequestDto>>>> Mine(CancellationToken ct)
    {
        var mentorId = await db.Mentors.Where(x => x.UserId == ActorId).Select(x => (Guid?)x.Id).SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Mentor profile not found.");
        var requests = await db.MentorRequests.AsNoTracking().Where(x => x.MentorId == mentorId)
            .OrderByDescending(x => x.CreatedAt).Select(x => new MentorRequestDto(
                x.Id, x.GroupId, x.MentorId, x.Message, x.Status, x.CreatedAt, x.GroupName, x.Topic, x.RequesterName, x.DecisionReason, x.DecidedAt))
            .ToListAsync(ct);
        return Ok(ApiResponse<List<MentorRequestDto>>.Ok(requests));
    }
}
