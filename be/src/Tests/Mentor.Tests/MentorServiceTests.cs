using EXETeamMatching.Mentor.Application.DTOs;
using EXETeamMatching.Mentor.Application.Interfaces;
using EXETeamMatching.Mentor.Application.Services;
using EXETeamMatching.Mentor.Domain.Entities;
using EXETeamMatching.Messaging.Abstractions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace EXETeamMatching.Mentor.Tests;

public class MentorServiceTests
{
    private readonly Mock<IMentorRepository> _repository = new(MockBehavior.Strict);
    private readonly MentorService _service;

    public MentorServiceTests()
    {
        _service = new MentorService(
            _repository.Object,
            Mock.Of<IHttpClientFactory>(),
            new ConfigurationBuilder().Build(),
            Mock.Of<IEventPublisher>(),
            NullLogger<MentorService>.Instance);
    }

    // ------------------------------------------------------------------
    // Quota boundary
    // ------------------------------------------------------------------

    [Theory]
    [InlineData(3, 2)]
    [InlineData(5, 1)]
    public async Task UpdateQuotaAsync_BelowCurrentAssigned_ThrowsAndDoesNotSave(int currentAssigned, int newMaxQuota)
    {
        var mentor = CreateMentor("Dr. Le Van C", maxQuota: 5, currentAssigned: currentAssigned);
        _repository.Setup(r => r.GetByIdForUpdateAsync(mentor.Id, It.IsAny<CancellationToken>())).ReturnsAsync(mentor);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => _service.UpdateQuotaAsync(mentor.Id, newMaxQuota));

