using EXETeamMatching.Mentor.Application.DTOs;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.Mentor.Api.Controllers;

[ApiController]
[Route("api/mentor-requests")]
public class MentorRequestsController : ControllerBase
{
    [HttpPost]
    public ActionResult<ApiResponse<bool>> RequestMentor([FromBody] MentorRequestDto request)
    {
        throw new NotImplementedException("Phase 2 Implementation: Send mentor request");
    }

    [HttpPost("decision")]
    public ActionResult<ApiResponse<bool>> DecisionMentor([FromBody] MentorDecisionDto decision)
    {
        throw new NotImplementedException("Phase 2 Implementation: Mentor accept/reject decision");
    }
}
