import React from 'react'

function parseDate(str) {
  if (!str) return null
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

function formatVnDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function getDaysDiff(d1, d2) {
  if (!d1 || !d2) return 0
  const diffMs = d2.getTime() - d1.getTime()
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)))
}

export default function SemesterTimelineProgress({
  startDate,
  endDate,
  registrationDeadline,
  topicDeadline,
  mentorDeadline,
  showTodayMarker = false,
  compact = false
}) {
  const start = parseDate(startDate)
  const end = parseDate(endDate)
  const dReg = parseDate(registrationDeadline)
  const dTopic = parseDate(topicDeadline)
  const dMentor = parseDate(mentorDeadline)

  if (!start || !end) {
    return (
      <div style={{
        padding: '12px 14px',
        borderRadius: '10px',
        backgroundColor: '#F8FAFC',
        border: '1px dashed #CBD5E1',
        fontSize: '12.5px',
        color: '#64748B',
        textAlign: 'center'
      }}>
        Chọn <strong>Ngày bắt đầu</strong> và <strong>Ngày kết thúc</strong> để xem thanh tiến độ lộ trình học kỳ.
      </div>
    )
  }

  const totalDays = getDaysDiff(start, end)
  if (totalDays <= 0) {
    return (
      <div style={{
        padding: '10px 14px',
        borderRadius: '8px',
        backgroundColor: '#FEF2F2',
        border: '1px solid #FECACA',
        fontSize: '12.5px',
        color: '#BA1A1A'
      }}>
        ⚠️ Ngày kết thúc phải sau ngày bắt đầu học kỳ!
      </div>
    )
  }

  // Check if all 3 milestones are set
  const hasAllMilestones = dReg && dTopic && dMentor

  // Check chronological validity
  const isValidOrder =
    !hasAllMilestones ||
    (start <= dReg && dReg <= dTopic && dTopic <= dMentor && dMentor <= end)

  if (hasAllMilestones && !isValidOrder) {
    return (
      <div style={{
        padding: '10px 14px',
        borderRadius: '8px',
        backgroundColor: '#FFFBEB',
        border: '1px solid #FDE68A',
        fontSize: '12.5px',
        color: '#92400E'
      }}>
        ⚠️ Thứ tự các mốc deadline chưa hợp lệ. Vui lòng đảm bảo: <strong>Bắt đầu ≤ Ghép nhóm ≤ Nộp đề tài ≤ Khớp Mentor ≤ Kết thúc</strong>.
      </div>
    )
  }

  // Calculate durations
  const daysPhase1 = hasAllMilestones ? getDaysDiff(start, dReg) : Math.round(totalDays * 0.3)
  const daysPhase2 = hasAllMilestones ? getDaysDiff(dReg, dTopic) : Math.round(totalDays * 0.2)
  const daysPhase3 = hasAllMilestones ? getDaysDiff(dTopic, dMentor) : Math.round(totalDays * 0.2)
  const daysPhase4 = hasAllMilestones ? getDaysDiff(dMentor, end) : Math.max(0, totalDays - daysPhase1 - daysPhase2 - daysPhase3)

  const pct1 = Math.max(5, (daysPhase1 / totalDays) * 100)
  const pct2 = Math.max(5, (daysPhase2 / totalDays) * 100)
  const pct3 = Math.max(5, (daysPhase3 / totalDays) * 100)
  const pct4 = Math.max(5, (daysPhase4 / totalDays) * 100)

  // Today progress indicator
  const now = new Date()
  let todayPct = null
  let currentStageText = ''
  let currentStageColor = '#10B981'

  if (showTodayMarker && now >= start && now <= end) {
    todayPct = Math.min(100, Math.max(0, (getDaysDiff(start, now) / totalDays) * 100))
    if (hasAllMilestones) {
      if (now <= dReg) {
        currentStageText = 'Giai đoạn 1: Ghép nhóm tự do'
        currentStageColor = '#10B981'
      } else if (now <= dTopic) {
        currentStageText = 'Giai đoạn 2: Đăng ký đề tài'
        currentStageColor = '#F59E0B'
      } else if (now <= dMentor) {
        currentStageText = 'Giai đoạn 3: Khớp Mentor hướng dẫn'
        currentStageColor = '#3B82F6'
      } else {
        currentStageText = 'Giai đoạn 4: Hoàn thiện & Bảo vệ cuối kỳ'
        currentStageColor = '#8B5CF6'
      }
    }
  }

  return (
    <div style={{
      padding: compact ? '10px 12px' : '14px 16px',
      borderRadius: '12px',
      backgroundColor: '#F8FAFC',
      border: '1px solid #E2E8F0',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#334155' }}>
          <span>Tiến độ & 4 giai đoạn học kỳ</span>
          {currentStageText && (
            <span className="badge" style={{ backgroundColor: `${currentStageColor}18`, color: currentStageColor, fontSize: '11px', fontWeight: 700 }}>
              {currentStageText}
            </span>
          )}
        </div>
        <span style={{ color: '#64748B', fontWeight: 500, fontSize: '12px' }}>
          Tổng thời lượng: <strong>{totalDays} ngày</strong>
        </span>
      </div>

      {/* Multi-segmented Progress Bar */}
      <div style={{ position: 'relative', width: '100%', height: '14px', borderRadius: '7px', overflow: 'hidden', display: 'flex', backgroundColor: '#E2E8F0', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)' }}>
        <div
          style={{ width: `${pct1}%`, backgroundColor: '#10B981', height: '100%', transition: 'width 0.3s ease' }}
          title={`Giai đoạn 1: Ghép nhóm (${daysPhase1} ngày)`}
        />
        <div
          style={{ width: `${pct2}%`, backgroundColor: '#F59E0B', height: '100%', transition: 'width 0.3s ease' }}
          title={`Giai đoạn 2: Đăng ký đề tài (${daysPhase2} ngày)`}
        />
        <div
          style={{ width: `${pct3}%`, backgroundColor: '#3B82F6', height: '100%', transition: 'width 0.3s ease' }}
          title={`Giai đoạn 3: Khớp Mentor (${daysPhase3} ngày)`}
        />
        <div
          style={{ width: `${pct4}%`, backgroundColor: '#8B5CF6', height: '100%', transition: 'width 0.3s ease' }}
          title={`Giai đoạn 4: Bảo vệ cuối kỳ (${daysPhase4} ngày)`}
        />

        {/* Current Day Indicator */}
        {todayPct !== null && (
          <div
            style={{
              position: 'absolute',
              left: `${todayPct}%`,
              top: 0,
              bottom: 0,
              width: '3px',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 0 4px rgba(0,0,0,0.6)',
              zIndex: 2
            }}
            title="Thời điểm hiện tại (Hôm nay)"
          />
        )}
      </div>

      {/* Phase Legends & Duration */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 2 }}>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10B981', flexShrink: 0 }} />
            <strong style={{ color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>1. Ghép nhóm</strong>
          </div>
          <span style={{ color: '#64748B', marginLeft: 12 }}>{hasAllMilestones ? `${daysPhase1} ngày` : '—'}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#F59E0B', flexShrink: 0 }} />
            <strong style={{ color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>2. Nộp đề tài</strong>
          </div>
          <span style={{ color: '#64748B', marginLeft: 12 }}>{hasAllMilestones ? `${daysPhase2} ngày` : '—'}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3B82F6', flexShrink: 0 }} />
            <strong style={{ color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>3. Khớp Mentor</strong>
          </div>
          <span style={{ color: '#64748B', marginLeft: 12 }}>{hasAllMilestones ? `${daysPhase3} ngày` : '—'}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#8B5CF6', flexShrink: 0 }} />
            <strong style={{ color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>4. Bảo vệ</strong>
          </div>
          <span style={{ color: '#64748B', marginLeft: 12 }}>{hasAllMilestones ? `${daysPhase4} ngày` : '—'}</span>
        </div>
      </div>

      {/* Date Milestones Footprint */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '11.5px',
        color: '#64748B',
        borderTop: '1px solid #EDF2F7',
        paddingTop: 6,
        marginTop: 2
      }}>
        <span>Bắt đầu: <strong style={{ color: '#1E293B' }}>{formatVnDate(startDate)}</strong></span>
        <span>Hạn 1: <strong style={{ color: '#10B981' }}>{formatVnDate(registrationDeadline)}</strong></span>
        <span>Hạn 2: <strong style={{ color: '#D97706' }}>{formatVnDate(topicDeadline)}</strong></span>
        <span>Hạn 3: <strong style={{ color: '#2563EB' }}>{formatVnDate(mentorDeadline)}</strong></span>
        <span>Kết thúc: <strong style={{ color: '#1E293B' }}>{formatVnDate(endDate)}</strong></span>
      </div>
    </div>
  )
}

