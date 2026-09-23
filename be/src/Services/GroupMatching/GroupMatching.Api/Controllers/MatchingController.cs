using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.GroupMatching.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MatchingController : ControllerBase
{
    [HttpPost("random")]
    public ActionResult<ApiResponse<bool>> RandomMatching([FromQuery] string semesterCode)
    {
        throw new NotImplementedException("Phase 2 Implementation: Random matching algorithm");
    }
}
