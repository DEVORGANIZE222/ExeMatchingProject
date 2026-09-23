using EXETeamMatching.IdentitySemester.Application.DTOs;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.IdentitySemester.Api.Controllers;

[ApiController]
[Route("api/semesters")]
public class SemesterController : ControllerBase
{
    [HttpGet]
    public ActionResult<ApiResponse<List<SemesterDto>>> GetSemesters()
    {
        throw new NotImplementedException("Phase 2 Implementation: Get semesters");
    }

    [HttpPost]
    public ActionResult<ApiResponse<SemesterDto>> CreateSemester([FromBody] CreateSemesterRequest request)
    {
        throw new NotImplementedException("Phase 2 Implementation: Create semester");
    }
}
