using EXETeamMatching.IdentitySemester.Application.DTOs;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.IdentitySemester.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public ActionResult<ApiResponse<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        var response = new LoginResponse("sample_jwt_token", "sample_refresh_token", DateTime.UtcNow.AddHours(2), null);
        return Ok(ApiResponse<LoginResponse>.Ok(response, "Login skeleton response"));
    }
}
