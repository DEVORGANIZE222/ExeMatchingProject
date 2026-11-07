using System.Security.Claims;
using EXETeamMatching.Mentor.Application.DTOs;
using EXETeamMatching.Mentor.Domain.Entities;
using EXETeamMatching.Mentor.Infrastructure.Persistence;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EXETeamMatching.Mentor.Api.Controllers;

[ApiController]
[Route("api/mentors/me")]
[Authorize(Roles = "Mentor")]
public class MentorWorkspaceController(MentorDbContext db) : ControllerBase
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
}
