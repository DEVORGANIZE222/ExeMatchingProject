using EXETeamMatching.IdentitySemester.Application.DTOs;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.IdentitySemester.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StudentsController : ControllerBase
{
    [HttpGet]
    public ActionResult<ApiResponse<List<StudentResponse>>> GetStudents()
    {
        throw new NotImplementedException("Phase 2 Implementation: Get all students");
    }

    [HttpGet("{id:guid}")]
    public ActionResult<ApiResponse<StudentResponse>> GetStudentById(Guid id)
    {
        throw new NotImplementedException("Phase 2 Implementation: Get student by id");
    }

    [HttpPost("import")]
    public ActionResult<ApiResponse<bool>> ImportStudents([FromBody] ImportStudentsRequest request)
    {
        throw new NotImplementedException("Phase 2 Implementation: Import students");
    }
}
