using EXETeamMatching.GroupMatching.Application.DTOs;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.GroupMatching.Api.Controllers;

[ApiController]
[Route("api/groups")]
public class LeaderVoteController : ControllerBase
{
    [HttpPost("{id:guid}/vote-leader")]
    public ActionResult<ApiResponse<bool>> VoteLeader(Guid id, [FromBody] VoteLeaderRequest request)
    {
        throw new NotImplementedException("Phase 2 Implementation: Vote leader logic");
    }
}
