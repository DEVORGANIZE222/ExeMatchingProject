using System.Collections.Concurrent;
using EXETeamMatching.Notification.Application.Interfaces;
using EXETeamMatching.Notification.Application.Models;

namespace EXETeamMatching.Notification.Infrastructure.Services;

public class InMemoryNotificationStore : INotificationStore
{
    private readonly ConcurrentQueue<NotificationRecord> _records = new();
    private readonly int _maxRecords;

    public InMemoryNotificationStore(int maxRecords = 1000)
    {
        _maxRecords = maxRecords;
    }

    public void Record(NotificationRecord record)
    {
        _records.Enqueue(record);
        while (_records.Count > _maxRecords && _records.TryDequeue(out _))
        {
        }
    }

    public IReadOnlyList<NotificationRecord> GetRecent(int count = 50)
    {
        return _records.ToArray()
            .OrderByDescending(r => r.ProcessedAt)
            .Take(count)
            .ToList();
    }
}
