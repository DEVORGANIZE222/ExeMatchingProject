/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { API_BASE_URL as apiBase } from '../config/api'

const AuthContext = createContext(null)

// Fallback data when running offline or in demo mode
const mockSemesters = [
  {
    id: 'sem-1',
    code: 'FA26',
    name: 'Fall 2026 - Dự án Khởi nghiệp EXE',
    startDate: '2026-09-01T08:00:00Z',
    endDate: '2026-12-30T17:00:00Z',
    registrationDeadline: '2026-09-20T23:59:59Z',
    topicDeadline: '2026-10-05T23:59:59Z',
    mentorDeadline: '2026-10-20T23:59:59Z',
    isActive: true
  },
  {
    id: 'sem-2',
    code: 'SP27',
    name: 'Spring 2027 - Innovation Cohort',
    startDate: '2027-01-15T08:00:00Z',
    endDate: '2027-05-20T17:00:00Z',
    registrationDeadline: null,
    topicDeadline: null,
    mentorDeadline: null,
    isActive: false
  },
  {
    id: 'sem-3',
    code: 'SU26',
    name: 'Summer 2026 - Khởi nghiệp tăng tốc',
    startDate: '2026-05-02T08:00:00Z',
    endDate: '2026-08-25T17:00:00Z',
    registrationDeadline: '2026-05-15T23:59:59Z',
    topicDeadline: '2026-05-25T23:59:59Z',
    mentorDeadline: '2026-06-05T23:59:59Z',
    isActive: false
  }
]

const mockStudents = [
  { id: 's-1', studentCode: 'SE170248', fullName: 'Nguyễn Trần Quang Duy', email: 'duyntqse170248@fpt.edu.vn', major: 'Kỹ thuật phần mềm' },
  { id: 's-2', studentCode: 'SE170112', fullName: 'Lê Hoàng Nam', email: 'namlhse170112@fpt.edu.vn', major: 'Kỹ thuật phần mềm' },
  { id: 's-3', studentCode: 'AI170045', fullName: 'Trần Bảo Ngọc', email: 'ngoctbai170045@fpt.edu.vn', major: 'Trí tuệ nhân tạo' },
  { id: 's-4', studentCode: 'IB170321', fullName: 'Lê Thảo Vy', email: 'vyltib170321@fpt.edu.vn', major: 'Kinh doanh quốc tế' },
  { id: 's-5', studentCode: 'IA170089', fullName: 'Vũ Đức Trí', email: 'trivdia170089@fpt.edu.vn', major: 'An toàn thông tin' },
  { id: 's-6', studentCode: 'MKT170014', fullName: 'Nguyễn Mai Anh', email: 'anhnmse170014@fpt.edu.vn', major: 'Marketing số' }
]

const mockWhitelist = [
  { id: 'w-1', email: 'admin@fpt.edu.vn' },
  { id: 'w-2', email: 'duyntqse170248@fpt.edu.vn' },
  { id: 'w-3', email: 'namlhse170112@fpt.edu.vn' },
  { id: 'w-4', email: 'ngoctbai170045@fpt.edu.vn' },
  { id: 'w-5', email: 'vyltib170321@fpt.edu.vn' },
  { id: 'w-6', email: 'trivdia170089@fpt.edu.vn' },
  { id: 'w-7', email: 'mentor.thonghv@fpt.edu.vn' }
]

