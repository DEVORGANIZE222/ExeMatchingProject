using System.Security.Claims;
using EXETeamMatching.Mentor.Application.DTOs;
using EXETeamMatching.Mentor.Application.Exceptions;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.Mentor.Api.Controllers;

internal static class ControllerExtensions
{
    /// <summary>The authenticated user's id from the JWT <c>sub</c> claim.</summary>
    public static Guid ActorId(this ControllerBase controller)
        => Guid.Parse(controller.User.FindFirstValue("sub")!);

    /// <summary>Raw inbound Authorization header, forwarded to downstream services.</summary>
    public static string? AuthorizationHeader(this ControllerBase controller)
        => controller.Request.Headers.Authorization.Count > 0 ? controller.Request.Headers.Authorization.ToString() : null;

    public static RequestActor Actor(this ControllerBase controller) => new(
        controller.ActorId(),
        controller.User.FindFirstValue(ClaimTypes.Email) ?? controller.User.FindFirstValue("email"),
        controller.User.FindFirstValue("ver"),
        controller.AuthorizationHeader());

    /// <summary>Maps a GroupMatching rejection to 403/404/409 with an <see cref="ApiResponse{T}"/> body.</summary>
    public static ActionResult GroupValidationResult<T>(this ControllerBase controller, GroupValidationException exception)
    {
        var statusCode = exception.Failure switch
        {
            GroupValidationFailure.Forbidden => StatusCodes.Status403Forbidden,
            GroupValidationFailure.NotFound => StatusCodes.Status404NotFound,
            GroupValidationFailure.Conflict => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest
        };
        return controller.StatusCode(statusCode, ApiResponse<T>.Fail(exception.Message));
    }
}
