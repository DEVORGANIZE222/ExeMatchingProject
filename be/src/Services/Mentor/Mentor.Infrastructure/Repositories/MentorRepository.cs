using System.Data;
using EXETeamMatching.Mentor.Application.DTOs;
using EXETeamMatching.Mentor.Application.Interfaces;
using EXETeamMatching.Mentor.Domain.Entities;
using EXETeamMatching.Mentor.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace EXETeamMatching.Mentor.Infrastructure.Repositories;

public class MentorRepository(MentorDbContext db) : IMentorRepository
{
    // ------------------------------------------------------------------
    // Mentor profiles & quotas
    // ------------------------------------------------------------------

    public async Task<MentorUser?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => await db.Mentors.AsNoTracking().Include(x => x.Quota)
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

    public async Task<MentorUser?> GetByIdForUpdateAsync(Guid id, CancellationToken cancellationToken = default)
        => await db.Mentors.Include(x => x.Quota)
            .SingleOrDefaultAsync(x => x.Id == id, cancellationToken);

    public async Task<IEnumerable<MentorUser>> GetAllAsync(CancellationToken cancellationToken = default)
        => await db.Mentors.AsNoTracking().Include(x => x.Quota)
            .OrderBy(x => x.FullName)
            .ToListAsync(cancellationToken);

