using System.Security.Claims;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using EXETeamMatching.Mentor.Application.DTOs;
using EXETeamMatching.Mentor.Domain.Entities;
using EXETeamMatching.Mentor.Infrastructure.Persistence;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace EXETeamMatching.Mentor.Api.Controllers;

[ApiController]
[Route("api/mentors/me")]
[Authorize(Roles = "Mentor")]
public class MentorWorkspaceController(MentorDbContext db, IHttpClientFactory clients, IConfiguration configuration) : ControllerBase
{
    private Guid ActorId => Guid.Parse(User.FindFirstValue("sub")!);

    [HttpGet("groups")]
    public async Task<ActionResult<ApiResponse<List<MentorProgressResponse>>>> Groups(CancellationToken ct)
    {
        var mentorId = await MentorId(ct);
        var groups = await db.MentorGroupProgress.AsNoTracking().Where(x => x.MentorId == mentorId)
            .OrderBy(x => x.GroupName)
            .Select(x => new MentorProgressResponse(x.GroupId, x.GroupName, x.Topic, x.Milestone, x.Progress, x.Feedback, x.UpdatedAt ?? x.CreatedAt))
            .ToListAsync(ct);
        return Ok(ApiResponse<List<MentorProgressResponse>>.Ok(groups));
    }

    [HttpGet("groups/{groupId:guid}/details")]
    public async Task<ActionResult<ApiResponse<MentorTeamDetailsResponse>>> GroupDetails(Guid groupId, CancellationToken ct)
    {
        var mentorId = await MentorId(ct);
        var isAssigned = await db.MentorGroupProgress.AsNoTracking()
            .AnyAsync(x => x.MentorId == mentorId && x.GroupId == groupId, ct);
        if (!isAssigned)
            throw new KeyNotFoundException("Assigned group not found.");

        var client = clients.CreateClient("groups");
        using var request = new HttpRequestMessage(HttpMethod.Get, $"api/groups/{groupId}");
        if (Request.Headers.Authorization.Count > 0)
            request.Headers.Authorization = AuthenticationHeaderValue.Parse(Request.Headers.Authorization!);

        using var response = await client.SendAsync(request, ct);
        if (response.StatusCode == HttpStatusCode.NotFound)
            return NotFound(ApiResponse<MentorTeamDetailsResponse>.Fail("Assigned group no longer exists."));
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"Group matching service returned {(int)response.StatusCode} while loading mentor team details.");

