using EXETeamMatching.GroupMatching.Application.Services;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EXETeamMatching.GroupMatching.Api;

public sealed class GroupErrorHandler(RequestDelegate next, ILogger<GroupErrorHandler> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try { await next(context); }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { }
        catch (Exception ex)
        {
            var (status, message) = ex switch
            {
                GroupException e => (e.StatusCode, e.Message),
                DbUpdateConcurrencyException => (409, "The group changed. Reload and retry."),
                DbUpdateException { InnerException: PostgresException { SqlState: "23505" } } => (409, "This student is already in a group or a duplicate group code exists."),
                _ => (500, "An unexpected GroupMatching error occurred. Contact the administrator with the trace ID.")
            };
            if (status >= 500) logger.LogError(ex, "GroupMatching request failed. Trace {TraceId}", context.TraceIdentifier);
            context.Response.StatusCode = status;
            await context.Response.WriteAsJsonAsync(ApiResponse<object>.Fail(message, [context.TraceIdentifier]));
        }
    }
}
