using EXETeamMatching.GroupMatching.Application.DTOs;
using EXETeamMatching.GroupMatching.Application.Interfaces;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.GroupMatching.Api.Controllers;

[ApiController]
[Route("api/matching")]
[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
public class MatchingController(IMatchingService service) : ControllerBase
{
    [HttpPost("random")]
    public async Task<ActionResult<ApiResponse<RandomMatchingResult>>> RandomMatching([FromQuery] string semesterCode, CancellationToken ct)
        => Ok(ApiResponse<RandomMatchingResult>.Ok(await service.RandomMatchingAsync(semesterCode, ct)));
}
