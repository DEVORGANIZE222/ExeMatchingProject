using System.Security.Claims;
using EXETeamMatching.Mentor.Application.DTOs;
using EXETeamMatching.Mentor.Domain.Entities;
using EXETeamMatching.Mentor.Infrastructure.Persistence;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EXETeamMatching.Mentor.Api.Controllers;

[ApiController]
[Route("api/mentors")]
[Authorize]
public class MentorsController(MentorDbContext db) : ControllerBase
{
    private Guid ActorId => Guid.Parse(User.FindFirstValue("sub")!);

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<MentorResponse>>>> GetMentors(CancellationToken ct)
    {
        var mentors = await db.Mentors.AsNoTracking().Include(x => x.Quota).OrderBy(x => x.FullName).ToListAsync(ct);
        return Ok(ApiResponse<List<MentorResponse>>.Ok(mentors.Select(Map).ToList()));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<MentorResponse>>> GetMentorById(Guid id, CancellationToken ct)
    {
        var mentor = await db.Mentors.AsNoTracking().Include(x => x.Quota).SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new KeyNotFoundException("Mentor not found.");
        return Ok(ApiResponse<MentorResponse>.Ok(Map(mentor)));
    }

    [HttpGet("{id:guid}/quota")]
    public async Task<ActionResult<ApiResponse<int>>> GetMentorQuota(Guid id, CancellationToken ct)
    {
        var quota = await db.MentorQuotas.Where(x => x.MentorId == id).Select(x => (int?)x.MaxQuota).SingleOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException("Mentor quota not found.");
        return Ok(ApiResponse<int>.Ok(quota));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<MentorResponse>>> CreateMentor(CreateMentorProfileRequest request, CancellationToken ct)
    {
        if (await db.Mentors.AnyAsync(x => x.UserId == request.UserId || x.Email.ToLower() == request.Email.ToLower(), ct))
            throw new ArgumentException("This account already has a mentor profile.");

        var mentor = new MentorUser
        {
            UserId = request.UserId,
            FullName = request.FullName.Trim(),
            Email = request.Email.Trim().ToLowerInvariant(),
            Department = request.Department.Trim(),
            Expertise = request.Expertise.Trim(),
            Phone = request.Phone.Trim()
        };
        mentor.Quota = new MentorQuota { MentorId = mentor.Id, MaxQuota = request.MaxQuota };
        db.Mentors.Add(mentor);
        await db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetMentorById), new { id = mentor.Id }, ApiResponse<MentorResponse>.Ok(Map(mentor)));
    }

    [HttpPut("{id:guid}/quota")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<MentorResponse>>> UpdateQuota(Guid id, UpdateMentorQuotaRequest request, CancellationToken ct)
    {
        var mentor = await db.Mentors.Include(x => x.Quota).SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new KeyNotFoundException("Mentor not found.");
        var quota = mentor.Quota ??= new MentorQuota { MentorId = mentor.Id };
        if (request.MaxQuota < quota.CurrentAssigned)
            throw new ArgumentException("Quota cannot be lower than the number of assigned groups.");
        quota.MaxQuota = request.MaxQuota;
        quota.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Ok(ApiResponse<MentorResponse>.Ok(Map(mentor)));
    }

    [HttpGet("me")]
    [Authorize(Roles = "Mentor")]
    public async Task<ActionResult<ApiResponse<MentorResponse>>> GetMine(CancellationToken ct)
    {
        var mentor = await FindMine(ct);
        return Ok(ApiResponse<MentorResponse>.Ok(Map(mentor)));
    }

    [HttpPut("me")]
    [Authorize(Roles = "Mentor")]
    public async Task<ActionResult<ApiResponse<MentorResponse>>> UpdateMine(UpdateMentorProfileRequest request, CancellationToken ct)
    {
        var mentor = await FindMine(ct);
        mentor.FullName = request.FullName.Trim();
        mentor.Department = request.Department.Trim();
        mentor.Expertise = request.Expertise.Trim();
        mentor.Phone = request.Phone.Trim();
        mentor.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Ok(ApiResponse<MentorResponse>.Ok(Map(mentor)));
    }

    private async Task<MentorUser> FindMine(CancellationToken ct)
        => await db.Mentors.Include(x => x.Quota).SingleOrDefaultAsync(x => x.UserId == ActorId, ct)
            ?? throw new KeyNotFoundException("Mentor profile not found. Ask an administrator to activate your mentor account.");

    private static MentorResponse Map(MentorUser mentor) => new(
        mentor.Id,
        mentor.UserId,
        mentor.FullName,
        mentor.Email,
        mentor.Department,
        mentor.Expertise,
        mentor.Phone,
        mentor.Quota?.MaxQuota ?? 0,
        mentor.Quota?.CurrentAssigned ?? 0);
}

public record UpdateMentorQuotaRequest([System.ComponentModel.DataAnnotations.Range(1, 50)] int MaxQuota);
