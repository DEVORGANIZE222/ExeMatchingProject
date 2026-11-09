using System.Net;
using System.Net.Http.Json;
using EXETeamMatching.Mentor.Application.DTOs;
using EXETeamMatching.Mentor.Domain.Entities;
using EXETeamMatching.Mentor.Infrastructure.Persistence;
using EXETeamMatching.SharedKernel.Models;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EXETeamMatching.Mentor.Tests.Integration;

[Collection(MentorApiCollection.Name)]
[Trait("Category", "Integration")]
public class MentorApiIntegrationTests(MentorApiFixture fixture)
{
    // ------------------------------------------------------------------
    // GET /api/mentors
    // ------------------------------------------------------------------

    [PostgresFact]
    public async Task GetMentors_FiltersPagesAndReturnsPagingHeaders()
    {
        var tag = await SeedTaggedMentorsAsync(12);
        using var admin = fixture.ClientFor("Admin");

        // Case-insensitive name search, page 3 of 3 with size 5 -> last 2 records.
        var (page, response) = await GetMentorsAsync(admin, $"?search={tag.ToUpperInvariant()}&pageIndex=3&pageSize=5");
        Assert.Equal(new[] { $"{tag} Mentor 10", $"{tag} Mentor 11" }, page.Select(m => m.FullName));
        AssertHeaders(response, total: 12, index: 3, size: 5, pages: 3);

        // Email search.
        (page, _) = await GetMentorsAsync(admin, $"?search=m03.{tag}");
        Assert.Equal($"{tag} Mentor 03", Assert.Single(page).FullName);

        // Department filter (odd indexes), case-insensitive contains.
        (page, response) = await GetMentorsAsync(admin, $"?search={tag}&department=INFORMATION&pageSize=100");
        Assert.Equal(6, page.Count);
        Assert.All(page, m => Assert.Equal("Information Assurance", m.Department));
        AssertHeaders(response, total: 6, index: 1, size: 100, pages: 1);

        // Expertise filter (index % 3 == 0 -> 0,3,6,9).
        (page, _) = await GetMentorsAsync(admin, $"?search={tag}&expertise=cloud&pageSize=100");
        Assert.Equal(4, page.Count);

        // Combined filters -> 3 and 9.
        (page, _) = await GetMentorsAsync(admin, $"?search={tag}&department=information&expertise=CLOUD");
        Assert.Equal(new[] { $"{tag} Mentor 03", $"{tag} Mentor 09" }, page.Select(m => m.FullName));

        // Page beyond the last one -> empty list, totals still reported.
        (page, response) = await GetMentorsAsync(admin, $"?search={tag}&pageIndex=4&pageSize=5");
        Assert.Empty(page);
        AssertHeaders(response, total: 12, index: 4, size: 5, pages: 3);

        // No match.
        (page, response) = await GetMentorsAsync(admin, $"?search=no-such-mentor-{tag}");
        Assert.Empty(page);
        AssertHeaders(response, total: 0, index: 1, size: 10, pages: 0);
    }

    [PostgresFact]
    public async Task GetMentors_WithoutQuery_UsesDefaultPageOfTenAndKeepsListBody()
    {
        await SeedTaggedMentorsAsync(12);
        using var student = fixture.ClientFor("Student");

        var response = await student.GetAsync("/api/mentors");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<List<MentorResponse>>>();

        // Existing FE contract: ApiResponse with `data` as a plain array.
        Assert.True(body!.Success);
        Assert.Equal(10, body.Data!.Count);
        Assert.Equal("10", response.Headers.GetValues("X-Page-Size").Single());
        Assert.True(int.Parse(response.Headers.GetValues("X-Total-Count").Single()) >= 12);
    }

    [PostgresFact]
    public async Task GetMentors_SearchMatchesVietnameseCaseInsensitively()
    {
        using var admin = fixture.ClientFor("Admin");
        // Seeded mentor "ThS. Đặng Hùng (Mentor)".
        var (page, _) = await GetMentorsAsync(admin, "?search=đặng hùng");
        Assert.Contains(page, m => m.FullName == "ThS. Đặng Hùng (Mentor)");
    }

