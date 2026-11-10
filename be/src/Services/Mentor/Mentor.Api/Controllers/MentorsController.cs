using EXETeamMatching.Mentor.Application.DTOs;
using EXETeamMatching.Mentor.Application.Interfaces;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.Mentor.Api.Controllers;

[ApiController]
[Route("api/mentors")]
[Authorize]
public class MentorsController(IMentorService mentorService) : ControllerBase
{
    public const string TotalCountHeader = "X-Total-Count";
    public const string PageIndexHeader = "X-Page-Index";
    public const string PageSizeHeader = "X-Page-Size";
    public const string TotalPagesHeader = "X-Total-Pages";

    /// <summary>
    /// Searches mentors. The body keeps the existing list contract; paging metadata is
    /// returned in the X-Total-Count / X-Page-Index / X-Page-Size / X-Total-Pages headers.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<MentorResponse>>>> GetMentors([FromQuery] MentorSearchQuery query, CancellationToken ct)
    {
        var page = await mentorService.SearchMentorsAsync(query, ct);
        Response.Headers[TotalCountHeader] = page.TotalCount.ToString();
        Response.Headers[PageIndexHeader] = page.PageIndex.ToString();
        Response.Headers[PageSizeHeader] = page.PageSize.ToString();
        Response.Headers[TotalPagesHeader] = page.TotalPages.ToString();
        return Ok(ApiResponse<List<MentorResponse>>.Ok(page.Items.ToList()));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<MentorResponse>>> GetMentorById(Guid id, CancellationToken ct)
    {
        var mentor = await mentorService.GetMentorByIdAsync(id, ct)
            ?? throw new KeyNotFoundException("Mentor not found.");
        return Ok(ApiResponse<MentorResponse>.Ok(mentor));
    }

    [HttpGet("{id:guid}/quota")]
    public async Task<ActionResult<ApiResponse<int>>> GetMentorQuota(Guid id, CancellationToken ct)
    {
        var quota = await mentorService.GetMentorQuotaAsync(id, ct)
            ?? throw new KeyNotFoundException("Mentor quota not found.");
        return Ok(ApiResponse<int>.Ok(quota.MaxQuota));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<MentorResponse>>> CreateMentor(CreateMentorProfileRequest request, CancellationToken ct)
    {
        var mentor = await mentorService.CreateMentorAsync(request, ct);
        return CreatedAtAction(nameof(GetMentorById), new { id = mentor.Id }, ApiResponse<MentorResponse>.Ok(mentor));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<MentorResponse>>> UpdateMentor(Guid id, AdminUpdateMentorRequest request, CancellationToken ct)
        => Ok(ApiResponse<MentorResponse>.Ok(await mentorService.UpdateMentorAsync(id, request, ct)));

    [HttpPut("{id:guid}/quota")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<MentorResponse>>> UpdateQuota(Guid id, UpdateMentorQuotaRequest request, CancellationToken ct)
        => Ok(ApiResponse<MentorResponse>.Ok(await mentorService.UpdateQuotaAsync(id, request.MaxQuota, ct)));

    /// <summary>
    /// Deletes a mentor profile with its quota, requests and workspace data.
    /// Rejected with 400 while the mentor still has assigned groups.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteMentor(Guid id, CancellationToken ct)
    {
        await mentorService.DeleteMentorAsync(id, ct);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize(Roles = "Mentor")]
    public async Task<ActionResult<ApiResponse<MentorResponse>>> GetMine(CancellationToken ct)
        => Ok(ApiResponse<MentorResponse>.Ok(await mentorService.GetMyProfileAsync(this.ActorId(), ct, this.ActorEmail())));

    [HttpPut("me")]
    [Authorize(Roles = "Mentor")]
    public async Task<ActionResult<ApiResponse<MentorResponse>>> UpdateMine(UpdateMentorProfileRequest request, CancellationToken ct)
        => Ok(ApiResponse<MentorResponse>.Ok(await mentorService.UpdateMyProfileAsync(this.ActorId(), request, ct, this.ActorEmail())));
}
