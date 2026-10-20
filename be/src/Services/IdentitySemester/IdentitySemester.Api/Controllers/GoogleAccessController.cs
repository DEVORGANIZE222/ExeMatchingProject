using System.ComponentModel.DataAnnotations;
using EXETeamMatching.IdentitySemester.Application.DTOs;
using EXETeamMatching.IdentitySemester.Application.Interfaces;
using EXETeamMatching.IdentitySemester.Application.Services;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.IdentitySemester.Api.Controllers;

[ApiController]
[Route("api/google-access")]
[Authorize(Roles = "Admin")]
public class GoogleAccessController(IdentityService service, IGoogleEmailImportReader reader) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<GoogleAllowedEmailResponse>>>> List(CancellationToken ct)
        => Ok(ApiResponse<IReadOnlyList<GoogleAllowedEmailResponse>>.Ok(await service.GoogleAccessList(ct)));

    [HttpPost("import/excel"), RequestSizeLimit(2 * 1024 * 1024)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<ApiResponse<GoogleEmailImportResult>>> Import([FromForm] GoogleAccessImportRequest request, CancellationToken ct)
    {
        if (request.File.Length == 0 || !Path.GetExtension(request.File.FileName).Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
            throw new IdentityException(400, "Upload a non-empty .xlsx file (maximum 2 MB).");
        using var stream = request.File.OpenReadStream();
        return Ok(ApiResponse<GoogleEmailImportResult>.Ok(await service.ImportGoogleAccess(reader.Read(stream), ct)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remove(Guid id, CancellationToken ct)
    {
        await service.RemoveGoogleAccess(id, ct);
        return NoContent();
    }
}

public class GoogleAccessImportRequest
{
    [Required] public IFormFile File { get; set; } = null!;
}
