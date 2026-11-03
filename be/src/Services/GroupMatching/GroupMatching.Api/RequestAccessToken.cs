using EXETeamMatching.GroupMatching.Infrastructure.Services;

namespace EXETeamMatching.GroupMatching.Api;

public sealed class RequestAccessToken(IHttpContextAccessor context) : IRequestAccessToken
{
    public string? Value
    {
        get
        {
            var value = context.HttpContext?.Request.Headers.Authorization.ToString();
            return value?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) == true ? value[7..].Trim() : null;
        }
    }
}
