using System.ComponentModel.DataAnnotations;
using EXETeamMatching.IdentitySemester.Application.Interfaces;
using EXETeamMatching.IdentitySemester.Application.Services;
using EXETeamMatching.IdentitySemester.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace EXETeamMatching.IdentitySemester.Infrastructure.Persistence;

public class DatabaseInitializer(IdentitySemesterDbContext db, IPasswordService passwords, IConfiguration config)
{
    public async Task Initialize(CancellationToken ct = default)
    {
        await db.Database.EnsureCreatedAsync(ct);
        if (db.Database.IsNpgsql())
        {
            var assembly = typeof(DatabaseInitializer).Assembly;
            using var stream = assembly.GetManifestResourceStream(assembly.GetManifestResourceNames().Single(n => n.EndsWith("identity-upgrade.sql")))!;
            using var reader = new StreamReader(stream);
            var sql = await reader.ReadToEndAsync(ct);
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            await db.Database.ExecuteSqlRawAsync(sql, ct);
            await transaction.CommitAsync(ct);
        }
        var mentorRoleId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        if (!await db.Roles.AnyAsync(role => role.Name == "Mentor", ct))
            db.Roles.Add(new Role { Id = mentorRoleId, Name = "Mentor", Description = "Mentor User" });
        var bootstrapGoogleEmails = config.GetSection("GoogleAuth:AllowedEmails").Get<string[]>() ?? [];
        foreach (var rawEmail in bootstrapGoogleEmails)
        {
            if (string.IsNullOrWhiteSpace(rawEmail)) continue;
            var normalizedEmail = rawEmail.Trim().ToLowerInvariant();
            if (!new EmailAddressAttribute().IsValid(normalizedEmail))
                throw new InvalidOperationException("A configured Google allowed email is invalid.");
            if (!await db.GoogleAllowedEmails.AnyAsync(x => x.Email == normalizedEmail, ct))
                db.GoogleAllowedEmails.Add(new GoogleAllowedEmail { Email = normalizedEmail });
        }
        if (db.ChangeTracker.HasChanges()) await db.SaveChangesAsync(ct);
        var email = config["BootstrapAdmin:Email"];
        var password = config["BootstrapAdmin:Password"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password)) return;
        if (!new EmailAddressAttribute().IsValid(email)) throw new InvalidOperationException("BootstrapAdmin email is invalid.");
        IdentityService.ValidatePassword(password);
        email = email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email.ToLower() == email, ct)) return;
        var role = await db.Roles.SingleAsync(r => r.Name == "Admin", ct);
        var admin = new User { Email = email, Username = "admin", RoleId = role.Id };
        admin.PasswordHash = passwords.Hash(admin, password);
        db.Users.Add(admin);
        await db.SaveChangesAsync(ct);
    }
}
