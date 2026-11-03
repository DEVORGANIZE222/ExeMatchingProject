using System.Security.Claims;
using EXETeamMatching.IdentitySemester.Application.DTOs;
using EXETeamMatching.IdentitySemester.Application.Services;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.IdentitySemester.Api.Controllers;

/// <summary>Minimal read-only context needed by GroupMatching; no roster data is exposed.</summary>
[ApiController]
[Authorize]
[Route("api/internal")]
public sealed class InternalContextController(IdentityService service) : ControllerBase
{
    private Guid Actor => Guid.Parse(User.FindFirstValue("sub")!);

    [HttpGet("students/current")]
    public async Task<ActionResult<ApiResponse<GroupEnrollmentResponse>>> Current([FromQuery] string semesterCode, CancellationToken ct)
        => Ok(ApiResponse<GroupEnrollmentResponse>.Ok(await service.CurrentEnrollment(Actor, semesterCode, ct)));

    [HttpGet("semesters/{semesterCode}/workflow")]
    public async Task<ActionResult<ApiResponse<SemesterWorkflowResponse>>> Workflow(string semesterCode, CancellationToken ct)
        => Ok(ApiResponse<SemesterWorkflowResponse>.Ok(await service.Workflow(semesterCode, ct)));
}
