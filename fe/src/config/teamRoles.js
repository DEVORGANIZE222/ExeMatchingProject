export const TEAM_ROLE_OPTIONS = [
  { code: 'Frontend', label: 'Frontend', desc: 'Giao diện Web (React, HTML/CSS)' },
  { code: 'Backend', label: 'Backend', desc: 'API, Server & Cơ sở dữ liệu' },
  { code: 'Mobile', label: 'Mobile', desc: 'Ứng dụng di động (Android/iOS/Flutter)' },
  { code: 'UIUX', label: 'UI/UX Design', desc: 'Thiết kế giao diện & trải nghiệm' },
  { code: 'BusinessAnalysis', label: 'Business / BA', desc: 'Phân tích nghiệp vụ & Kế hoạch KD' },
  { code: 'Marketing', label: 'Marketing', desc: 'Truyền thông, Growth & Thương mại' },
  { code: 'QualityAssurance', label: 'QA / Tester', desc: 'Kiểm thử & Đảm bảo chất lượng' },
  { code: 'DataAI', label: 'Data / AI', desc: 'Phân tích dữ liệu & Trí tuệ nhân tạo' }
]

export const TEAM_ROLES = TEAM_ROLE_OPTIONS.map((item) => item.code)

export function getTeamRoleLabel(code) {
  return TEAM_ROLE_OPTIONS.find((item) => item.code === code)?.label || code
}

