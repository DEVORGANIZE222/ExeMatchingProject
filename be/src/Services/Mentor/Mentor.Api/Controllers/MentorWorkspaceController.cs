using EXETeamMatching.Mentor.Application.DTOs;
using EXETeamMatching.Mentor.Application.Exceptions;
using EXETeamMatching.Mentor.Application.Interfaces;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.Mentor.Api.Controllers;

[ApiController]
[Route("api/mentors/me")]
[Authorize(Roles = "Mentor")]
public class MentorWorkspaceController(IMentorService mentorService) : ControllerBase
{
    [HttpGet("groups")]
    public async Task<ActionResult<ApiResponse<List<MentorProgressResponse>>>> Groups(CancellationToken ct)
        => Ok(ApiResponse<List<MentorProgressResponse>>.Ok(await mentorService.GetMyGroupsAsync(this.ActorId(), ct, this.ActorEmail())));

    [HttpGet("groups/{groupId:guid}/details")]
    public async Task<ActionResult<ApiResponse<MentorTeamDetailsResponse>>> GroupDetails(Guid groupId, CancellationToken ct)
    {
        try
        {
            var details = await mentorService.GetMyGroupDetailsAsync(this.Actor(), groupId, ct);
            return Ok(ApiResponse<MentorTeamDetailsResponse>.Ok(details));
        }
        catch (GroupValidationException ex)
        {
            return this.GroupValidationResult<MentorTeamDetailsResponse>(ex);
        }
    }

    [HttpPut("groups/{groupId:guid}/progress")]
    public async Task<ActionResult<ApiResponse<MentorProgressResponse>>> UpdateProgress(Guid groupId, MentorProgressRequest request, CancellationToken ct)
        => Ok(ApiResponse<MentorProgressResponse>.Ok(await mentorService.UpdateGroupProgressAsync(this.ActorId(), groupId, request, ct, this.ActorEmail())));

    [HttpGet("appointments")]
    public async Task<ActionResult<ApiResponse<List<MentorAppointmentResponse>>>> Appointments(CancellationToken ct)
        => Ok(ApiResponse<List<MentorAppointmentResponse>>.Ok(await mentorService.GetMyAppointmentsAsync(this.ActorId(), ct, this.ActorEmail())));

    [HttpPost("appointments")]
    public async Task<ActionResult<ApiResponse<MentorAppointmentResponse>>> CreateAppointment(MentorAppointmentRequest request, CancellationToken ct)
        => Ok(ApiResponse<MentorAppointmentResponse>.Ok(await mentorService.CreateAppointmentAsync(this.ActorId(), request, ct, this.ActorEmail())));

    [HttpPut("appointments/{id:guid}")]
    public async Task<ActionResult<ApiResponse<MentorAppointmentResponse>>> UpdateAppointment(Guid id, MentorAppointmentRequest request, CancellationToken ct)
        => Ok(ApiResponse<MentorAppointmentResponse>.Ok(await mentorService.UpdateAppointmentAsync(this.ActorId(), id, request, ct, this.ActorEmail())));

    [HttpDelete("appointments/{id:guid}")]
    public async Task<IActionResult> DeleteAppointment(Guid id, CancellationToken ct)
    {
        await mentorService.DeleteAppointmentAsync(this.ActorId(), id, ct, this.ActorEmail());
        return NoContent();
    }

    [HttpGet("notifications")]
    public async Task<ActionResult<ApiResponse<List<MentorNotificationResponse>>>> Notifications(CancellationToken ct)
        => Ok(ApiResponse<List<MentorNotificationResponse>>.Ok(await mentorService.GetMyNotificationsAsync(this.ActorId(), ct, this.ActorEmail())));

    [HttpPut("notifications/{id:guid}/read")]
    public async Task<IActionResult> MarkNotificationRead(Guid id, CancellationToken ct)
    {
        await mentorService.MarkNotificationReadAsync(this.ActorId(), id, ct, this.ActorEmail());
        return NoContent();
    }

    [HttpPut("notifications/read-all")]
    public async Task<IActionResult> MarkAllNotificationsRead(CancellationToken ct)
    {
        await mentorService.MarkAllNotificationsReadAsync(this.ActorId(), ct, this.ActorEmail());
        return NoContent();
    }
}
