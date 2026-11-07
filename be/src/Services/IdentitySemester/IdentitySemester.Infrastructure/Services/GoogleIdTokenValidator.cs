using EXETeamMatching.IdentitySemester.Application.Interfaces;
using Google.Apis.Auth;
using Microsoft.Extensions.Options;

namespace EXETeamMatching.IdentitySemester.Infrastructure.Services;

public sealed class GoogleAuthSettings
{
    public List<string> ClientIds { get; set; } = [];
    public List<string> AllowedEmails { get; set; } = [];
}

public sealed class GoogleIdTokenValidator(IOptions<GoogleAuthSettings> options) : IGoogleIdTokenValidator
{
    public bool IsAllowedEmail(string email) => options.Value.AllowedEmails
        .Any(allowed => string.Equals(allowed.Trim(), email, StringComparison.OrdinalIgnoreCase));

    public async Task<GoogleIdentity> ValidateAsync(string credential, CancellationToken ct)
    {
        var clientIds = options.Value.ClientIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .ToArray();

        if (clientIds.Length == 0)
            throw new IdentityException(503, "Google sign-in is not configured.");

        try
        {
            var payload = await GoogleJsonWebSignature.ValidateAsync(credential,
                new GoogleJsonWebSignature.ValidationSettings { Audience = clientIds });
            return new GoogleIdentity(payload.Subject, payload.Email, payload.EmailVerified, payload.HostedDomain, payload.Name, payload.Picture);
        }
        catch (InvalidJwtException)
        {
            throw new IdentityException(401, "Invalid Google credential.");
        }
        catch (ArgumentException)
        {
            throw new IdentityException(401, "Invalid Google credential.");
        }
    }
}