    public async Task<(IReadOnlyList<MentorUser> Items, int TotalCount)> SearchAsync(
        string? search, string? department, string? expertise, int skip, int take,
        CancellationToken cancellationToken = default)
    {
        var query = db.Mentors.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.ToLower();
            query = query.Where(x => x.FullName.ToLower().Contains(term) || x.Email.ToLower().Contains(term));
        }
        if (!string.IsNullOrWhiteSpace(department))
        {
            var term = department.ToLower();
            query = query.Where(x => x.Department.ToLower().Contains(term));
        }
        if (!string.IsNullOrWhiteSpace(expertise))
        {
            var term = expertise.ToLower();
            query = query.Where(x => x.Expertise.ToLower().Contains(term));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query.Include(x => x.Quota)
            .OrderBy(x => x.FullName)
            .ThenBy(x => x.Id)
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken);
        return (items, totalCount);
    }

    public async Task<MentorUser?> GetByUserIdForUpdateAsync(Guid userId, CancellationToken cancellationToken = default)
        => await db.Mentors.Include(x => x.Quota)
            .SingleOrDefaultAsync(x => x.UserId == userId, cancellationToken);

    public async Task<Guid?> GetIdByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
        => await db.Mentors.Where(x => x.UserId == userId)
            .Select(x => (Guid?)x.Id)
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<bool> ExistsByUserIdOrEmailAsync(Guid userId, string email, CancellationToken cancellationToken = default)
        => await db.Mentors.AnyAsync(x => x.UserId == userId || x.Email.ToLower() == email.ToLower(), cancellationToken);

    public async Task<MentorQuota?> GetQuotaByMentorIdAsync(Guid mentorId, CancellationToken cancellationToken = default)
        => await db.MentorQuotas.AsNoTracking()
            .SingleOrDefaultAsync(x => x.MentorId == mentorId, cancellationToken);

    public void AddMentor(MentorUser mentor) => db.Mentors.Add(mentor);

    public void RemoveMentor(MentorUser mentor)
    {
        if (mentor.Quota is not null)
            db.MentorQuotas.Remove(mentor.Quota);
        db.Mentors.Remove(mentor);
    }

    public async Task DeleteMentorWorkspaceDataAsync(Guid mentorId, CancellationToken cancellationToken = default)
    {
        await db.MentorNotifications.Where(x => x.MentorId == mentorId).ExecuteDeleteAsync(cancellationToken);
        await db.MentorAppointments.Where(x => x.MentorId == mentorId).ExecuteDeleteAsync(cancellationToken);
        await db.MentorGroupProgress.Where(x => x.MentorId == mentorId).ExecuteDeleteAsync(cancellationToken);
        await db.MentorRequests.Where(x => x.MentorId == mentorId).ExecuteDeleteAsync(cancellationToken);
    }

    // ------------------------------------------------------------------
    // Mentor requests
    // ------------------------------------------------------------------

    public async Task<bool> HasActiveRequestForGroupAsync(Guid groupId, CancellationToken cancellationToken = default)
        => await db.MentorRequests.AnyAsync(x => x.GroupId == groupId && x.Status != RequestStatus.Rejected, cancellationToken);

    public async Task<GroupMentorStatusResponse?> GetLatestActiveRequestStatusAsync(Guid groupId, CancellationToken cancellationToken = default)
    {
        var request = await db.MentorRequests.AsNoTracking()
            .Where(item => item.GroupId == groupId && item.Status != RequestStatus.Rejected)
            .OrderByDescending(item => item.CreatedAt)
            .Select(item => new
            {
                item.Status,
                MentorName = item.Mentor.FullName,
                item.Message,
                item.CreatedAt
            })
            .FirstOrDefaultAsync(cancellationToken);

        return request is null
            ? null
            : new GroupMentorStatusResponse(true, request.Status, request.MentorName, request.Message, request.CreatedAt);
    }

    public async Task<MentorRequest?> GetRequestForUpdateAsync(Guid requestId, Guid mentorId, CancellationToken cancellationToken = default)
        => await db.MentorRequests
            .SingleOrDefaultAsync(x => x.Id == requestId && x.MentorId == mentorId, cancellationToken);

    public async Task<List<MentorRequestDto>> GetRequestsForMentorAsync(Guid mentorId, CancellationToken cancellationToken = default)
        => await db.MentorRequests.AsNoTracking()
            .Where(x => x.MentorId == mentorId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new MentorRequestDto(
                x.Id, x.GroupId, x.MentorId, x.Message, x.Status, x.CreatedAt,
                x.GroupName, x.Topic, x.RequesterName, x.DecisionReason, x.DecidedAt))
            .ToListAsync(cancellationToken);

    public void AddRequest(MentorRequest request) => db.MentorRequests.Add(request);

    // ------------------------------------------------------------------
    // Assigned groups / progress
    // ------------------------------------------------------------------

    public async Task<List<MentorProgressResponse>> GetGroupProgressListAsync(Guid mentorId, CancellationToken cancellationToken = default)
        => await db.MentorGroupProgress.AsNoTracking()
            .Where(x => x.MentorId == mentorId)
            .OrderBy(x => x.GroupName)
            .Select(x => new MentorProgressResponse(
                x.GroupId, x.GroupName, x.Topic, x.Milestone, x.Progress, x.Feedback, x.UpdatedAt ?? x.CreatedAt))
            .ToListAsync(cancellationToken);

    public async Task<bool> IsGroupAssignedAsync(Guid mentorId, Guid groupId, CancellationToken cancellationToken = default)
        => await db.MentorGroupProgress.AsNoTracking()
            .AnyAsync(x => x.MentorId == mentorId && x.GroupId == groupId, cancellationToken);

    public async Task<MentorGroupProgress?> GetGroupProgressForUpdateAsync(Guid mentorId, Guid groupId, CancellationToken cancellationToken = default)
        => await db.MentorGroupProgress
            .SingleOrDefaultAsync(x => x.MentorId == mentorId && x.GroupId == groupId, cancellationToken);

    public void AddGroupProgress(MentorGroupProgress progress) => db.MentorGroupProgress.Add(progress);

    // ------------------------------------------------------------------
    // Appointments
    // ------------------------------------------------------------------

    public async Task<List<MentorAppointmentResponse>> GetAppointmentsAsync(Guid mentorId, CancellationToken cancellationToken = default)
        => await db.MentorAppointments.AsNoTracking()
            .Where(x => x.MentorId == mentorId)
            .OrderBy(x => x.StartsAt)
            .Select(x => new MentorAppointmentResponse(x.Id, x.GroupId, x.Title, x.StartsAt, x.Notes))
            .ToListAsync(cancellationToken);

    public async Task<MentorAppointment?> GetAppointmentForUpdateAsync(Guid id, Guid mentorId, CancellationToken cancellationToken = default)
        => await db.MentorAppointments
            .SingleOrDefaultAsync(x => x.Id == id && x.MentorId == mentorId, cancellationToken);

    public void AddAppointment(MentorAppointment appointment) => db.MentorAppointments.Add(appointment);

    public void RemoveAppointment(MentorAppointment appointment) => db.MentorAppointments.Remove(appointment);

    // ------------------------------------------------------------------
    // Notifications
    // ------------------------------------------------------------------

    public async Task<List<MentorNotificationResponse>> GetNotificationsAsync(Guid mentorId, int take, CancellationToken cancellationToken = default)
        => await db.MentorNotifications.AsNoTracking()
            .Where(x => x.MentorId == mentorId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(take)
            .Select(x => new MentorNotificationResponse(x.Id, x.Type, x.Title, x.Message, x.IsRead, x.CreatedAt))
            .ToListAsync(cancellationToken);

    public async Task<MentorNotification?> GetNotificationForUpdateAsync(Guid id, Guid mentorId, CancellationToken cancellationToken = default)
        => await db.MentorNotifications
            .SingleOrDefaultAsync(x => x.Id == id && x.MentorId == mentorId, cancellationToken);

    public async Task MarkAllNotificationsReadAsync(Guid mentorId, CancellationToken cancellationToken = default)
        => await db.MentorNotifications
            .Where(x => x.MentorId == mentorId && !x.IsRead)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.IsRead, true)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow), cancellationToken);

    public void AddNotification(MentorNotification notification) => db.MentorNotifications.Add(notification);

    // ------------------------------------------------------------------
    // Student notifications
    // ------------------------------------------------------------------

    public async Task<List<StudentNotificationResponse>> GetStudentNotificationsAsync(Guid groupId, int take, CancellationToken cancellationToken = default)
        => await db.StudentNotifications.AsNoTracking()
            .Where(x => x.GroupId == groupId)
            .OrderByDescending(x => x.CreatedAt)
            .Take(take)
            .Select(x => new StudentNotificationResponse(
                x.Id, x.GroupId, x.RequestId, x.MentorName, x.GroupName,
                x.Type, x.Title, x.Message, x.IsRead, x.CreatedAt))
            .ToListAsync(cancellationToken);

    public async Task<StudentNotification?> GetStudentNotificationForUpdateAsync(Guid id, Guid groupId, CancellationToken cancellationToken = default)
        => await db.StudentNotifications
            .SingleOrDefaultAsync(x => x.Id == id && x.GroupId == groupId, cancellationToken);

    public async Task MarkAllStudentNotificationsReadAsync(Guid groupId, CancellationToken cancellationToken = default)
        => await db.StudentNotifications
            .Where(x => x.GroupId == groupId && !x.IsRead)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.IsRead, true)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow), cancellationToken);

    public void AddStudentNotification(StudentNotification notification) => db.StudentNotifications.Add(notification);

    // ------------------------------------------------------------------
    // Unit of work
    // ------------------------------------------------------------------

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        => db.SaveChangesAsync(cancellationToken);

    public async Task<IMentorTransaction> BeginTransactionAsync(IsolationLevel isolationLevel, CancellationToken cancellationToken = default)
        => new EfMentorTransaction(await db.Database.BeginTransactionAsync(isolationLevel, cancellationToken));

    private sealed class EfMentorTransaction(IDbContextTransaction transaction) : IMentorTransaction
    {
        public Task CommitAsync(CancellationToken cancellationToken = default) => transaction.CommitAsync(cancellationToken);

        public ValueTask DisposeAsync() => transaction.DisposeAsync();
    }
}
