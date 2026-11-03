using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using EXETeamMatching.GroupMatching.Application.DTOs;
using EXETeamMatching.GroupMatching.Application.Interfaces;
using EXETeamMatching.GroupMatching.Application.Services;

namespace EXETeamMatching.GroupMatching.Infrastructure.Services;

public interface IRequestAccessToken { string? Value { get; } }

public sealed class IdentitySemesterClient(HttpClient client, IRequestAccessToken accessToken) : IIdentitySemesterClient
{
    public Task<EnrollmentContext> CurrentEnrollmentAsync(string semesterCode, CancellationToken ct = default)
        => GetAsync<EnrollmentContext>($"api/internal/students/current?semesterCode={Uri.EscapeDataString(semesterCode)}", ct);

    public Task<SemesterWorkflowContext> WorkflowAsync(string semesterCode, CancellationToken ct = default)
        => GetAsync<SemesterWorkflowContext>($"api/internal/semesters/{Uri.EscapeDataString(semesterCode)}/workflow", ct);

    public async Task<IReadOnlyList<EnrollmentContext>> UnmatchedEnrollmentsAsync(string semesterCode, CancellationToken ct = default)
    {
        var page = await GetAsync<IdentityPage<IdentityStudent>>($"api/students?semesterCode={Uri.EscapeDataString(semesterCode)}&hasGroup=false&page=1&pageSize=2000", ct);
        return page.Items.Select(x => new EnrollmentContext(x.Id, x.UserId, x.StudentCode, x.FullName, x.SemesterCode, x.HasGroup)).ToList();
    }

    private async Task<T> GetAsync<T>(string path, CancellationToken ct) where T : class
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        if (!string.IsNullOrWhiteSpace(accessToken.Value)) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken.Value);
        using var response = await client.SendAsync(request, ct);
        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<T>>(cancellationToken: ct);
        if (!response.IsSuccessStatusCode || envelope?.Data is null)
            throw new GroupException(response.StatusCode == HttpStatusCode.Forbidden ? 403 : 409, envelope?.Message ?? "IdentitySemester context is unavailable.");
        return envelope.Data;
    }

    private sealed record ApiEnvelope<T>(bool Success, string? Message, T? Data);
    private sealed record IdentityPage<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize);
    private sealed record IdentityStudent(Guid Id, Guid UserId, string StudentCode, string FullName, string SemesterCode, bool HasGroup);
}