// Initial Mentors List for Admin Management
const initialMentorsList = [
  {
    id: 'm-1',
    fullName: 'TS. Hoàng Văn Thông',
    email: 'thonghv@fpt.edu.vn',
    department: 'Khoa Công nghệ thông tin',
    expertise: 'Trí tuệ nhân tạo, Big Data, Khởi nghiệp DeepTech',
    phone: '0903 888 123',
    maxQuota: 4,
    currentAssigned: 2,
    status: 'available',
    avatar: 'T'
  },
  {
    id: 'm-2',
    fullName: 'ThS. Nguyễn Quỳnh Nga',
    email: 'nganq@fpt.edu.vn',
    department: 'Viện Quản trị Kinh doanh',
    expertise: 'FinTech, Mô hình kinh doanh, Gọi vốn hạt giống (Seed Fund)',
    phone: '0912 345 678',
    maxQuota: 4,
    currentAssigned: 4,
    status: 'full',
    avatar: 'N'
  },
  {
    id: 'm-3',
    fullName: 'TS. Lê Anh Tuấn',
    email: 'tuanla@fpt.edu.vn',
    department: 'Khoa Hệ thống thông tin',
    expertise: 'Logistics Tech, Chuỗi cung ứng thông minh, SaaS B2B Enterprise',
    phone: '0988 777 666',
    maxQuota: 5,
    currentAssigned: 3,
    status: 'available',
    avatar: 'L'
  },
  {
    id: 'm-4',
    fullName: 'ThS. Trần Thị Mai Linh',
    email: 'linhttm@fpt.edu.vn',
    department: 'Khoa Digital Marketing & Truyền thông',
    expertise: 'Growth Hacking, EdTech, Product-Market Fit, E-Commerce',
    phone: '0933 222 111',
    maxQuota: 3,
    currentAssigned: 1,
    status: 'available',
    avatar: 'M'
  },
  {
    id: 'm-5',
    fullName: 'TS. Phạm Minh Khôi',
    email: 'khoipm@fpt.edu.vn',
    department: 'Khoa An toàn thông tin',
    expertise: 'Blockchain, Web3, Cybersecurity, IoT Security',
    phone: '0977 444 555',
    maxQuota: 4,
    currentAssigned: 2,
    status: 'available',
    avatar: 'K'
  }
]

