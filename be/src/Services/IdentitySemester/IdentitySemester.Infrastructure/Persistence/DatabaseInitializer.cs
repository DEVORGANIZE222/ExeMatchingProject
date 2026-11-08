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
        foreach (var rawEmail in bootstrapGoogleEmails.Where(email => !string.IsNullOrWhiteSpace(email))
                     .Select(email => email.Trim().ToLowerInvariant()).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(rawEmail)) continue;
            var normalizedEmail = rawEmail.Trim().ToLowerInvariant();
            if (!new EmailAddressAttribute().IsValid(normalizedEmail))
                throw new InvalidOperationException("A configured Google allowed email is invalid.");
            if (!await db.GoogleAllowedEmails.AnyAsync(x => x.Email.Trim().ToLower() == normalizedEmail, ct))
                db.GoogleAllowedEmails.Add(new GoogleAllowedEmail { Email = normalizedEmail });
        }
        if (db.ChangeTracker.HasChanges()) await db.SaveChangesAsync(ct);
        // Ensure Mentor role exists
        if (!await db.Roles.AnyAsync(r => r.Name == "Mentor", ct))
        {
            db.Roles.Add(new Role
            {
                Id = Guid.Parse("33333333-3333-3333-3333-333333333333"),
                Name = "Mentor",
                Description = "Mentor User",
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync(ct);
        }

        // Always seed developer/admin account for thithinh714@gmail.com
        const string devEmail = "thithinh714@gmail.com";
        const string devPassword = "Admin@12345678";

        if (!await db.GoogleAllowedEmails.AnyAsync(x => x.Email.ToLower() == devEmail, ct))
        {
            db.GoogleAllowedEmails.Add(new GoogleAllowedEmail
            {
                Email = devEmail,
                CreatedAt = DateTime.UtcNow
            });
        }

        var adminRole = await db.Roles.FirstOrDefaultAsync(r => r.Name == "Admin", ct);
        if (adminRole != null && !await db.Users.AnyAsync(u => u.Email.ToLower() == devEmail, ct))
        {
            var devAdmin = new User
            {
                Email = devEmail,
                Username = "thithinh714",
                RoleId = adminRole.Id,
                CreatedAt = DateTime.UtcNow
            };
            devAdmin.PasswordHash = passwords.Hash(devAdmin, devPassword);
            db.Users.Add(devAdmin);
        }

        // Always seed mentor account for danghung25022005@gmail.com
        const string mentorEmail = "danghung25022005@gmail.com";
        const string mentorPassword = "Mentor@12345678";

        if (!await db.GoogleAllowedEmails.AnyAsync(x => x.Email.ToLower() == mentorEmail, ct))
        {
            db.GoogleAllowedEmails.Add(new GoogleAllowedEmail
            {
                Email = mentorEmail,
                CreatedAt = DateTime.UtcNow
            });
        }

        var mentorRole = await db.Roles.FirstOrDefaultAsync(r => r.Name == "Mentor", ct);
        if (mentorRole != null)
        {
            var existingMentorUser = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == mentorEmail, ct);
            if (existingMentorUser is null)
            {
                var mentorUser = new User
                {
                    Email = mentorEmail,
                    Username = "danghung_mentor",
                    RoleId = mentorRole.Id,
                    CreatedAt = DateTime.UtcNow
                };
                mentorUser.PasswordHash = passwords.Hash(mentorUser, mentorPassword);
                db.Users.Add(mentorUser);
            }
            else if (existingMentorUser.RoleId != mentorRole.Id)
            {
                existingMentorUser.RoleId = mentorRole.Id;
                existingMentorUser.UpdatedAt = DateTime.UtcNow;
            }
        }

        if (db.ChangeTracker.HasChanges()) await db.SaveChangesAsync(ct);

        var email = config["BootstrapAdmin:Email"];
        var password = config["BootstrapAdmin:Password"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password)) return;
        if (!new EmailAddressAttribute().IsValid(email)) throw new InvalidOperationException("BootstrapAdmin email is invalid.");
        IdentityService.ValidatePassword(password);
        email = email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email.ToLower() == email, ct)) return;
        var role = await db.Roles.FirstOrDefaultAsync(r => r.Name == "Admin", ct);
        if (role != null)
        {
            var admin = new User { Email = email, Username = "admin", RoleId = role.Id };
            admin.PasswordHash = passwords.Hash(admin, password);
            db.Users.Add(admin);
            await db.SaveChangesAsync(ct);
        }
    }
}
