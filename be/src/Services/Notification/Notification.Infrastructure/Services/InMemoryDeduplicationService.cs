using System.Collections.Concurrent;
using EXETeamMatching.Notification.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace EXETeamMatching.Notification.Infrastructure.Services;

public class InMemoryDeduplicationService : IDeduplicationService
{
    private readonly ConcurrentDictionary<string, DateTime> _seenKeys = new();
    private readonly TimeSpan _retention;
    private readonly ILogger<InMemoryDeduplicationService> _logger;
    private DateTime _lastCleanup = DateTime.UtcNow;

    public InMemoryDeduplicationService(ILogger<InMemoryDeduplicationService> logger, TimeSpan? retention = null)
    {
        _logger = logger;
        _retention = retention ?? TimeSpan.FromHours(24);
    }

    public bool TryAcquire(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return true;

        CleanupIfNecessary();

        var now = DateTime.UtcNow;
        if (_seenKeys.TryGetValue(key, out var seenTime))
        {
            if (now - seenTime < _retention)
            {
                _logger.LogWarning("Duplicate event detected with key {Key}. Skipping processing.", key);
                return false;
            }
        }

        _seenKeys[key] = now;
        return true;
    }

    public bool IsProcessed(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return false;
        if (_seenKeys.TryGetValue(key, out var seenTime))
        {
            return (DateTime.UtcNow - seenTime) < _retention;
        }
        return false;
    }

    private void CleanupIfNecessary()
    {
        var now = DateTime.UtcNow;
        if (now - _lastCleanup < TimeSpan.FromMinutes(10)) return;

        _lastCleanup = now;
        var threshold = now - _retention;
        foreach (var kvp in _seenKeys)
        {
            if (kvp.Value < threshold)
            {
                _seenKeys.TryRemove(kvp.Key, out _);
            }
        }
    }
}
