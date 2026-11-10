using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
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
            if (!new EmailAddressAttribute().IsValid(rawEmail))
                throw new InvalidOperationException("A configured Google allowed email is invalid.");
            if (!await db.GoogleAllowedEmails.AnyAsync(x => x.Email.Trim().ToLower() == rawEmail, ct))
                db.GoogleAllowedEmails.Add(new GoogleAllowedEmail { Email = rawEmail });
        }
        if (db.ChangeTracker.HasChanges()) await db.SaveChangesAsync(ct);

        await SeedBootstrapAccountAsync(
            sectionName: "BootstrapAdmin",
            roleName: "Admin",
            defaultUsername: "admin",
            ct: ct);

        await SeedBootstrapAccountAsync(
            sectionName: "BootstrapMentor",
            roleName: "Mentor",
            defaultUsername: "mentor",
            ct: ct);
    }

    private async Task SeedBootstrapAccountAsync(
        string sectionName,
        string roleName,
        string defaultUsername,
        CancellationToken ct)
    {
        var email = config[$"{sectionName}:Email"];
        if (string.IsNullOrWhiteSpace(email)) return;
        if (!new EmailAddressAttribute().IsValid(email))
            throw new InvalidOperationException($"{sectionName} email is invalid.");

        email = email.Trim().ToLowerInvariant();
        var password = config[$"{sectionName}:Password"];
        if (!string.IsNullOrWhiteSpace(password))
            IdentityService.ValidatePassword(password);

        if (!await db.GoogleAllowedEmails.AnyAsync(x => x.Email.Trim().ToLower() == email, ct))
            db.GoogleAllowedEmails.Add(new GoogleAllowedEmail { Email = email });

        var existingUser = await db.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == email, ct);
        if (existingUser is null)
        {
            var role = await db.Roles.FirstOrDefaultAsync(r => r.Name == roleName, ct);
            if (role is not null)
            {
                Guid? preferredId = Guid.TryParse(config[$"{sectionName}:UserId"], out var configuredId)
                    ? configuredId
                    : null;
                var userId = preferredId.HasValue && !await db.Users.AnyAsync(u => u.Id == preferredId.Value, ct)
                    ? preferredId.Value
                    : Guid.NewGuid();

                var username = email.Split('@')[0];
                var user = new User
                {
                    Id = userId,
                    Email = email,
                    Username = string.IsNullOrWhiteSpace(username) ? defaultUsername : username,
                    RoleId = role.Id
                };
                // If no explicit bootstrap password is provided, use an unguessable random hash (Google OAuth sign-in only).
                var effectiveSecret = string.IsNullOrWhiteSpace(password)
                    ? Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
                    : password;
                user.PasswordHash = passwords.Hash(user, effectiveSecret);
                db.Users.Add(user);
            }
        }

        if (db.ChangeTracker.HasChanges()) await db.SaveChangesAsync(ct);
    }
}
