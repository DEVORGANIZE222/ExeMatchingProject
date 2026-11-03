using System.Security.Claims;
using EXETeamMatching.GroupMatching.Application.DTOs;
using EXETeamMatching.GroupMatching.Application.Interfaces;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.GroupMatching.Api.Controllers;

[ApiController]
[Route("api/groups")]
[Microsoft.AspNetCore.Authorization.Authorize]
public class LeaderVoteController(IGroupService service) : ControllerBase
{
    [HttpPost("{id:guid}/vote-leader")]
    public async Task<ActionResult<ApiResponse<GroupDto>>> VoteLeader(Guid id, VoteLeaderRequest request, CancellationToken ct)
        => Ok(ApiResponse<GroupDto>.Ok(await service.VoteAsync(id, request, Guid.Parse(User.FindFirstValue("sub")!), ct)));
}
