using EXETeamMatching.IdentitySemester.Application.Interfaces;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EXETeamMatching.IdentitySemester.Api;

public class IdentityErrorHandler(RequestDelegate next, ILogger<IdentityErrorHandler> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try { await next(context); }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { }
        catch (Exception ex)
        {
            var (status, message) = ex switch
            {
                IdentityException e => (e.StatusCode, e.Message),
                DbUpdateConcurrencyException => (409, "The record changed. Reload and retry."),
                DbUpdateException { InnerException: PostgresException { SqlState: "23505" } } => (409, "A conflicting email, student code or semester code already exists."),
                DbUpdateException { InnerException: PostgresException { SqlState: "23503" } } => (409, "The record is still referenced by other data."),
                _ => (500, "An unexpected error occurred. Contact the administrator with the trace ID.")
            };
            if (status >= 500) logger.LogError(ex, "Identity request failed. Trace {TraceId}", context.TraceIdentifier);
            context.Response.StatusCode = status;
            await context.Response.WriteAsJsonAsync(ApiResponse<object>.Fail(message, [context.TraceIdentifier]));
        }
    }
}
