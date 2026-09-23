using EXETeamMatching.IdentitySemester.Application.Interfaces;
using EXETeamMatching.IdentitySemester.Domain.Entities;

namespace EXETeamMatching.IdentitySemester.Infrastructure.Services;

public class JwtSettings
{
    public string Secret { get; set; } = "SuperSecretKeyForJWTTokenGeneration12345!";
    public string Issuer { get; set; } = "EXETeamMatching";
    public string Audience { get; set; } = "EXETeamMatchingClients";
    public int ExpirationInMinutes { get; set; } = 120;
}

public class JwtService : IJwtService
{
    public string GenerateToken(User user, string roleName)
    {
        return "placeholder_jwt_token_" + user.Id;
    }
}