        Assert.Equal("Quota cannot be lower than the number of assigned groups.", ex.Message);
        Assert.Equal(5, mentor.Quota!.MaxQuota);
        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UpdateQuotaAsync_EqualToCurrentAssigned_IsAllowed()
    {
        var mentor = CreateMentor("Dr. Le Van C", maxQuota: 5, currentAssigned: 3);
        _repository.Setup(r => r.GetByIdForUpdateAsync(mentor.Id, It.IsAny<CancellationToken>())).ReturnsAsync(mentor);
        _repository.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var result = await _service.UpdateQuotaAsync(mentor.Id, 3);

        Assert.Equal(3, result.MaxQuota);
        Assert.Equal(3, result.CurrentAssigned);
        Assert.NotNull(mentor.Quota!.UpdatedAt);
        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateQuotaAsync_UnknownMentor_ThrowsKeyNotFound()
    {
        var id = Guid.NewGuid();
        _repository.Setup(r => r.GetByIdForUpdateAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync((MentorUser?)null);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.UpdateQuotaAsync(id, 4));
    }

    // ------------------------------------------------------------------
    // Search & pagination
    // ------------------------------------------------------------------

    [Theory]
    [InlineData(1, 10, 0)]
    [InlineData(2, 10, 10)]
    [InlineData(3, 5, 10)]
    [InlineData(4, 25, 75)]
    public async Task SearchMentorsAsync_ComputesSkipAndTakeFromPage(int pageIndex, int pageSize, int expectedSkip)
    {
        _repository
            .Setup(r => r.SearchAsync(null, null, null, expectedSkip, pageSize, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Array.Empty<MentorUser>(), 0));

        var result = await _service.SearchMentorsAsync(new MentorSearchQuery { PageIndex = pageIndex, PageSize = pageSize });

        Assert.Equal(pageIndex, result.PageIndex);
        Assert.Equal(pageSize, result.PageSize);
        _repository.VerifyAll();
    }

    [Fact]
    public async Task SearchMentorsAsync_PassesTrimmedFiltersAndMapsPage()
    {
        var mentors = new[]
        {
            CreateMentor("Dr. Le Van C", maxQuota: 5, currentAssigned: 1),
            CreateMentor("ThS. Le Thi D", maxQuota: 4, currentAssigned: 0)
        };
        _repository
            .Setup(r => r.SearchAsync("le", "Software Engineering", "AI", 5, 5, It.IsAny<CancellationToken>()))
            .ReturnsAsync((mentors, 12));

        var result = await _service.SearchMentorsAsync(new MentorSearchQuery
        {
            Search = "  le ",
            Department = " Software Engineering ",
            Expertise = "AI",
            PageIndex = 2,
            PageSize = 5
        });

        Assert.Equal(12, result.TotalCount);
        Assert.Equal(3, result.TotalPages);
        Assert.Equal(new[] { "Dr. Le Van C", "ThS. Le Thi D" }, result.Items.Select(m => m.FullName));
        Assert.Equal(5, result.Items[0].MaxQuota);
        Assert.Equal(1, result.Items[0].CurrentAssigned);
        _repository.VerifyAll();
    }

    [Fact]
    public async Task SearchMentorsAsync_BlankFiltersAndDefaults_AreNormalized()
    {
        _repository
            .Setup(r => r.SearchAsync(null, null, null, 0, MentorSearchQuery.DefaultPageSize, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Array.Empty<MentorUser>(), 0));

        var result = await _service.SearchMentorsAsync(new MentorSearchQuery { Search = "   ", Department = "", Expertise = null });

        Assert.Empty(result.Items);
        Assert.Equal(0, result.TotalPages);
        _repository.VerifyAll();
    }

    [Theory]
    [InlineData(0, 10)]
    [InlineData(1, 0)]
    [InlineData(1, MentorSearchQuery.MaxPageSize + 1)]
    public async Task SearchMentorsAsync_InvalidPaging_ThrowsWithoutQuerying(int pageIndex, int pageSize)
    {
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _service.SearchMentorsAsync(new MentorSearchQuery { PageIndex = pageIndex, PageSize = pageSize }));
        _repository.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task SearchMentorsAsync_PageIndexOverflowingOffset_ThrowsWithoutQuerying()
    {
        // (int.MaxValue - 1) * 100 does not fit in an int OFFSET.
        await Assert.ThrowsAsync<ArgumentException>(() =>
            _service.SearchMentorsAsync(new MentorSearchQuery { PageIndex = int.MaxValue, PageSize = 100 }));
        _repository.VerifyNoOtherCalls();
    }

    // ------------------------------------------------------------------
    // DELETE mentor
    // ------------------------------------------------------------------

    [Fact]
    public async Task DeleteMentorAsync_WithAssignedGroups_ThrowsAndDeletesNothing()
    {
        var mentor = CreateMentor("Dr. Le Van C", maxQuota: 5, currentAssigned: 1);
        var transaction = SetupTransaction();
        _repository.Setup(r => r.GetByIdForUpdateAsync(mentor.Id, It.IsAny<CancellationToken>())).ReturnsAsync(mentor);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => _service.DeleteMentorAsync(mentor.Id));

        Assert.Equal("Cannot delete a mentor who is still assigned to groups.", ex.Message);
        _repository.Verify(r => r.DeleteMentorWorkspaceDataAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _repository.Verify(r => r.RemoveMentor(It.IsAny<MentorUser>()), Times.Never);
        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        transaction.Verify(t => t.CommitAsync(It.IsAny<CancellationToken>()), Times.Never);
        transaction.Verify(t => t.DisposeAsync(), Times.Once);
    }

    [Fact]
    public async Task DeleteMentorAsync_UnknownMentor_ThrowsKeyNotFoundWithoutCommit()
    {
        var id = Guid.NewGuid();
        var transaction = SetupTransaction();
        _repository.Setup(r => r.GetByIdForUpdateAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync((MentorUser?)null);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.DeleteMentorAsync(id));

        transaction.Verify(t => t.CommitAsync(It.IsAny<CancellationToken>()), Times.Never);
        transaction.Verify(t => t.DisposeAsync(), Times.Once);
    }

    [Fact]
    public async Task DeleteMentorAsync_Unassigned_DeletesInsideSerializableTransactionThenCommits()
    {
        var mentor = CreateMentor("Dr. Le Van C", maxQuota: 5, currentAssigned: 0);
        var calls = new List<string>();
        var transaction = SetupTransaction(calls);
        _repository.Setup(r => r.GetByIdForUpdateAsync(mentor.Id, It.IsAny<CancellationToken>()))
            .Callback(() => calls.Add("load")).ReturnsAsync(mentor);
        _repository.Setup(r => r.DeleteMentorWorkspaceDataAsync(mentor.Id, It.IsAny<CancellationToken>()))
            .Callback(() => calls.Add("deleteWorkspace")).Returns(Task.CompletedTask);
        _repository.Setup(r => r.RemoveMentor(mentor)).Callback(() => calls.Add("remove"));
        _repository.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .Callback(() => calls.Add("save")).ReturnsAsync(2);

        await _service.DeleteMentorAsync(mentor.Id);

        Assert.Equal(new[] { "begin", "load", "deleteWorkspace", "remove", "save", "commit", "dispose" }, calls);
        _repository.Verify(r => r.BeginTransactionAsync(System.Data.IsolationLevel.Serializable, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteMentorAsync_SaveFails_DoesNotCommitAndDisposesTransaction()
    {
        var mentor = CreateMentor("Dr. Le Van C", maxQuota: 5, currentAssigned: 0);
        var transaction = SetupTransaction();
        _repository.Setup(r => r.GetByIdForUpdateAsync(mentor.Id, It.IsAny<CancellationToken>())).ReturnsAsync(mentor);
        _repository.Setup(r => r.DeleteMentorWorkspaceDataAsync(mentor.Id, It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _repository.Setup(r => r.RemoveMentor(mentor));
        _repository.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>())).ThrowsAsync(new InvalidOperationException("db down"));

        await Assert.ThrowsAsync<InvalidOperationException>(() => _service.DeleteMentorAsync(mentor.Id));

        transaction.Verify(t => t.CommitAsync(It.IsAny<CancellationToken>()), Times.Never);
        transaction.Verify(t => t.DisposeAsync(), Times.Once);
    }

    // ------------------------------------------------------------------
    // Admin update & Email-rebind self lookup
    // ------------------------------------------------------------------

    [Fact]
    public async Task UpdateMentorAsync_UpdatesProfileAndQuota_AndSaves()
    {
        var mentor = CreateMentor("Dr. Le Van C", maxQuota: 5, currentAssigned: 2);
        _repository.Setup(r => r.GetByIdForUpdateAsync(mentor.Id, It.IsAny<CancellationToken>())).ReturnsAsync(mentor);
        _repository.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var updated = await _service.UpdateMentorAsync(mentor.Id, new AdminUpdateMentorRequest(
            "  TS. Le Van C  ",
            " Software Engineering ",
            " Cloud, Microservices ",
            " 0901234567 ",
            MaxQuota: 6));

        Assert.Equal("TS. Le Van C", updated.FullName);
        Assert.Equal("Software Engineering", updated.Department);
        Assert.Equal("Cloud, Microservices", updated.Expertise);
        Assert.Equal("0901234567", updated.Phone);
        Assert.Equal(6, updated.MaxQuota);
        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateMentorAsync_QuotaBelowAssigned_ThrowsAndDoesNotSave()
    {
        var mentor = CreateMentor("Dr. Le Van C", maxQuota: 5, currentAssigned: 3);
        _repository.Setup(r => r.GetByIdForUpdateAsync(mentor.Id, It.IsAny<CancellationToken>())).ReturnsAsync(mentor);

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => _service.UpdateMentorAsync(mentor.Id, new AdminUpdateMentorRequest(
            "Dr. Le Van C",
            "Software Engineering",
            "AI",
            "",
            MaxQuota: 2)));

        Assert.Equal("Quota cannot be lower than the number of assigned groups.", ex.Message);
        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetMyProfileAsync_WhenUserIdChangedButEmailMatches_RebindsUserIdAndReturnsProfile()
    {
        var mentor = CreateMentor("ThS. Dang Hung", maxQuota: 5, currentAssigned: 0);
        mentor.Email = "danghung25022005@gmail.com";
        var newUserId = Guid.NewGuid();

        _repository.Setup(r => r.GetByUserIdForUpdateAsync(newUserId, It.IsAny<CancellationToken>())).ReturnsAsync((MentorUser?)null);
        _repository.Setup(r => r.GetByEmailForUpdateAsync("danghung25022005@gmail.com", It.IsAny<CancellationToken>())).ReturnsAsync(mentor);
        _repository.Setup(r => r.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        var profile = await _service.GetMyProfileAsync(newUserId, CancellationToken.None, "DangHung25022005@gmail.com");

        Assert.Equal(newUserId, profile.UserId);
        Assert.Equal(newUserId, mentor.UserId);
        Assert.Equal("ThS. Dang Hung", profile.FullName);
        _repository.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    private Mock<IMentorTransaction> SetupTransaction(List<string>? calls = null)
    {
        var transaction = new Mock<IMentorTransaction>();
        transaction.Setup(t => t.CommitAsync(It.IsAny<CancellationToken>()))
            .Callback(() => calls?.Add("commit")).Returns(Task.CompletedTask);
        transaction.Setup(t => t.DisposeAsync())
            .Callback(() => calls?.Add("dispose")).Returns(ValueTask.CompletedTask);
        _repository.Setup(r => r.BeginTransactionAsync(It.IsAny<System.Data.IsolationLevel>(), It.IsAny<CancellationToken>()))
            .Callback(() => calls?.Add("begin")).ReturnsAsync(transaction.Object);
        return transaction;
    }

    private static MentorUser CreateMentor(string fullName, int maxQuota, int currentAssigned)
    {
        var mentor = new MentorUser
        {
            UserId = Guid.NewGuid(),
            FullName = fullName,
            Email = $"{Guid.NewGuid():N}@fpt.edu.vn",
            Department = "Software Engineering",
            Expertise = "AI"
        };
        mentor.Quota = new MentorQuota { MentorId = mentor.Id, Mentor = mentor, MaxQuota = maxQuota, CurrentAssigned = currentAssigned };
        return mentor;
    }
}
