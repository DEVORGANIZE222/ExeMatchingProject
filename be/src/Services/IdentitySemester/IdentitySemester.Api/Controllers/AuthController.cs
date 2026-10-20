using System.Security.Claims;
using EXETeamMatching.IdentitySemester.Application.DTOs;
using EXETeamMatching.IdentitySemester.Application.Services;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.IdentitySemester.Api.Controllers;

[ApiController]
[Route("api/auth")]
[Authorize]
public class AuthController(IdentityService service) : ControllerBase
{
    private Guid Actor => Guid.Parse(User.FindFirstValue("sub")!);
    [HttpPost("login"), AllowAnonymous]
    public async Task<ActionResult<ApiResponse<LoginResponse>>> Login(LoginRequest request, CancellationToken ct)
        => Ok(ApiResponse<LoginResponse>.Ok(await service.LoginAsync(request, ct)));
    [HttpPost("google"), AllowAnonymous]
    public async Task<ActionResult<ApiResponse<LoginResponse>>> Google(GoogleLoginRequest request, CancellationToken ct)
        => Ok(ApiResponse<LoginResponse>.Ok(await service.GoogleLoginAsync(request, ct)));
    [HttpGet("me")]
    public async Task<ActionResult<ApiResponse<AccountResponse>>> Me(CancellationToken ct)
        => Ok(ApiResponse<AccountResponse>.Ok(await service.Account(Actor, ct)));
    [HttpPut("me")]
    public async Task<ActionResult<ApiResponse<AccountResponse>>> Update(UpdateAccountRequest request, CancellationToken ct)
        => Ok(ApiResponse<AccountResponse>.Ok(await service.UpdateAccount(Actor, request, ct)));
    [HttpPut("password")]
    public async Task<IActionResult> Password(ChangePasswordRequest request, CancellationToken ct)
    {
        await service.ChangePassword(Actor, request, ct);
        return NoContent();
    }
    // Nginx auth_request may use this endpoint; authorization is still enforced by the API.
    [HttpGet("validate")]
    public IActionResult ValidateToken() => NoContent();
}
