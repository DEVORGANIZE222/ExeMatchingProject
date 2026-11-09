using EXETeamMatching.Mentor.Application.DTOs;
using EXETeamMatching.Mentor.Application.Exceptions;
using EXETeamMatching.Mentor.Application.Interfaces;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.Mentor.Api.Controllers;

[ApiController]
[Route("api/mentor-requests")]
[Authorize]
public class MentorRequestsController(IMentorService mentorService) : ControllerBase
{
    [HttpPost]
    [Authorize(Roles = "Student")]
    public async Task<ActionResult<ApiResponse<bool>>> RequestMentor([FromBody] CreateMentorRequest request, CancellationToken ct)
    {
        try
        {
            await mentorService.RequestMentorAsync(this.Actor(), request, ct);
        }
        catch (GroupValidationException ex)
        {
            return this.GroupValidationResult<bool>(ex);
        }
        return Ok(ApiResponse<bool>.Ok(true));
    }

    [HttpGet("groups/{groupId:guid}/status")]
    [Authorize(Roles = "Student")]
    public async Task<ActionResult<ApiResponse<GroupMentorStatusResponse>>> GroupStatus(Guid groupId, CancellationToken ct)
    {
        try
        {
            var status = await mentorService.GetGroupMentorStatusAsync(groupId, this.AuthorizationHeader(), ct);
            return Ok(ApiResponse<GroupMentorStatusResponse>.Ok(status));
        }
        catch (GroupValidationException ex)
        {
            return this.GroupValidationResult<GroupMentorStatusResponse>(ex);
        }
    }

    [HttpPost("decision")]
    [Authorize(Roles = "Mentor")]
    public async Task<ActionResult<ApiResponse<bool>>> DecisionMentor([FromBody] MentorDecisionDto decision, CancellationToken ct)
    {
        await mentorService.ProcessDecisionAsync(this.ActorId(), decision, ct);
        return Ok(ApiResponse<bool>.Ok(true));
    }

    [HttpGet("mine")]
    [Authorize(Roles = "Mentor")]
    public async Task<ActionResult<ApiResponse<List<MentorRequestDto>>>> Mine(CancellationToken ct)
        => Ok(ApiResponse<List<MentorRequestDto>>.Ok(await mentorService.GetMyRequestsAsync(this.ActorId(), ct)));
}
