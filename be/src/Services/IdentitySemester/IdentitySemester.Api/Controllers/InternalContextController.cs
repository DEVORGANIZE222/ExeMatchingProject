using System.Security.Claims;
using EXETeamMatching.IdentitySemester.Application.DTOs;
using EXETeamMatching.IdentitySemester.Application.Services;
using EXETeamMatching.IdentitySemester.Infrastructure.Persistence;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EXETeamMatching.IdentitySemester.Api.Controllers;

/// <summary>Minimal read-only context needed by GroupMatching; no roster data is exposed.</summary>
[ApiController]
[Authorize]
[Route("api/internal")]
public sealed class InternalContextController(IdentityService service, IdentitySemesterDbContext db) : ControllerBase
{
    private Guid Actor => Guid.Parse(User.FindFirstValue("sub")!);

    [HttpGet("students/current")]
    public async Task<ActionResult<ApiResponse<GroupEnrollmentResponse>>> Current([FromQuery] string semesterCode, CancellationToken ct)
        => Ok(ApiResponse<GroupEnrollmentResponse>.Ok(await service.CurrentEnrollment(Actor, semesterCode, ct)));

    [HttpGet("students/lookup")]
    public async Task<ActionResult<ApiResponse<GroupEnrollmentResponse>>> Lookup(
        [FromQuery] string semesterCode,
        [FromQuery] string identifier,
        CancellationToken ct)
        => Ok(ApiResponse<GroupEnrollmentResponse>.Ok(await service.LookupEnrollment(semesterCode, identifier, ct)));

    [HttpGet("semesters/{semesterCode}/workflow")]
    public async Task<ActionResult<ApiResponse<SemesterWorkflowResponse>>> Workflow(string semesterCode, CancellationToken ct)
        => Ok(ApiResponse<SemesterWorkflowResponse>.Ok(await service.Workflow(semesterCode, ct)));

    [HttpGet("mentor-team-contacts")]
    [Authorize(Policy = "MentorTeamContacts")]
    public async Task<ActionResult<ApiResponse<List<MentorTeamContactResponse>>>> MentorTeamContacts(
        [FromQuery] Guid groupId,
        CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue("group_id"), out var authorizedGroupId) || authorizedGroupId != groupId)
            return Forbid();

        var studentIds = User.FindAll("student_id")
            .Select(claim => Guid.TryParse(claim.Value, out var id) ? id : Guid.Empty)
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();
        if (studentIds.Count == 0)
            return Ok(ApiResponse<List<MentorTeamContactResponse>>.Ok([]));

        var contacts = await db.Students.AsNoTracking()
            .Where(student => studentIds.Contains(student.Id))
            .Select(student => new MentorTeamContactResponse(student.Id, student.User.Email))
            .ToListAsync(ct);
        return Ok(ApiResponse<List<MentorTeamContactResponse>>.Ok(contacts));
    }
}

public sealed record MentorTeamContactResponse(Guid StudentId, string Email);