// Initial Incoming Requests for TS. Hoàng Văn Thông
const initialMentorRequests = [
  {
    id: 'req-1',
    groupId: 'grp-3',
    groupName: 'MediSync AI Health',
    topic: 'Hệ thống gợi ý chẩn đoán sơ bộ qua hình ảnh y tế và hỗ trợ đặt lịch khám phòng khám tư',
    industry: 'AI & Healthcare / MedTech',
    leader: 'Bùi Gia Huy (SE170199 - Kỹ thuật phần mềm)',
    leaderEmail: 'huybgse170199@fpt.edu.vn',
    leaderPhone: '0912 345 678',
    members: [
      { name: 'Bùi Gia Huy', role: 'Leader / Data Scientist', major: 'AI' },
      { name: 'Trần Văn Mạnh', role: 'Backend Spring Boot', major: 'SE' },
      { name: 'Nguyễn Thu Trang', role: 'Business Analyst', major: 'IB' },
      { name: 'Phạm Hải Đăng', role: 'Mobile Flutter Dev', major: 'SE' }
    ],
    problemStatement: 'Các phòng khám đa khoa vừa và nhỏ tại Việt Nam thiếu công cụ phân loại bệnh nhân và hỗ trợ đọc ảnh X-Quang nhanh, dẫn đến thời gian chờ khám trung bình 45 phút/người.',
    solutionOverview: 'Mô hình AI nhận diện bất thường hình ảnh phổi/xương độ chính xác 91%, tích hợp ứng dụng đặt lịch và sổ khám điện tử theo mô hình SaaS B2B.',
    targetMarket: '3.000+ phòng khám tư nhân và trung tâm xét nghiệm tại TP.HCM & Hà Nội.',
    revenueModel: 'Thu phí thuê bao SaaS hàng tháng (500k - 2tr VNĐ/tháng/phòng khám) và phí bản quyền API tích hợp.',
    message: 'Kính gửi Thầy Hoàng Văn Thông! Nhóm MediSync chúng em theo dõi các công trình nghiên cứu và dự án AI y tế của Thầy. Dự án này chúng em đã hoàn thành MVP thử nghiệm sơ bộ và rất kính mong Thầy đồng ý làm Giảng viên Mentor hướng dẫn nhóm để hoàn thiện thuật toán và phương án bảo vệ học kỳ Khởi nghiệp.',
    pitchDeckName: 'MediSync_PitchDeck_FA26.pdf',
    createdAt: '2026-09-18T10:30:00Z',
    status: 'Pending', // 'Pending' | 'Approved' | 'Rejected'
    decisionReason: null,
    decidedAt: null
  },
  {
    id: 'req-2',
    groupId: 'grp-4',
    groupName: 'AgriSense IoT',
    topic: 'Hệ thống cảm biến IoT giám sát vi khí hậu nông trại và cảnh báo sâu bệnh tự động',
    industry: 'AgriTech & Smart Farming',
    leader: 'Đỗ Quốc Bảo (IA160890 - IoT)',
    leaderEmail: 'baodqse160890@fpt.edu.vn',
    leaderPhone: '0988 765 432',
    members: [
      { name: 'Đỗ Quốc Bảo', role: 'Leader / Embedded Systems', major: 'IA' },
      { name: 'Lê Hoàng Minh', role: 'Cloud & Dashboard', major: 'SE' },
      { name: 'Vũ Thùy Linh', role: 'Tài chính & Tiếp thị', major: 'MKT' },
      { name: 'Trần Minh Quân', role: 'Phát triển phần cứng', major: 'SE' }
    ],
    problemStatement: 'Nhà vườn trồng dưa lưới và hoa màu cao cấp thiệt hại 15-25% sản lượng hàng năm do phát hiện sâu bệnh và nấm mốc trễ.',
    solutionOverview: 'Bộ node cảm biến năng lượng mặt trời thu thập độ ẩm đất, nhiệt độ, nồng độ CO2 truyền dữ liệu qua giao thức LoRa, kết hợp camera AI phát hiện đốm lá.',
    targetMarket: 'Các hợp tác xã nông nghiệp công nghệ cao tại Lâm Đồng và miền Tây.',
    revenueModel: 'Bán bộ kit phần cứng ban đầu + gói phần mềm phân tích chuyên sâu 300k/tháng/nông trại.',
    message: 'Em chào Thầy Thông ạ, nhóm AgriSense xin phép gửi đề cương dự án IoT nông nghiệp. Chúng em cần sự cố vấn của Thầy về kiến trúc hệ thống dữ liệu lớn và quy trình triển khai thử nghiệm thực địa.',
    pitchDeckName: 'AgriSense_ExecutiveSummary.pdf',
    createdAt: '2026-09-19T14:15:00Z',
    status: 'Pending',
    decisionReason: null,
    decidedAt: null
  },
  {
    id: 'req-3',
    groupId: 'grp-5',
    groupName: 'EduVR Studio',
    topic: 'Nền tảng mô phỏng phòng thí nghiệm vật lý - hóa học 3D cho trường học phổ thông',
    industry: 'EdTech & VR/AR',
    leader: 'Hoàng Kim Yến (GD170022 - Thiết kế mỹ thuật số)',
    leaderEmail: 'yenhkgd170022@fpt.edu.vn',
    leaderPhone: '0903 112 233',
    members: [
      { name: 'Hoàng Kim Yến', role: 'Leader / 3D Art & UI', major: 'GD' },
      { name: 'Nguyễn Tiến Đạt', role: 'Unity / WebGL Dev', major: 'SE' },
      { name: 'Trần Phương Thảo', role: 'Nội dung sư phạm', major: 'IB' }
    ],
    problemStatement: 'Hơn 70% trường THCS/THPT vùng ven thiếu kinh phí xây dựng phòng thí nghiệm đạt chuẩn an toàn cho học sinh thực hành.',
    solutionOverview: 'Phòng thí nghiệm ảo 3D chạy trực tiếp trên trình duyệt WebXR, học sinh có thể pha chế hóa chất an toàn và làm bài tập tương tác.',
    targetMarket: 'Hệ thống trường liên cấp và trung tâm giáo dục STEM tư thục.',
    revenueModel: 'Bán gói bản quyền trường học theo năm (B2B License) và gói cá nhân cho học sinh.',
    message: 'Kính gửi Thầy Thông, nhóm EduVR mong muốn được Thầy nhận lời làm Mentor để tư vấn mô hình tối ưu đồ họa WebGL trên nền tảng web phục vụ số lượng lớn học sinh.',
    pitchDeckName: 'EduVR_Pitch_Deck.pdf',
    createdAt: '2026-09-20T08:00:00Z',
    status: 'Pending',
    decisionReason: null,
    decidedAt: null
  }
]

