namespace EXETeamMatching.Contracts.TeamRoles;

/// <summary>
/// Shared business vocabulary for student strengths and team recruitment.
/// It is intentionally separate from Identity/RBAC roles such as Admin/Student.
/// </summary>
public static class TeamRoleCatalog
{
    public static readonly IReadOnlyList<string> All =
        ["Frontend", "Backend", "Mobile", "UIUX", "BusinessAnalysis", "QualityAssurance", "DataAI", "Marketing"];

    public static bool IsValid(string? value) => !string.IsNullOrWhiteSpace(value) &&
        All.Contains(value.Trim(), StringComparer.OrdinalIgnoreCase);

    public static string Normalize(string value) => All.Single(role =>
        role.Equals(value.Trim(), StringComparison.OrdinalIgnoreCase));
}
