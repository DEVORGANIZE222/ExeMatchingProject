using EXETeamMatching.Mentor.Application.DTOs;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.Mentor.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MentorsController : ControllerBase
{
    [HttpGet]
    public ActionResult<ApiResponse<List<MentorResponse>>> GetMentors()
    {
        throw new NotImplementedException("Phase 2 Implementation: Get all mentors");
    }

    [HttpGet("{id:guid}")]
    public ActionResult<ApiResponse<MentorResponse>> GetMentorById(Guid id)
    {
        throw new NotImplementedException("Phase 2 Implementation: Get mentor by id");
    }

    [HttpGet("{id:guid}/quota")]
    public ActionResult<ApiResponse<int>> GetMentorQuota(Guid id)
    {
        throw new NotImplementedException("Phase 2 Implementation: Get mentor quota");
    }
}
