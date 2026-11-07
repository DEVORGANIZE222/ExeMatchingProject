using System.Text.Json;
using EXETeamMatching.Contracts.Events;
using EXETeamMatching.IdentitySemester.Application.DTOs;
using EXETeamMatching.IdentitySemester.Application.Interfaces;
using EXETeamMatching.IdentitySemester.Application.Services;
using EXETeamMatching.IdentitySemester.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace EXETeamMatching.IdentitySemester.Infrastructure.Persistence;

public class IdentityRepository(IdentitySemesterDbContext db) : IIdentityStore
{
    private IQueryable<Student> StudentQuery => db.Students.Include(s => s.User).ThenInclude(u => u.Role).Include(s => s.Semester).Include(s => s.StrengthRoles);
    public Task<User?> UserByEmail(string email, CancellationToken ct) => db.Users.Include(u => u.Role).SingleOrDefaultAsync(u => u.Email.ToLower() == email, ct);
    public Task<User?> UserByGoogleSubject(string subject, CancellationToken ct) => db.Users.Include(u => u.Role).SingleOrDefaultAsync(u => u.GoogleSubject == subject, ct);
    public Task<User?> UserById(Guid id, CancellationToken ct) => db.Users.Include(u => u.Role).SingleOrDefaultAsync(u => u.Id == id, ct);
    public Task<Student?> StudentById(Guid id, CancellationToken ct) => StudentQuery.SingleOrDefaultAsync(s => s.Id == id, ct);
    public Task<Student?> StudentByUser(Guid id, CancellationToken ct) => StudentQuery.OrderByDescending(s => s.Semester.StartDate).FirstOrDefaultAsync(s => s.UserId == id, ct);
    public Task<Student?> StudentByUserSemester(Guid userId, string semesterCode, CancellationToken ct) => StudentQuery
        .SingleOrDefaultAsync(s => s.UserId == userId && s.Semester.Code == semesterCode, ct);
    public Task<Semester?> SemesterById(Guid id, CancellationToken ct) => db.Semesters.SingleOrDefaultAsync(s => s.Id == id, ct);
    public Task<Semester?> SemesterByCode(string code, CancellationToken ct) => db.Semesters.SingleOrDefaultAsync(s => s.Code.ToUpper() == code, ct);
    public Task<bool> StudentExists(string code, Guid semesterId, CancellationToken ct) => db.Students.AnyAsync(s => s.StudentCode.ToUpper() == code && s.SemesterId == semesterId, ct);
    public Task<bool> SemesterHasStudents(Guid id, CancellationToken ct) => db.Students.AnyAsync(s => s.SemesterId == id, ct);
    public async Task<IReadOnlyList<StudentStrengthRole>> StudentStrengthRoles(Guid studentId, CancellationToken ct)
        => await db.StudentStrengthRoles.Where(x => x.StudentId == studentId).OrderBy(x => x.RoleCode).ToListAsync(ct);
    public Task<bool> EnrollmentExists(Guid userId, Guid semesterId, CancellationToken ct) => db.Students.AnyAsync(s => s.UserId == userId && s.SemesterId == semesterId, ct);
    public Task<Role> RoleByName(string name, CancellationToken ct) => db.Roles.SingleAsync(r => r.Name == name, ct);
    public Task<bool> GoogleEmailAllowed(string email, CancellationToken ct) => db.GoogleAllowedEmails.AnyAsync(x => x.Email == email, ct);
    public async Task<IReadOnlyList<GoogleAllowedEmail>> GoogleAllowedEmails(CancellationToken ct) => await db.GoogleAllowedEmails.AsNoTracking().OrderBy(x => x.Email).ToListAsync(ct);

