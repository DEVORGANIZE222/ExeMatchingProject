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
        // Allow developer/Swagger manual testing without a browser-issued Google OAuth JWT
        if (!string.IsNullOrWhiteSpace(credential))
        {
            var trimmed = credential.Trim().Trim('"').Trim('\'');
            if (trimmed.StartsWith("dev-google:", StringComparison.OrdinalIgnoreCase) ||
                trimmed.StartsWith("dev:", StringComparison.OrdinalIgnoreCase) ||
                (trimmed.Contains('@') && !trimmed.Contains(' ') && !trimmed.StartsWith("eyJ")))
            {
                var testEmail = trimmed.Contains(':') ? trimmed.Split(':')[1].Trim() : trimmed;
                if (testEmail.Contains('@'))
                {
                    var parts = testEmail.Split('@');
                    return new GoogleIdentity(
                        Subject: $"dev-sub-{testEmail.ToLowerInvariant()}",
                        Email: testEmail.ToLowerInvariant(),
                        EmailVerified: true,
                        HostedDomain: parts.Length > 1 ? parts[1].ToLowerInvariant() : null,
                        DisplayName: parts[0]
                    );
                }
            }
        }

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
            return new GoogleIdentity(payload.Subject, payload.Email, payload.EmailVerified, payload.HostedDomain, payload.Name);
        }
        catch (InvalidJwtException ex)
        {
            throw new IdentityException(401, $"Invalid Google credential: {ex.Message}");
        }
        catch (ArgumentException ex)
        {
            throw new IdentityException(401, $"Invalid Google credential: {ex.Message}");
        }
    }
}
