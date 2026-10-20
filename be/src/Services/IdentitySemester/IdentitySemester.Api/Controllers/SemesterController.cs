using EXETeamMatching.IdentitySemester.Application.DTOs;
using EXETeamMatching.IdentitySemester.Application.Services;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.IdentitySemester.Api.Controllers;

[ApiController]
[Route("api/semesters")]
[Authorize]
public class SemesterController(IdentityService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PageResult<SemesterDto>>>> List([FromQuery] ListQuery query, CancellationToken ct)
        => Ok(ApiResponse<PageResult<SemesterDto>>.Ok(await service.Semesters(query, ct)));
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<SemesterDto>>> Get(Guid id, CancellationToken ct)
        => Ok(ApiResponse<SemesterDto>.Ok(await service.Semester(id, ct)));
    [HttpPost, Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<SemesterDto>>> Create(CreateSemesterRequest request, CancellationToken ct)
    {
        var semester = await service.CreateSemester(request, ct);
        return CreatedAtAction(nameof(Get), new { id = semester.Id }, ApiResponse<SemesterDto>.Ok(semester));
    }
    [HttpPut("{id:guid}"), Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<SemesterDto>>> Update(Guid id, UpdateSemesterRequest request, CancellationToken ct)
        => Ok(ApiResponse<SemesterDto>.Ok(await service.UpdateSemester(id, request, ct)));
    [HttpDelete("{id:guid}"), Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteSemester(id, ct);
        return NoContent();
    }
}
