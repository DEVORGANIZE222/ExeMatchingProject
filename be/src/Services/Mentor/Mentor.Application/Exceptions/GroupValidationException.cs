namespace EXETeamMatching.Mentor.Application.Exceptions;

public enum GroupValidationFailure
{
    Forbidden,
    NotFound,
    Conflict
}

/// <summary>
/// Raised when the GroupMatching service rejects a mentor-request context lookup.
/// The API layer maps <see cref="Failure"/> to 403/404/409 with an <c>ApiResponse</c> body.
/// </summary>
public class GroupValidationException(GroupValidationFailure failure, string message) : Exception(message)
{
    public GroupValidationFailure Failure { get; } = failure;
}