    public async Task<PageResult<StudentResponse>> Students(ListQuery query, CancellationToken ct)
    {
        ValidatePage(query);
        var students = StudentQuery.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            students = students.Where(s => s.FullName.ToLower().Contains(term) || s.StudentCode.ToLower().Contains(term) || s.User.Email.ToLower().Contains(term));
        }
        if (!string.IsNullOrWhiteSpace(query.SemesterCode)) students = students.Where(s => s.Semester.Code == query.SemesterCode.Trim().ToUpper());
        if (query.HasGroup.HasValue) students = students.Where(s => s.HasGroup == query.HasGroup.Value);
        var count = await students.CountAsync(ct);
        var ordered = (query.SortBy.ToLowerInvariant(), query.Descending) switch
        {
            ("code", false) => students.OrderBy(s => s.StudentCode), ("code", true) => students.OrderByDescending(s => s.StudentCode),
            ("name", false) => students.OrderBy(s => s.FullName), ("name", true) => students.OrderByDescending(s => s.FullName),
            ("email", false) => students.OrderBy(s => s.User.Email), ("email", true) => students.OrderByDescending(s => s.User.Email),
            _ => throw new IdentityException(400, "SortBy must be code, name or email.")
        };
        var rows = await ordered.ThenBy(s => s.Id).Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync(ct);
        return new(rows.Select(IdentityService.Map).ToList(), count, query.Page, query.PageSize);
    }
    public async Task<PageResult<SemesterDto>> Semesters(ListQuery query, CancellationToken ct)
    {
        ValidatePage(query);
        var semesters = db.Semesters.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            semesters = semesters.Where(s => s.Code.ToLower().Contains(term) || s.Name.ToLower().Contains(term));
        }
        if (query.IsActive.HasValue) semesters = semesters.Where(s => s.IsActive == query.IsActive.Value);
        var count = await semesters.CountAsync(ct);
        var ordered = (query.SortBy.ToLowerInvariant(), query.Descending) switch
        {
            ("code", false) => semesters.OrderBy(s => s.Code), ("code", true) => semesters.OrderByDescending(s => s.Code),
            ("name", false) => semesters.OrderBy(s => s.Name), ("name", true) => semesters.OrderByDescending(s => s.Name),
            ("startdate", false) => semesters.OrderBy(s => s.StartDate), ("startdate", true) => semesters.OrderByDescending(s => s.StartDate),
            _ => throw new IdentityException(400, "SortBy must be code, name or startDate.")
        };
        var rows = await ordered.ThenBy(s => s.Id).Skip((query.Page - 1) * query.PageSize).Take(query.PageSize).ToListAsync(ct);
        return new(rows.Select(IdentityService.Map).ToList(), count, query.Page, query.PageSize);
    }
    private static void ValidatePage(ListQuery query)
    {
        if (query.Page < 1 || query.PageSize is < 1 or > 2000 || (long)(query.Page - 1) * query.PageSize > int.MaxValue)
            throw new IdentityException(400, "Invalid pagination.");
    }
    public void AddStudent(Student student)
    {
        // Existing users/semester are tracked; mark only new entities as Added.
        if (db.Entry(student.User).State == EntityState.Detached) db.Users.Add(student.User);
        db.Entry(student).State = EntityState.Added;
        var payload = new StudentImportedEvent(student.Id, student.StudentCode, student.FullName, student.User.Email, student.Semester.Code, DateTime.UtcNow);
        AddOutboxEvent("student-imported", payload);
    }
    public void AddUser(User user) => db.Users.Add(user);
    public void RemoveStudent(Student student) => db.Students.Remove(student);
    public async Task DeleteStudentEnrollment(Guid studentId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
        var student = await db.Students.Include(s => s.User).ThenInclude(u => u.Role).SingleOrDefaultAsync(s => s.Id == studentId, ct)
            ?? throw new IdentityException(404, "Student not found.");
        await DeleteEnrollments([student], ct);
        await tx.CommitAsync(ct);
    }
    public async Task<int> DeleteStudentsBySemester(Guid semesterId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, ct);
        var students = await db.Students.Include(s => s.User).ThenInclude(u => u.Role).Where(s => s.SemesterId == semesterId).ToListAsync(ct);
        await DeleteEnrollments(students, ct);
        await tx.CommitAsync(ct);
        return students.Count;
    }
    private async Task DeleteEnrollments(List<Student> students, CancellationToken ct)
    {
        if (students.Count == 0) return;
        if (students.Any(s => s.HasGroup))
            throw new IdentityException(409, "Remove group membership through GroupMatching before deleting students.");
        var studentIds = students.Select(s => s.Id).ToList();
        var userIds = students.Select(s => s.UserId).Distinct().ToList();
        var remaining = await db.Students.Where(s => userIds.Contains(s.UserId) && !studentIds.Contains(s.Id))
            .Select(s => s.UserId).Distinct().ToListAsync(ct);
        var affected = students.Select(s => s.User).DistinctBy(u => u.Id)
            .Where(u => u.Role.Name == "Student" && !remaining.Contains(u.Id)).ToList();
        var emails = affected.Select(u => u.Email.Trim().ToLower()).ToList();
        var allowed = await db.GoogleAllowedEmails.Where(e => emails.Contains(e.Email.Trim().ToLower())).ToListAsync(ct);
        db.GoogleAllowedEmails.RemoveRange(allowed);
        foreach (var user in affected) { user.TokenVersion++; user.UpdatedAt = DateTime.UtcNow; }
        var roles = await db.StudentStrengthRoles.Where(r => studentIds.Contains(r.StudentId)).ToListAsync(ct);
        db.StudentStrengthRoles.RemoveRange(roles);
        db.Students.RemoveRange(students);
        await db.SaveChangesAsync(ct);
    }
    public void AddSemester(Semester semester) => db.Semesters.Add(semester);
    public void RemoveSemester(Semester semester) => db.Semesters.Remove(semester);
    public void AddGoogleAllowedEmail(GoogleAllowedEmail email) => db.GoogleAllowedEmails.Add(email);
    public void RemoveGoogleAllowedEmail(GoogleAllowedEmail email) => db.GoogleAllowedEmails.Remove(email);
    public void AddStudentStrengthRole(StudentStrengthRole role) => db.StudentStrengthRoles.Add(role);
    public void RemoveStudentStrengthRole(StudentStrengthRole role) => db.StudentStrengthRoles.Remove(role);
    public void AddOutboxEvent(string topic, object payload) => db.StudentEventOutbox.Add(new StudentEventOutbox
    {
        Topic = topic,
        Payload = JsonSerializer.Serialize(payload)
    });
    public Task Save(CancellationToken ct) => db.SaveChangesAsync(ct);
}
