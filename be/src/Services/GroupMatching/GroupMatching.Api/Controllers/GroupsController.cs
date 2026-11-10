using System.Security.Claims;
using EXETeamMatching.GroupMatching.Application.DTOs;
using EXETeamMatching.GroupMatching.Application.Interfaces;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.GroupMatching.Api.Controllers;

[ApiController]
[Route("api/groups")]
[Microsoft.AspNetCore.Authorization.Authorize]
public class GroupsController(IGroupService service, IHostEnvironment environment, IConfiguration configuration) : ControllerBase
{
    private Guid Actor => Guid.Parse(User.FindFirstValue("sub")!);
    private bool IsAdmin => User.IsInRole("Admin");
    private bool DemoFeaturesEnabled => environment.IsDevelopment() || configuration.GetValue<bool>("DemoMode:Enabled");

    [HttpGet("demo-seed-status")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin,Student")]
    public ActionResult<ApiResponse<bool>> GetDemoSeedStatus()
        => Ok(ApiResponse<bool>.Ok(DemoFeaturesEnabled));

    [HttpGet] public async Task<ActionResult<ApiResponse<PageResult<GroupDto>>>> GetGroups([FromQuery] GroupListQuery query, CancellationToken ct)
        => Ok(ApiResponse<PageResult<GroupDto>>.Ok(await service.ListAsync(query, Actor, IsAdmin, ct)));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<GroupDto>>> GetGroupById(Guid id, CancellationToken ct)
        => Ok(ApiResponse<GroupDto>.Ok(await service.GetAsync(id, Actor, IsAdmin, ct)));

    [HttpGet("{id:guid}/mentor-request-context")]
    public async Task<ActionResult<ApiResponse<GroupDto>>> GetMentorRequestContext(Guid id, CancellationToken ct)
        => Ok(ApiResponse<GroupDto>.Ok(await service.GetMentorRequestContextAsync(id, Actor, ct)));

    [HttpPost]
    public async Task<ActionResult<ApiResponse<GroupDto>>> CreateGroup(CreateGroupRequest request, CancellationToken ct)
    {
        var group = await service.CreateAsync(request, Actor, ct);
        return CreatedAtAction(nameof(GetGroupById), new { id = group.Id }, ApiResponse<GroupDto>.Ok(group));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<GroupDto>>> UpdateGroup(Guid id, UpdateGroupRequest request, CancellationToken ct)
        => Ok(ApiResponse<GroupDto>.Ok(await service.UpdateAsync(id, request, Actor, IsAdmin, ct)));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteGroup(Guid id, CancellationToken ct)
    {
        await service.DeleteAsync(id, Actor, IsAdmin, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/members")]
    public async Task<ActionResult<ApiResponse<GroupDto>>> AddMember(Guid id, CancellationToken ct)
        => Ok(ApiResponse<GroupDto>.Ok(await service.JoinAsync(id, Actor, ct)));

    [HttpPost("{id:guid}/invite")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin,Student")]
    public async Task<ActionResult<ApiResponse<GroupDto>>> InviteMember(Guid id, InviteMemberRequest request, CancellationToken ct)
        => Ok(ApiResponse<GroupDto>.Ok(await service.InviteMemberAsync(id, request, Actor, IsAdmin, ct)));

    [HttpPost("{id:guid}/demo-members")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin,Student")]
    public async Task<ActionResult<ApiResponse<GroupDto>>> SeedDemoMembers(Guid id, CancellationToken ct)
    {
        if (!DemoFeaturesEnabled)
            return Conflict(ApiResponse<GroupDto>.Fail("Demo seeding is disabled. Start the service in Development or enable DemoMode:Enabled."));
        return Ok(ApiResponse<GroupDto>.Ok(await service.SeedDemoMembersAsync(id, Actor, IsAdmin, ct)));
    }

    [HttpDelete("{id:guid}/members/me")]
    public async Task<IActionResult> RemoveMember(Guid id, CancellationToken ct)
    {
        await service.LeaveAsync(id, Actor, IsAdmin, ct);
        return NoContent();
    }

    [HttpDelete("{id:guid}/members/{studentId:guid}")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "Admin")]
    public async Task<IActionResult> RemoveMemberAsAdmin(Guid id, Guid studentId, CancellationToken ct)
    {
        await service.RemoveMemberAsAdminAsync(id, studentId, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/lock")]
    public async Task<ActionResult<ApiResponse<GroupDto>>> LockGroup(Guid id, CancellationToken ct)
        => Ok(ApiResponse<GroupDto>.Ok(await service.LockAsync(id, Actor, ct)));

    [HttpPost("{id:guid}/topic")]
    public async Task<ActionResult<ApiResponse<GroupDto>>> RegisterTopic(Guid id, RegisterTopicRequest request, CancellationToken ct)
        => Ok(ApiResponse<GroupDto>.Ok(await service.RegisterTopicAsync(id, request, Actor, ct)));
}
