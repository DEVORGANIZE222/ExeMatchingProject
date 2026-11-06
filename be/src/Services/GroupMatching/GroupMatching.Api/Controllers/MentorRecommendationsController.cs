using System.Security.Claims;
using EXETeamMatching.GroupMatching.Application.DTOs;
using EXETeamMatching.GroupMatching.Application.Interfaces;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.GroupMatching.Api.Controllers;

[ApiController]
[Route("api/groups")]
[Authorize]
public sealed class MentorRecommendationsController(IMentorRecommendationService service) : ControllerBase
{
    private Guid Actor => Guid.Parse(User.FindFirstValue("sub")!);
    private bool IsAdmin => User.IsInRole("Admin");

    [HttpGet("{id:guid}/mentor-recommendations")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<MentorRecommendationDto>>>> Get(Guid id, CancellationToken ct)
        => Ok(ApiResponse<IReadOnlyList<MentorRecommendationDto>>.Ok(await service.GetForGroupAsync(id, Actor, IsAdmin, ct)));
}
