using EXETeamMatching.IdentitySemester.Application.DTOs;
using EXETeamMatching.IdentitySemester.Application.Services;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.IdentitySemester.Api.Controllers;

[ApiController]
[Route("api/admin/mentors")]
[Authorize(Roles = "Admin")]
public class AdminMentorsController(IdentityService service) : ControllerBase
{
    [HttpPost("activate")]
    public async Task<ActionResult<ApiResponse<AccountResponse>>> Activate(ActivateMentorRequest request, CancellationToken ct)
        => Ok(ApiResponse<AccountResponse>.Ok(await service.ActivateMentor(request.Email, ct)));
}