// Initial Active Mentored Groups for TS. Hoàng Văn Thông
const initialAssignedGroups = [
  {
    id: 'grp-1',
    name: 'ExeMatching DevCore',
    topic: 'Nền tảng ghép nhóm sinh viên Khởi nghiệp EXE thông minh tích hợp đề xuất thuật toán',
    industry: 'EdTech & HRTech',
    leader: 'Nguyễn Trần Quang Duy',
    leaderEmail: 'duyntqse170248@fpt.edu.vn',
    leaderPhone: '0971 123 456',
    membersCount: 4,
    members: [
      { name: 'Nguyễn Trần Quang Duy', role: 'Leader / Backend', major: 'SE' },
      { name: 'Phan Minh Tuấn', role: 'Frontend React', major: 'SE' },
      { name: 'Trần Bảo Ngọc', role: 'Machine Learning', major: 'AI' },
      { name: 'Lê Hoàng Nam', role: 'DevOps & Cloud', major: 'SE' }
    ],
    milestone: 'Giai đoạn 2: Phát triển MVP',
    milestoneProgress: 65,
    nextMeeting: '14:30 - Thứ Năm, 24/09/2026 (Phòng Co-working FPT)',
    status: 'OnTrack'
  },
  {
    id: 'grp-2',
    name: 'RecycleChain',
    topic: 'Giải pháp thu gom rác thải điện tử tích điểm đổi voucher qua mạng lưới trạm thông minh',
    industry: 'GreenTech & Circular Economy',
    leader: 'Võ Thành Đạt',
    leaderEmail: 'datvtse170881@fpt.edu.vn',
    leaderPhone: '0945 987 654',
    membersCount: 5,
    members: [
      { name: 'Võ Thành Đạt', role: 'Leader / Product', major: 'IB' },
      { name: 'Nguyễn Văn Hùng', role: 'Backend Golang', major: 'SE' },
      { name: 'Trần Khánh Ly', role: 'Marketing', major: 'MKT' },
      { name: 'Lý Quốc Cường', role: 'Mobile iOS', major: 'SE' },
      { name: 'Đặng Mai Phương', role: 'Business Analyst', major: 'IB' }
    ],
    milestone: 'Giai đoạn 1: Khảo sát thị trường & Đối tác điểm thu',
    milestoneProgress: 90,
    nextMeeting: '09:00 - Thứ Bảy, 26/09/2026 (Google Meet)',
    status: 'Good'
  }
]

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('exe_access_token') || '')
  const [account, setAccount] = useState(() => {
    const saved = localStorage.getItem('exe_account')
    return saved ? JSON.parse(saved) : null
  })
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('exe_access_token')) && !account)
  const [loginError, setLoginError] = useState('')

  // Mentor & Quota State (Persisted in localStorage for Demo fluidity)
  const [mentorsList, setMentorsList] = useState(() => {
    const saved = localStorage.getItem('exe_mentors_list')
    return saved ? JSON.parse(saved) : initialMentorsList
  })

  const [mentorRequests, setMentorRequests] = useState(() => {
    const saved = localStorage.getItem('exe_mentor_requests')
    return saved ? JSON.parse(saved) : initialMentorRequests
  })

  const [assignedGroups, setAssignedGroups] = useState(() => {
    const saved = localStorage.getItem('exe_assigned_groups')
    return saved ? JSON.parse(saved) : initialAssignedGroups
  })

  // Mentor Profile for Current User if Mentor
  const mentorProfile = mentorsList.find((m) => m.id === 'm-1') || initialMentorsList[0]

  // Persist state updates to localStorage
  useEffect(() => {
    localStorage.setItem('exe_mentors_list', JSON.stringify(mentorsList))
  }, [mentorsList])

  useEffect(() => {
    localStorage.setItem('exe_mentor_requests', JSON.stringify(mentorRequests))
  }, [mentorRequests])

  useEffect(() => {
    localStorage.setItem('exe_assigned_groups', JSON.stringify(assignedGroups))
  }, [assignedGroups])

  const loadAccount = useCallback(async (accessToken, student = null) => {
    if (accessToken.startsWith('demo-')) {
      const saved = localStorage.getItem('exe_account')
      const acc = saved ? JSON.parse(saved) : { username: 'Admin FPT', role: 'Admin' }
      setAccount(acc)
      return acc
    }

    const response = await fetch(`${apiBase}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.message || 'Phiên đăng nhập không hợp lệ.')
    const next = { ...body.data, student }
    setAccount(next)
    localStorage.setItem('exe_account', JSON.stringify(next))
    return next
  }, [])

  useEffect(() => {
    if (!token || account) return
    const timer = setTimeout(() => {
      loadAccount(token)
        .catch(() => {
          localStorage.removeItem('exe_access_token')
          localStorage.removeItem('exe_account')
          setToken('')
        })
        .finally(() => setLoading(false))
    }, 0)
    return () => clearTimeout(timer)
  }, [account, loadAccount, token])

  const googleLogin = async ({ credential }) => {
    try {
      const response = await fetch(`${apiBase}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.message || 'Đăng nhập Google không thành công.')
      localStorage.setItem('exe_access_token', body.data.token)
      await loadAccount(body.data.token, body.data.student)
      setLoginError('')
      setToken(body.data.token)
      return true
    } catch (error) {
      setLoginError(error.message || 'Không thể kết nối đến hệ thống.')
      return false
    }
  }

  const loginAsDemo = (role = 'Admin') => {
    const demoToken = 'demo-token-' + Date.now()
    let demoAccount = {
      username: 'Admin FPT',
      role: 'Admin',
      email: 'admin@fpt.edu.vn'
    }

    if (role === 'Mentor') {
      demoAccount = {
        username: 'TS. Hoàng Văn Thông',
        role: 'Mentor',
        email: 'thonghv@fpt.edu.vn',
        department: 'Khoa Công nghệ thông tin',
        expertise: 'Trí tuệ nhân tạo, Big Data, Khởi nghiệp DeepTech',
        mentorId: 'm-1'
      }
    } else if (role === 'Student') {
      demoAccount = {
        username: 'Duy Quang (SE170248)',
        role: 'Student',
        email: 'duyntqse170248@fpt.edu.vn',
        student: {
          studentCode: 'SE170248',
          semesterCode: 'FA26'
        }
      }
    }

    localStorage.setItem('exe_access_token', demoToken)
    localStorage.setItem('exe_account', JSON.stringify(demoAccount))
    setToken(demoToken)
    setAccount(demoAccount)
    setLoginError('')
    setLoading(false)
  }

  const logout = () => {
    localStorage.removeItem('exe_access_token')
    localStorage.removeItem('exe_account')
    setAccount(null)
    setToken('')
    setLoginError('')
  }

  // Mentor Business Actions
  const acceptMentorRequest = (requestId, welcomeNote = '') => {
    const request = mentorRequests.find((r) => r.id === requestId)
    if (!request) throw new Error('Không tìm thấy yêu cầu hướng dẫn.')

    if (mentorProfile.currentAssigned >= mentorProfile.maxQuota) {
      throw new Error(`Bạn đã đạt hạn ngạch tối đa (${mentorProfile.maxQuota}/${mentorProfile.maxQuota} nhóm). Không thể nhận thêm!`)
    }

    const now = new Date().toISOString()

    // 1. Update Request
    setMentorRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'Approved',
              decisionReason: welcomeNote || 'Giảng viên đã chấp thuận đề tài và đồng hành cùng nhóm.',
              decidedAt: now
            }
          : r
      )
    )

    // 2. Increase Current Assigned in Mentors List
    setMentorsList((prev) =>
      prev.map((m) => {
        if (m.id === 'm-1') {
          const nextCount = m.currentAssigned + 1
          return {
            ...m,
            currentAssigned: nextCount,
            status: nextCount >= m.maxQuota ? 'full' : 'available'
          }
        }
        return m
      })
    )

    // 3. Add to Assigned Groups
    const newAssignedGroup = {
      id: request.groupId || 'grp-' + Date.now(),
      name: request.groupName,
      topic: request.topic,
      industry: request.industry,
      leader: request.leader,
      leaderEmail: request.leaderEmail,
      leaderPhone: request.leaderPhone,
      membersCount: request.members?.length || 4,
      members: request.members || [],
      milestone: 'Giai đoạn 1: Khởi động đề tài & Thống nhất kế hoạch',
      milestoneProgress: 20,
      nextMeeting: 'Chờ thống nhất buổi cố vấn đầu tiên',
      status: 'OnTrack'
    }

    setAssignedGroups((prev) => [newAssignedGroup, ...prev])
    return newAssignedGroup
  }

  const rejectMentorRequest = (requestId, reason = '') => {
    const request = mentorRequests.find((r) => r.id === requestId)
    if (!request) throw new Error('Không tìm thấy yêu cầu hướng dẫn.')

    const now = new Date().toISOString()
    setMentorRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'Rejected',
              decisionReason: reason || 'Đề tài chưa hoàn toàn phù hợp với định hướng chuyên môn của giảng viên.',
              decidedAt: now
            }
          : r
      )
    )
  }

  // Admin Quota Management Actions
  const updateMentorQuota = (mentorId, newMaxQuota) => {
    const parsedQuota = parseInt(newMaxQuota, 10)
    if (isNaN(parsedQuota) || parsedQuota < 1) {
      throw new Error('Hạn ngạch phải là số nguyên dương (tối thiểu 1 nhóm).')
    }

    setMentorsList((prev) =>
      prev.map((m) => {
        if (m.id === mentorId) {
          return {
            ...m,
            maxQuota: parsedQuota,
            status: m.currentAssigned >= parsedQuota ? 'full' : 'available'
          }
        }
        return m
      })
    )
  }

  const addMentor = (mentorData) => {
    const newMentor = {
      id: 'm-' + Date.now(),
      fullName: mentorData.fullName.trim(),
      email: mentorData.email.trim(),
      department: mentorData.department.trim(),
      expertise: mentorData.expertise.trim(),
      phone: mentorData.phone?.trim() || 'Chưa cập nhật',
      maxQuota: parseInt(mentorData.maxQuota, 10) || 4,
      currentAssigned: 0,
      status: 'available',
      avatar: mentorData.fullName.trim().charAt(0).toUpperCase()
    }
    setMentorsList((prev) => [newMentor, ...prev])
    return newMentor
  }

  const request = useCallback(async (path, options = {}) => {
    try {
      if (token.startsWith('demo-')) {
        // Return rich demo mock data
        if (path.includes('/api/semesters')) {
          if (options.method === 'POST') {
            const body = JSON.parse(options.body)
            const newSem = { id: 'sem-' + Date.now(), ...body, isActive: true }
            mockSemesters.unshift(newSem)
            return newSem
          }
          if (options.method === 'DELETE') {
            const id = path.split('/').pop()
            const idx = mockSemesters.findIndex((s) => s.id === id)
            if (idx !== -1) mockSemesters.splice(idx, 1)
            return true
          }
          return { items: [...mockSemesters], totalCount: mockSemesters.length }
        }
        if (path.includes('/api/students')) {
          if (options.method === 'POST') {
            return { importedCount: 45, existingCount: 5 }
          }
          return { items: [...mockStudents], totalCount: 200 }
        }
        if (path.includes('/api/google-access')) {
          if (options.method === 'DELETE') {
            const id = path.split('/').pop()
            const idx = mockWhitelist.findIndex((w) => w.id === id)
            if (idx !== -1) mockWhitelist.splice(idx, 1)
            return true
          }
          return [...mockWhitelist]
        }
        if (path.includes('/api/mentors')) {
          return mentorsList
        }
      }

      const response = await fetch(`${apiBase}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.headers || {})
        }
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || 'Không thể kết nối dữ liệu.')
      return body.data
    } catch (err) {
      // Graceful fallback if backend server isn't reached
      if (path.includes('/api/semesters')) return { items: [...mockSemesters], totalCount: mockSemesters.length }
      if (path.includes('/api/students')) return { items: [...mockStudents], totalCount: 200 }
      if (path.includes('/api/google-access')) return [...mockWhitelist]
      if (path.includes('/api/mentors')) return mentorsList
      throw err
    }
  }, [mentorsList, token])

  const isAdmin = account?.role === 'Admin'
  const isMentor = account?.role === 'Mentor'
  const isStudent = account?.role === 'Student'

  return (
    <AuthContext.Provider value={{
      token, account, loading, loginError,
      setLoginError, googleLogin, loginAsDemo, logout,
      request, loadAccount,
      isAdmin, isMentor, isStudent,
      // Mentor & Quota exports
      mentorProfile,
      mentorRequests,
      assignedGroups,
      mentorsList,
      acceptMentorRequest,
      rejectMentorRequest,
      updateMentorQuota,
      addMentor
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
