using System.Security.Claims;
using System.ComponentModel.DataAnnotations;
using EXETeamMatching.IdentitySemester.Application.DTOs;
using EXETeamMatching.IdentitySemester.Application.Interfaces;
using EXETeamMatching.IdentitySemester.Application.Services;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.IdentitySemester.Api.Controllers;

[ApiController]
[Route("api/students")]
[Authorize]
public class StudentsController(IdentityService service, IStudentImportReader reader) : ControllerBase
{
    [HttpGet, Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<PageResult<StudentResponse>>>> List([FromQuery] ListQuery query, CancellationToken ct)
        => Ok(ApiResponse<PageResult<StudentResponse>>.Ok(await service.Students(query, ct)));
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<StudentResponse>>> Get(Guid id, CancellationToken ct)
        => Ok(ApiResponse<StudentResponse>.Ok(await service.Student(id, Guid.Parse(User.FindFirstValue("sub")!), User.IsInRole("Admin"), ct)));
    [HttpPost, Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<StudentResponse>>> Create(CreateStudentRequest request, CancellationToken ct)
    {
        var student = await service.CreateStudent(request, ct);
        return CreatedAtAction(nameof(Get), new { id = student.Id }, ApiResponse<StudentResponse>.Ok(student));
    }
    [HttpPut("{id:guid}"), Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<StudentResponse>>> Update(Guid id, UpdateStudentRequest request, CancellationToken ct)
        => Ok(ApiResponse<StudentResponse>.Ok(await service.UpdateStudent(id, request, ct)));
    [HttpPut("{id:guid}/strength-roles")]
    public async Task<ActionResult<ApiResponse<StudentResponse>>> UpdateStrengthRoles(Guid id, UpdateStudentStrengthRolesRequest request, CancellationToken ct)
        => Ok(ApiResponse<StudentResponse>.Ok(await service.UpdateStudentStrengthRoles(id, request,
            Guid.Parse(User.FindFirstValue("sub")!), User.IsInRole("Admin"), ct)));
    [HttpDelete("{id:guid}"), Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await service.DeleteStudent(id, ct);
        return NoContent();
    }
    [HttpPost("import"), Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<ImportResult>>> Import(ImportStudentsRequest request, CancellationToken ct)
        => Ok(ApiResponse<ImportResult>.Ok(await service.Import(request, request.InitialPassword, ct)));
    [HttpPost("import/excel"), Authorize(Roles = "Admin"), RequestSizeLimit(2 * 1024 * 1024)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<ApiResponse<ImportResult>>> Excel([FromForm] ExcelImportRequest request, CancellationToken ct)
    {
        if (request.File.Length == 0 || !Path.GetExtension(request.File.FileName).Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
            throw new IdentityException(400, "Upload a non-empty .xlsx file (maximum 2 MB).");
        using var stream = request.File.OpenReadStream();
        var students = reader.Read(stream);
        var fileCodes = students.Select(x => x.SemesterCode?.Trim().ToUpperInvariant()).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct().ToList();
        if (fileCodes.Count != 1) throw new IdentityException(400, "Excel must contain exactly one SemesterCode value.");
        if (!string.IsNullOrWhiteSpace(request.SemesterCode) && !request.SemesterCode.Trim().Equals(fileCodes[0], StringComparison.OrdinalIgnoreCase))
            throw new IdentityException(400, "SemesterCode in Excel does not match the selected semester.");
        return Ok(ApiResponse<ImportResult>.Ok(await service.Import(
            new ImportStudentsRequest(fileCodes[0]!, students, request.InitialPassword), request.InitialPassword, ct)));
    }
}
public class ExcelImportRequest
{
    [Required] public IFormFile File { get; set; } = null!;
    public string? SemesterCode { get; set; }
    [Required, StringLength(128, MinimumLength = 6)] public string InitialPassword { get; set; } = "";
}