        var result = await response.Content.ReadFromJsonAsync<ApiResponse<GroupDetailsPayload>>(cancellationToken: ct)
            ?? throw new InvalidOperationException("The group service returned an empty response.");
        var group = result.Data ?? throw new InvalidOperationException("The group service returned no group details.");
        var contacts = await LoadTeamContacts(groupId, group.Members.Select(member => member.StudentId), ct);
        var details = new MentorTeamDetailsResponse(
            group.Id,
            group.GroupCode,
            group.GroupName,
            group.SemesterCode,
            group.Status,
            group.LeaderStudentId,
            group.TopicTitle ?? group.ProjectDescription,
            group.MemberCount,
            5,
            group.Members.Select(member => new MentorTeamMemberResponse(
                member.StudentId,
                member.StudentCode,
                member.FullName,
                member.Role,
                member.JoinedAt,
                member.IsDemo,
                contacts.GetValueOrDefault(member.StudentId, string.Empty))).ToList());
        return Ok(ApiResponse<MentorTeamDetailsResponse>.Ok(details));
    }

    [HttpPut("groups/{groupId:guid}/progress")]
    public async Task<ActionResult<ApiResponse<MentorProgressResponse>>> UpdateProgress(Guid groupId, MentorProgressRequest request, CancellationToken ct)
    {
        var mentorId = await MentorId(ct);
        var group = await db.MentorGroupProgress.SingleOrDefaultAsync(x => x.MentorId == mentorId && x.GroupId == groupId, ct)
            ?? throw new KeyNotFoundException("Assigned group not found.");
        group.Milestone = request.Milestone.Trim();
        group.Progress = request.Progress;
        group.Feedback = request.Feedback.Trim();
        group.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Ok(ApiResponse<MentorProgressResponse>.Ok(ToResponse(group)));
    }

    [HttpGet("appointments")]
    public async Task<ActionResult<ApiResponse<List<MentorAppointmentResponse>>>> Appointments(CancellationToken ct)
    {
        var mentorId = await MentorId(ct);
        var appointments = await db.MentorAppointments.AsNoTracking().Where(x => x.MentorId == mentorId)
            .OrderBy(x => x.StartsAt)
            .Select(x => new MentorAppointmentResponse(x.Id, x.GroupId, x.Title, x.StartsAt, x.Notes))
            .ToListAsync(ct);
        return Ok(ApiResponse<List<MentorAppointmentResponse>>.Ok(appointments));
    }

    [HttpPost("appointments")]
    public async Task<ActionResult<ApiResponse<MentorAppointmentResponse>>> CreateAppointment(MentorAppointmentRequest request, CancellationToken ct)
    {
        var mentorId = await MentorId(ct);
        ValidateAppointment(request);
        await ValidateGroup(mentorId, request.GroupId, ct);
        var appointment = new MentorAppointment
        {
            MentorId = mentorId,
            GroupId = request.GroupId,
            Title = request.Title.Trim(),
            StartsAt = request.StartsAt.ToUniversalTime(),
            Notes = request.Notes.Trim()
        };
        db.MentorAppointments.Add(appointment);
        await db.SaveChangesAsync(ct);
        return Ok(ApiResponse<MentorAppointmentResponse>.Ok(ToResponse(appointment)));
    }

    [HttpPut("appointments/{id:guid}")]
    public async Task<ActionResult<ApiResponse<MentorAppointmentResponse>>> UpdateAppointment(Guid id, MentorAppointmentRequest request, CancellationToken ct)
    {
        var mentorId = await MentorId(ct);
        ValidateAppointment(request);
        await ValidateGroup(mentorId, request.GroupId, ct);
        var appointment = await db.MentorAppointments.SingleOrDefaultAsync(x => x.Id == id && x.MentorId == mentorId, ct)
            ?? throw new KeyNotFoundException("Appointment not found.");
        appointment.GroupId = request.GroupId;
        appointment.Title = request.Title.Trim();
        appointment.StartsAt = request.StartsAt.ToUniversalTime();
        appointment.Notes = request.Notes.Trim();
        appointment.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Ok(ApiResponse<MentorAppointmentResponse>.Ok(ToResponse(appointment)));
    }

    [HttpDelete("appointments/{id:guid}")]
    public async Task<IActionResult> DeleteAppointment(Guid id, CancellationToken ct)
    {
        var mentorId = await MentorId(ct);
        var appointment = await db.MentorAppointments.SingleOrDefaultAsync(x => x.Id == id && x.MentorId == mentorId, ct)
            ?? throw new KeyNotFoundException("Appointment not found.");
        db.MentorAppointments.Remove(appointment);
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("notifications")]
    public async Task<ActionResult<ApiResponse<List<MentorNotificationResponse>>>> Notifications(CancellationToken ct)
    {
        var mentorId = await MentorId(ct);
        var notifications = await db.MentorNotifications.AsNoTracking().Where(x => x.MentorId == mentorId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(100)
            .Select(x => new MentorNotificationResponse(x.Id, x.Type, x.Title, x.Message, x.IsRead, x.CreatedAt))
            .ToListAsync(ct);
        return Ok(ApiResponse<List<MentorNotificationResponse>>.Ok(notifications));
    }

    [HttpPut("notifications/{id:guid}/read")]
    public async Task<IActionResult> MarkNotificationRead(Guid id, CancellationToken ct)
    {
        var mentorId = await MentorId(ct);
        var notification = await db.MentorNotifications.SingleOrDefaultAsync(x => x.Id == id && x.MentorId == mentorId, ct)
            ?? throw new KeyNotFoundException("Notification not found.");
        notification.IsRead = true;
        notification.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPut("notifications/read-all")]
    public async Task<IActionResult> MarkAllNotificationsRead(CancellationToken ct)
    {
        var mentorId = await MentorId(ct);
        await db.MentorNotifications.Where(x => x.MentorId == mentorId && !x.IsRead)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.IsRead, true)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow), ct);
        return NoContent();
    }

    private async Task<Guid> MentorId(CancellationToken ct)
        => await db.Mentors.Where(x => x.UserId == ActorId).Select(x => (Guid?)x.Id).SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Mentor profile not found. Ask an administrator to activate your mentor account.");

    private async Task<Dictionary<Guid, string>> LoadTeamContacts(Guid groupId, IEnumerable<Guid> studentIds, CancellationToken ct)
    {
        var claims = new List<System.Security.Claims.Claim>
        {
            new("sub", User.FindFirstValue("sub") ?? throw new InvalidOperationException("Authenticated mentor subject is missing.")),
            new("role", "Mentor"),
            new("ver", User.FindFirstValue("ver") ?? throw new InvalidOperationException("Authenticated token version is missing.")),
            new("scope", "mentor-team-contacts"),
            new("group_id", groupId.ToString())
        };
        claims.AddRange(studentIds.Distinct().Select(id => new System.Security.Claims.Claim("student_id", id.ToString())));
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

        var client = clients.CreateClient("identity");
        using var request = new HttpRequestMessage(HttpMethod.Get, $"api/internal/mentor-team-contacts?groupId={groupId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", scopedToken);
        using var response = await client.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
            throw new HttpRequestException($"Identity service returned {(int)response.StatusCode} while loading assigned team contacts.");
        var result = await response.Content.ReadFromJsonAsync<ApiResponse<List<MentorTeamContactPayload>>>(cancellationToken: ct)
            ?? throw new InvalidOperationException("Identity service returned an empty team contacts response.");
        return (result.Data ?? throw new InvalidOperationException("Identity service returned no team contacts."))
            .Where(contact => contact.Email.Contains('@'))
            .ToDictionary(contact => contact.StudentId, contact => contact.Email);
    }

    private async Task ValidateGroup(Guid mentorId, Guid? groupId, CancellationToken ct)
    {
        if (groupId.HasValue && !await db.MentorGroupProgress.AnyAsync(
                x => x.MentorId == mentorId && x.GroupId == groupId.Value, ct))
            throw new ArgumentException("Select a group assigned to your mentor account.");
    }

    private static void ValidateAppointment(MentorAppointmentRequest request)
    {
        if (request.StartsAt <= DateTime.UtcNow)
            throw new ArgumentException("Appointment must be scheduled for a future date and time.");
    }

    private static MentorProgressResponse ToResponse(MentorGroupProgress group)
        => new(group.GroupId, group.GroupName, group.Topic, group.Milestone, group.Progress, group.Feedback, group.UpdatedAt ?? group.CreatedAt);

    private static MentorAppointmentResponse ToResponse(MentorAppointment appointment)
        => new(appointment.Id, appointment.GroupId, appointment.Title, appointment.StartsAt, appointment.Notes);

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
        bool IsDemo);

    private sealed record MentorTeamContactPayload(Guid StudentId, string Email);
}