    [PostgresFact]
    public async Task GetMentors_InvalidPaging_ReturnsBadRequest()
    {
        using var admin = fixture.ClientFor("Admin");
        foreach (var query in new[] { "?pageIndex=0", "?pageIndex=-1", "?pageSize=0", "?pageSize=101", "?pageIndex=2147483647&pageSize=100", "?pageIndex=abc" })
        {
            var response = await admin.GetAsync("/api/mentors" + query);
            Assert.True(response.StatusCode == HttpStatusCode.BadRequest,
                $"{query} returned {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        }

        var max = await admin.GetAsync("/api/mentors?pageSize=100");
        Assert.Equal(HttpStatusCode.OK, max.StatusCode);
    }

    // ------------------------------------------------------------------
    // Authorization
    // ------------------------------------------------------------------

    [PostgresFact]
    public async Task Authorization_IsEnforcedOnMentorEndpoints()
    {
        var unknown = Guid.NewGuid();
        using var anonymous = fixture.ClientFor(null);
        using var student = fixture.ClientFor("Student");
        using var mentor = fixture.ClientFor("Mentor");
        using var admin = fixture.ClientFor("Admin");

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/mentors")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.DeleteAsync($"/api/mentors/{unknown}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await student.DeleteAsync($"/api/mentors/{unknown}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await mentor.DeleteAsync($"/api/mentors/{unknown}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.DeleteAsync($"/api/mentors/{unknown}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await student.PutAsJsonAsync($"/api/mentors/{unknown}/quota", new UpdateMentorQuotaRequest(3))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.GetAsync("/api/mentors/me")).StatusCode);
    }

    // ------------------------------------------------------------------
    // DELETE /api/mentors/{id}
    // ------------------------------------------------------------------

    [PostgresFact]
    public async Task DeleteMentor_RemovesProfileQuotaAndAllMentorScopedRows_OnlyForThatMentor()
    {
        var target = await SeedMentorWithHistoryAsync(currentAssigned: 0);
        var bystander = await SeedMentorWithHistoryAsync(currentAssigned: 0);
        using var admin = fixture.ClientFor("Admin");

        var response = await admin.DeleteAsync($"/api/mentors/{target.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(0, await CountRowsAsync(target.Id));
        Assert.Equal(7, await CountRowsAsync(bystander.Id));
        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync($"/api/mentors/{target.Id}")).StatusCode);

        // The IdentitySemester account is untouched: its mentor login now has no profile...
        using var orphanedMentor = fixture.ClientFor("Mentor", target.UserId);
        Assert.Equal(HttpStatusCode.NotFound, (await orphanedMentor.GetAsync("/api/mentors/me")).StatusCode);

        // ...and an admin can re-create the profile for the same account.
        var recreate = await admin.PostAsJsonAsync("/api/mentors", new CreateMentorProfileRequest(
            target.UserId, "Re-created Mentor", target.Email, "Software Engineering", "AI", "", 3));
        Assert.Equal(HttpStatusCode.Created, recreate.StatusCode);
    }

    [PostgresFact]
    public async Task DeleteMentor_WithAssignedGroups_IsRejectedAndKeepsData()
    {
        var mentor = await SeedMentorWithHistoryAsync(currentAssigned: 1);
        using var admin = fixture.ClientFor("Admin");

        var response = await admin.DeleteAsync($"/api/mentors/{mentor.Id}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(7, await CountRowsAsync(mentor.Id));
    }

    [PostgresFact]
    public async Task DeleteMentor_WhenFinalDeleteFails_RollsBackWorkspaceDeletes()
    {
        var mentor = await SeedMentorWithHistoryAsync(currentAssigned: 0);
        var triggerName = "block_delete_" + mentor.Id.ToString("N");
        await fixture.WithDbAsync(db => db.Database.ExecuteSqlRawAsync($"""
            CREATE FUNCTION "{triggerName}"() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                IF OLD."Id" = '{mentor.Id}' THEN RAISE EXCEPTION 'simulated failure'; END IF;
                RETURN OLD;
            END $$;
            CREATE TRIGGER "{triggerName}" BEFORE DELETE ON "Mentors" FOR EACH ROW EXECUTE FUNCTION "{triggerName}"();
            """));
        try
        {
            using var admin = fixture.ClientFor("Admin");
            var response = await admin.DeleteAsync($"/api/mentors/{mentor.Id}");

            Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
            // Requests, progress, appointments and notifications were bulk-deleted before the failing
            // statement; they must all be back after rollback.
            Assert.Equal(7, await CountRowsAsync(mentor.Id));
        }
        finally
        {
            await fixture.WithDbAsync(db => db.Database.ExecuteSqlRawAsync(
                $"DROP TRIGGER IF EXISTS \"{triggerName}\" ON \"Mentors\"; DROP FUNCTION IF EXISTS \"{triggerName}\"();"));
        }
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private static async Task<(List<MentorResponse> Page, HttpResponseMessage Response)> GetMentorsAsync(HttpClient client, string query)
    {
        var response = await client.GetAsync("/api/mentors" + query);
        Assert.True(response.StatusCode == HttpStatusCode.OK,
            $"GET /api/mentors{query} returned {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<List<MentorResponse>>>();
        return (body!.Data!, response);
    }

    private static void AssertHeaders(HttpResponseMessage response, int total, int index, int size, int pages)
    {
        Assert.Equal(total.ToString(), response.Headers.GetValues("X-Total-Count").Single());
        Assert.Equal(index.ToString(), response.Headers.GetValues("X-Page-Index").Single());
        Assert.Equal(size.ToString(), response.Headers.GetValues("X-Page-Size").Single());
        Assert.Equal(pages.ToString(), response.Headers.GetValues("X-Total-Pages").Single());
    }

    /// <summary>Creates mentors "{tag} Mentor 00..NN"; returns the lowercase tag.</summary>
    private async Task<string> SeedTaggedMentorsAsync(int count)
    {
        var tag = "zq" + Guid.NewGuid().ToString("N")[..8];
        await fixture.WithDbAsync(async db =>
        {
            for (var i = 0; i < count; i++)
            {
                var mentor = new MentorUser
                {
                    UserId = Guid.NewGuid(),
                    FullName = $"{tag} Mentor {i:00}",
                    Email = $"m{i:00}.{tag}@fpt.edu.vn",
                    Department = i % 2 == 0 ? "Software Engineering" : "Information Assurance",
                    Expertise = i % 3 == 0 ? "Cloud, AI" : "Mobile"
                };
                mentor.Quota = new MentorQuota { MentorId = mentor.Id, MaxQuota = 5 };
                db.Mentors.Add(mentor);
            }
            await db.SaveChangesAsync();
        });
        return tag;
    }

    /// <summary>
    /// Mentor + quota + 2 requests (pending, rejected) + progress + appointment + notification = 7 rows.
    /// </summary>
    private async Task<MentorUser> SeedMentorWithHistoryAsync(int currentAssigned)
    {
        var id = Guid.NewGuid().ToString("N")[..8];
        var mentor = new MentorUser
        {
            UserId = Guid.NewGuid(),
            FullName = $"History Mentor {id}",
            Email = $"history.{id}@fpt.edu.vn",
            Department = "Software Engineering",
            Expertise = "AI"
        };
        mentor.Quota = new MentorQuota { MentorId = mentor.Id, MaxQuota = 5, CurrentAssigned = currentAssigned };
        await fixture.WithDbAsync(async db =>
        {
            db.Mentors.Add(mentor);
            db.MentorRequests.Add(new MentorRequest { GroupId = Guid.NewGuid(), MentorId = mentor.Id, Message = "pending", Status = RequestStatus.Pending });
            db.MentorRequests.Add(new MentorRequest { GroupId = Guid.NewGuid(), MentorId = mentor.Id, Message = "old", Status = RequestStatus.Rejected });
            db.MentorGroupProgress.Add(new MentorGroupProgress { MentorId = mentor.Id, GroupId = Guid.NewGuid(), GroupName = "G", Topic = "T", Milestone = "M" });
            db.MentorAppointments.Add(new MentorAppointment { MentorId = mentor.Id, Title = "Sync", StartsAt = DateTime.UtcNow.AddDays(1) });
            db.MentorNotifications.Add(new MentorNotification { MentorId = mentor.Id, Type = "request", Title = "t", Message = "m" });
            await db.SaveChangesAsync();
        });
        return mentor;
    }

    private Task<int> CountRowsAsync(Guid mentorId) => fixture.WithDbAsync(async (MentorDbContext db) =>
        await db.Mentors.CountAsync(x => x.Id == mentorId)
        + await db.MentorQuotas.CountAsync(x => x.MentorId == mentorId)
        + await db.MentorRequests.CountAsync(x => x.MentorId == mentorId)
        + await db.MentorGroupProgress.CountAsync(x => x.MentorId == mentorId)
        + await db.MentorAppointments.CountAsync(x => x.MentorId == mentorId)
        + await db.MentorNotifications.CountAsync(x => x.MentorId == mentorId));
}
