using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using EXETeamMatching.IdentitySemester.Application.Interfaces;
using EXETeamMatching.IdentitySemester.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace EXETeamMatching.IdentitySemester.Infrastructure.Services;

public class JwtSettings
{
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "EXETeamMatching";
    public string Audience { get; set; } = "EXETeamMatchingClients";
    public int ExpirationInMinutes { get; set; } = 120;
}
public class JwtService(IOptions<JwtSettings> options) : IJwtService, ITokenIssuer
{
    public (string Token, DateTime Expiration) Issue(User user) => IssueToken(user, user.Role.Name);
    private (string Token, DateTime Expiration) IssueToken(User user, string roleName)
    {
        var settings = options.Value;
        var expires = DateTime.UtcNow.AddMinutes(settings.ExpirationInMinutes);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim("role", roleName),
            new Claim("ver", user.TokenVersion.ToString())
        };
        var credentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.Secret)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(settings.Issuer, settings.Audience, claims, DateTime.UtcNow, expires, credentials);
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
    public string GenerateToken(User user, string roleName) => IssueToken(user, roleName).Token;
}
public class PasswordService : IPasswordService
{
    private readonly PasswordHasher<User> hasher = new();
    public string Hash(User user, string password) => hasher.HashPassword(user, password);
    public bool Verify(User user, string password)
    {
        try { return hasher.VerifyHashedPassword(user, user.PasswordHash, password) != PasswordVerificationResult.Failed; }
        catch (FormatException) { return false; }
        catch (ArgumentException) { return false; }
    }
}
