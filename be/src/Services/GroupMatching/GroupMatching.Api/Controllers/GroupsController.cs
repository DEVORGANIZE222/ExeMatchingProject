using EXETeamMatching.GroupMatching.Application.DTOs;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Mvc;

namespace EXETeamMatching.GroupMatching.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GroupsController : ControllerBase
{
    [HttpGet]
    public ActionResult<ApiResponse<List<GroupDto>>> GetGroups()
    {
        throw new NotImplementedException("Phase 2 Implementation: Get groups");
    }

    [HttpGet("{id:guid}")]
    public ActionResult<ApiResponse<GroupDto>> GetGroupById(Guid id)
    {
        throw new NotImplementedException("Phase 2 Implementation: Get group by id");
    }

    [HttpPost]
    public ActionResult<ApiResponse<GroupDto>> CreateGroup([FromBody] CreateGroupRequest request)
    {
        throw new NotImplementedException("Phase 2 Implementation: Create group");
    }

    [HttpPost("{id:guid}/members")]
    public ActionResult<ApiResponse<bool>> AddMember(Guid id, [FromBody] AddGroupMemberRequest request)
    {
        throw new NotImplementedException("Phase 2 Implementation: Add group member");
    }

    [HttpDelete("{id:guid}/members/{studentId:guid}")]
    public ActionResult<ApiResponse<bool>> RemoveMember(Guid id, Guid studentId)
    {
        throw new NotImplementedException("Phase 2 Implementation: Remove group member");
    }

    [HttpPost("{id:guid}/lock")]
    public ActionResult<ApiResponse<bool>> LockGroup(Guid id)
    {
        throw new NotImplementedException("Phase 2 Implementation: Lock group");
    }
}
