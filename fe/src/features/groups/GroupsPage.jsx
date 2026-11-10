import { useCallback, useEffect, useState } from 'react'
import {
  GraduationCap, Layers, Users, Plus, Search,
  CheckCircle2, X, Crown,
  LogOut, Lock, Shuffle,
  Trash2, Edit3, UserMinus, UserPlus, Sparkles, Calendar, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import '../../components/ServicePages.css'
import { useAuth } from '../../hooks/useAuth'
import { TEAM_ROLES, getTeamRoleLabel } from '../../config/teamRoles'
import StudentCoreModal from '../../components/StudentCoreModal'

const normalizeSearchText = (value) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase()
  .replace(/đ/g, 'd')

export default function GroupsPage() {
  const { account, request, isAdmin, isMentor, isStudent } = useAuth()
  const [groups, setGroups] = useState([])
  const [semesters, setSemesters] = useState([])
  const [semesterCode, setSemesterCode] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'recruiting' | 'full'
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [enrollmentError, setEnrollmentError] = useState(null)
  const [demoSeedEnabled, setDemoSeedEnabled] = useState(false)
  const [seedingDemoMembers, setSeedingDemoMembers] = useState(false)

  // Modals state
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCoreModal, setShowCoreModal] = useState(false)
  const [showRandomConfirm, setShowRandomConfirm] = useState(false)
  const [inviteIdentifier, setInviteIdentifier] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteCandidates, setInviteCandidates] = useState([])
  const [searchingCandidates, setSearchingCandidates] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupTopic, setNewGroupTopic] = useState('')
  const [newRecruitmentNeeds, setNewRecruitmentNeeds] = useState([])
  const [mentors, setMentors] = useState([])
  const [mentorRequestGroup, setMentorRequestGroup] = useState(null)
  const [mentorRequestId, setMentorRequestId] = useState('')
  const [mentorSearch, setMentorSearch] = useState('')
  const [mentorRequestMessage, setMentorRequestMessage] = useState('')
  const [loadingMentors, setLoadingMentors] = useState(false)
  const [sendingMentorRequest, setSendingMentorRequest] = useState(false)
  const [mentorStatus, setMentorStatus] = useState(null)
  const [loadingMentorStatus, setLoadingMentorStatus] = useState(false)
  const [mentorStatusError, setMentorStatusError] = useState('')

  // Edit Topic / Name Modal
  const [editGroupModal, setEditGroupModal] = useState(false)
  const [editGroupName, setEditGroupName] = useState('')
  const [editGroupTopic, setEditGroupTopic] = useState('')
  const [editGroupDescription, setEditGroupDescription] = useState('')

  // Student's fixed semester from Admin roster
  const studentSemesterCode = account?.student?.semesterCode
  const targetSemesterCode = isStudent ? studentSemesterCode : semesterCode
  const filteredMentors = mentors.filter((mentor) => {
    const query = normalizeSearchText(mentorSearch.trim())
    return [mentor.fullName, mentor.department, mentor.expertise, mentor.email]
      .some((value) => normalizeSearchText(value || '').includes(query))
  })

  const mapGroup = useCallback((group) => {
    const leader = group.members?.find((member) => member.role === 1 || member.role === 'Leader')
    const memberCount = group.memberCount ?? group.members?.length ?? 0
    const isLocked = group.status === 2 || group.status === 'Locked'

    return {
      ...group,
      name: group.groupName,
      topic: group.topicTitle || 'Chưa đăng ký đề tài',
      projectDescription: group.projectDescription || 'Chưa có mô tả dự án.',
      recruitmentNeeds: group.recruitmentNeeds || [],
      leader: leader?.fullName || 'Chưa bầu trưởng nhóm',
      isLocked,
      members: (group.members || []).map((member) => ({
        ...member,
        name: member.fullName,
        isDemo: Boolean(member.isDemo),
        isLeader: member.role === 1 || member.role === 'Leader',
        role: member.role === 1 || member.role === 'Leader' ? 'Trưởng nhóm' : 'Thành viên',
        major: member.major || ''
      })),
      maxMembers: 5,
      statusText: isLocked
        ? 'Đã khóa nhóm'
        : memberCount >= 5 ? 'Đã đủ 5 thành viên' : `Cần thêm ${5 - memberCount} thành viên`,
      statusType: memberCount >= 5 || isLocked ? 'full' : 'recruiting',
      canRequestMentor: (group.status === 2 || group.status === 'Locked') && Boolean(group.topicTitle),
      isCurrentLeader: Boolean(account?.student?.id && group.leaderStudentId === account.student.id),
      mentor: 'Chưa kết nối Mentor'
    }
  }, [account])

  // 1. Load Semesters & Initialize target semesterCode
  useEffect(() => {
    const fetchSemesters = async () => {
      try {
        const semData = await request('/api/semesters?page=1&pageSize=50&sortBy=startDate&descending=true')
        const items = semData.items || []
        setSemesters(items)

        if (isAdmin || isMentor) {
          if (items.length > 0 && !semesterCode) {
            const active = items.find((s) => s.isActive) || items[0]
            setSemesterCode(active.code)
          }
        } else {
          // Student MUST use their own assigned semester only
          setSemesterCode(studentSemesterCode || '')
        }
      } catch {
        // Fallback silently
      }
    }
    fetchSemesters()
  }, [account, isAdmin, isMentor, request, semesterCode, studentSemesterCode])

  // 2. Load Groups by Semester
  const loadGroups = useCallback(async () => {
    const targetCode = isStudent ? studentSemesterCode : semesterCode
    if (!targetCode) {
      setGroups([])
      return
    }

    setBusy(true)
    setEnrollmentError(null)
    try {
      const result = await request(`/api/groups?semesterCode=${encodeURIComponent(targetCode)}&page=1&pageSize=100`)
      const mapped = (result.items || []).map(mapGroup)
      setGroups(mapped)

      // Refresh currently selected group modal if open
      setSelectedGroup((current) => current
        ? mapped.find((group) => group.id === current.id) || current
        : null)
    } catch (error) {
      if (error.message?.includes('No enrollment') || error.status === 409 || error.status === 404) {
        setEnrollmentError('Tài khoản của bạn chưa có danh sách đăng ký học phần (Enrollment) trong học kỳ này.')
        setGroups([])
      } else {
        toast.error(error.message || 'Không thể tải danh sách nhóm.')
      }
    } finally {
      setBusy(false)
    }
  }, [isStudent, mapGroup, request, semesterCode, studentSemesterCode])

  useEffect(() => {
    if (!isAdmin && !isStudent) return

    request('/api/groups/demo-seed-status')
      .then(setDemoSeedEnabled)
      .catch((error) => toast.error(error.message || 'Không thể kiểm tra chế độ demo.'))
  }, [isAdmin, isStudent, request])

  useEffect(() => {
    const q = inviteIdentifier.trim()
    if (!selectedGroup || selectedGroup.isLocked || selectedGroup.members.length >= 5 || q.length < 2) {
      return
    }
    let active = true
    const timer = setTimeout(() => {
      setSearchingCandidates(true)
      request(`/api/groups/${selectedGroup.id}/invite-candidates?q=${encodeURIComponent(q)}`)
        .then((list) => {
          if (active) setInviteCandidates(Array.isArray(list) ? list : [])
        })
        .catch(() => {
          if (active) setInviteCandidates([])
        })
        .finally(() => {
          if (active) setSearchingCandidates(false)
        })
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [inviteIdentifier, request, selectedGroup])

  const handleSeedDemoMembers = async (group) => {
    const emptySlots = 5 - group.members.length
    if (emptySlots <= 0) {
      toast.error('Nhóm đã đủ 5 thành viên.')
      return
    }
    if (!window.confirm(`Thêm ${emptySlots} thành viên demo vào nhóm "${group.name}"? Khi bỏ phiếu, các thành viên demo sẽ vote theo ứng viên bạn chọn.`)) return

    setSeedingDemoMembers(true)
    try {
      const updatedGroup = await request(`/api/groups/${group.id}/demo-members`, { method: 'POST' })
      setSelectedGroup(mapGroup(updatedGroup))
      toast.success(`Đã thêm ${emptySlots} thành viên demo.`)
      await loadGroups()
    } catch (error) {
      toast.error(error.message || 'Không thể seed thành viên demo.')
    } finally {
      setSeedingDemoMembers(false)
    }
  }

  const openMentorRequest = async (group) => {
    setLoadingMentors(true)
    try {
      const availableMentors = await request(`/api/groups/${group.id}/mentor-recommendations`)
      setMentors(availableMentors)
      setMentorRequestGroup(group)
      setMentorRequestId(availableMentors[0]?.id || '')
      setMentorSearch('')
      setMentorRequestMessage('')
      setSelectedGroup(null)
    } catch (error) {
      toast.error(error.message || 'Không thể tải danh sách mentor.')
    } finally {
      setLoadingMentors(false)
    }
  }

  const openGroupDetails = async (group) => {
    setSelectedGroup(group)
    setInviteIdentifier('')
    setInviteCandidates([])
    setMentorStatus(null)
    setMentorStatusError('')
    if (!isStudent || !group.isCurrentLeader || !group.canRequestMentor) return

    setLoadingMentorStatus(true)
    try {
      const status = await request(`/api/mentor-requests/groups/${group.id}/status`)
      setMentorStatus({ groupId: group.id, data: status })
    } catch (error) {
      setMentorStatusError(error.message || 'Không thể kiểm tra trạng thái mentor của nhóm.')
    } finally {
      setLoadingMentorStatus(false)
    }
  }

  const handleRequestMentor = async (event) => {
    event.preventDefault()
    if (!mentorRequestGroup || !mentorRequestId) return
    setSendingMentorRequest(true)
    try {
      await request('/api/mentor-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: mentorRequestGroup.id,
          mentorId: mentorRequestId,
          groupName: mentorRequestGroup.name,
          topic: mentorRequestGroup.topic,
          message: mentorRequestMessage.trim()
        })
      })
      toast.success('Đã gửi yêu cầu hướng dẫn tới mentor.')
      setMentorRequestGroup(null)
      setMentorRequestMessage('')
      setMentorRequestId('')
    } catch (error) {
      toast.error(error.message || 'Không thể gửi yêu cầu mentor.')
    } finally {
      setSendingMentorRequest(false)
    }
  }

  // Load groups for the selected semester.
  useEffect(() => {
    if (isStudent ? studentSemesterCode : semesterCode) {
      loadGroups()
    }
  }, [isStudent, semesterCode, studentSemesterCode, loadGroups])

  // 1. Create Group
  const handleCreateGroup = async (e) => {
    e.preventDefault()
    if (!targetSemesterCode) {
      toast.error(isStudent
        ? 'Tài khoản chưa được xếp vào học kỳ. Vui lòng liên hệ Admin để được thêm vào danh sách sinh viên.'
        : 'Chưa có học kỳ áp dụng. Vui lòng tạo hoặc mở một học kỳ trước.')
      return
    }
    if (!newGroupName.trim()) {
      toast.error('Vui lòng nhập tên nhóm.')
      return
    }
    try {
      setBusy(true)
      await request('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: newGroupName.trim(),
          semesterCode: targetSemesterCode,
          projectDescription: newGroupTopic.trim() || newGroupName.trim(),
          recruitmentNeeds: newRecruitmentNeeds.map((roleCode) => ({ roleCode, slots: 1 }))
        })
      })

      toast.success(`Đã khởi tạo nhóm "${newGroupName}".`)
      setShowCreateModal(false)
      setNewGroupName('')
      setNewGroupTopic('')
      setNewRecruitmentNeeds([])
      await loadGroups()
    } catch (error) {
      toast.error(error.message || 'Không thể tạo nhóm.')
    } finally {
      setBusy(false)
    }
  }

  // 2. Join Group
  const handleJoin = async (group) => {
    try {
      setBusy(true)
      await request(`/api/groups/${group.id}/members`, { method: 'POST' })
      toast.success(`Đã tham gia nhóm "${group.name}".`)
      setSelectedGroup(null)
      await loadGroups()
    } catch (error) {
      toast.error(error.message || 'Không thể tham gia nhóm.')
    } finally {
      setBusy(false)
    }
  }

  // 3. Leave Group (Self)
  const handleLeaveGroup = async (group) => {
    if (!window.confirm(`Bạn có chắc chắn muốn rời nhóm "${group.name}"?`)) return
    try {
      setBusy(true)
      await request(`/api/groups/${group.id}/members/me`, { method: 'DELETE' })
      toast.success('Đã rời khỏi nhóm thành công.')
      setSelectedGroup(null)
      await loadGroups()
    } catch (error) {
      toast.error(error.message || 'Không thể rời nhóm.')
    } finally {
      setBusy(false)
    }
  }

  // 4. Vote Leader
  const handleVoteLeader = async (groupId, studentId, studentName) => {
    try {
      setBusy(true)
      await request(`/api/groups/${groupId}/vote-leader`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nominatedStudentId: studentId })
      })
      const hasDemoMembers = groups.find((group) => group.id === groupId)?.members.some((member) => member.isDemo)
      toast.success(hasDemoMembers && demoSeedEnabled
        ? `Bạn và thành viên demo đã bỏ phiếu cho ${studentName}.`
        : `Đã bỏ phiếu bầu ${studentName} làm Trưởng nhóm!`)
      await loadGroups()
    } catch (error) {
      toast.error(error.message || 'Không thể bỏ phiếu.')
    } finally {
      setBusy(false)
    }
  }

  // 5. Lock Group
  const handleLockGroup = async (group) => {
    if (!window.confirm(`Xác nhận khóa nhóm "${group.name}"? Sau khi khóa sẽ không thể thêm/rời thành viên.`)) return
    try {
      setBusy(true)
      await request(`/api/groups/${group.id}/lock`, { method: 'POST' })
      toast.success(`Đã khóa danh sách nhóm "${group.name}" thành công!`)
      await loadGroups()
    } catch (error) {
      toast.error(error.message || 'Không thể khóa nhóm.')
    } finally {
      setBusy(false)
    }
  }

  // 6. Update group name, topic, and project description.
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!selectedGroup) return
    const cleanTopic = editGroupTopic.trim()
    if (cleanTopic.length > 0 && cleanTopic.length < 3) {
      toast.error('Tên đề tài phải có ít nhất 3 ký tự.')
      return
    }
    try {
      setBusy(true)
      const updated = await request(`/api/groups/${selectedGroup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: editGroupName.trim(),
          projectDescription: editGroupDescription.trim(),
          topicTitle: cleanTopic,
          recruitmentNeeds: null
        })
      })
      setSelectedGroup(mapGroup(updated))
      toast.success('Đã cập nhật tên nhóm và đề tài.')
      setEditGroupModal(false)
      await loadGroups()
    } catch (error) {
      toast.error(error.message || 'Không thể cập nhật nhóm.')
    } finally {
      setBusy(false)
    }
  }

  // 6b. Invite / Add friend to group by Email or StudentCode
  const inviteStudentByIdentifier = async (rawIdentifier) => {
    const clean = (rawIdentifier || '').trim()
    if (!selectedGroup || !clean) return
    try {
      setInviting(true)
      const updatedGroup = await request(`/api/groups/${selectedGroup.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: clean })
      })
      setSelectedGroup(mapGroup(updatedGroup))
      setInviteIdentifier('')
      setInviteCandidates([])
      toast.success('Đã thêm bạn vào nhóm thành công!')
      await loadGroups()
    } catch (error) {
      toast.error(error.message || 'Không thể mời sinh viên vào nhóm.')
    } finally {
      setInviting(false)
    }
  }

  const handleInviteMember = async (e) => {
    e.preventDefault()
    await inviteStudentByIdentifier(inviteIdentifier)
  }

  // 7. Delete Group
  const handleDeleteGroup = async (group) => {
    if (!window.confirm(`CẢNH BÁO: Bạn có chắc chắn muốn xóa nhóm "${group.name}" không? Thao tác này không thể hoàn tác.`)) return
    try {
      setBusy(true)
      await request(`/api/groups/${group.id}`, { method: 'DELETE' })
      toast.success(`Đã xóa nhóm "${group.name}".`)
      setSelectedGroup(null)
      await loadGroups()
    } catch (error) {
      toast.error(error.message || 'Không thể xóa nhóm.')
    } finally {
      setBusy(false)
    }
  }

  // 8. Kick Member (Admin only)
  const handleKickMember = async (groupId, studentId, studentName) => {
    if (!window.confirm(`Xác nhận xóa sinh viên "${studentName}" khỏi nhóm?`)) return
    try {
      setBusy(true)
      await request(`/api/groups/${groupId}/members/${studentId}`, { method: 'DELETE' })
      toast.success(`Đã xóa ${studentName} khỏi nhóm.`)
      await loadGroups()
    } catch (error) {
      toast.error(error.message || 'Không thể xóa thành viên.')
    } finally {
      setBusy(false)
    }
  }

  // 9. Admin Trigger Random Matching
  const handleRandomMatching = () => {
    const targetCode = isAdmin ? semesterCode : studentSemesterCode
    if (!targetCode) return
    setShowRandomConfirm(true)
  }

  const runRandomMatching = async () => {
    const targetCode = isAdmin ? semesterCode : studentSemesterCode
    if (!targetCode) return
    try {
      setBusy(true)
      const res = await request(`/api/matching/random?semesterCode=${encodeURIComponent(targetCode)}`, {
        method: 'POST'
      })
      setShowRandomConfirm(false)
      toast.success(`Ghép nhóm ngẫu nhiên thành công! Ghép ${res?.matchedStudents || 0} sinh viên (${res?.createdGroups || 0} nhóm mới tạo, ${res?.addedToExistingGroups || 0} bổ sung vào nhóm cũ).`, { duration: 5000 })
      await loadGroups()
    } catch (error) {
      toast.error(error.message || 'Không thể thực hiện ghép nhóm ngẫu nhiên.')
    } finally {
      setBusy(false)
    }
  }

  const currentStudentId = account?.student?.id
  const activeSemester = semesters.find((s) => s.code === (isAdmin ? semesterCode : studentSemesterCode))

  const filteredGroups = groups.filter((g) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'recruiting' && g.statusType === 'recruiting') ||
      (filter === 'full' && g.statusType === 'full')

    const q = search.toLowerCase()
    const matchesSearch =
      g.name.toLowerCase().includes(q) ||
      g.topic.toLowerCase().includes(q) ||
      g.leader.toLowerCase().includes(q)

    return matchesFilter && matchesSearch
  })

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Nhóm & Đề tài Khởi nghiệp</h1>
          <p className="page-subtitle">
            Khám phá danh sách các nhóm Khởi nghiệp, tìm đồng đội bù trừ kỹ năng, bầu trưởng nhóm hoặc đăng ký đề tài.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {isAdmin && (
            <button
              className="btn btn-outline"
              onClick={handleRandomMatching}
              disabled={busy || !semesterCode}
              title="Tự động gom sinh viên chưa có nhóm để ghép thành các nhóm 5 người"
            >
              <Shuffle size={16} />
              <span>Ghép nhóm ngẫu nhiên</span>
            </button>
          )}

          {/* Student can create group only if they have an assigned semester */}
          {(isAdmin || studentSemesterCode) && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              <span>Tạo nhóm mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Warning Banner if Student has no enrollment */}
      {!isAdmin && !studentSemesterCode && (
        <div className="card" style={{ marginBottom: 'var(--space-6)', backgroundColor: '#FEFCE8', borderColor: '#FEF08A', display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertCircle size={24} color="#CA8A04" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#854D0E', fontSize: 14 }}>Bạn chưa được phân bổ vào học kỳ nào</strong>
            <p style={{ color: '#A16207', fontSize: 13, margin: '2px 0 0' }}>
              Tài khoản của bạn ({account?.email}) chưa có trong danh sách Roster của học kỳ nào. Vui lòng liên hệ Quản trị viên để được nạp vào hệ thống trước khi tham gia hoặc tạo nhóm.
            </p>
          </div>
        </div>
      )}

      {/* Warning Banner if backend throws Enrollment Error */}
      {enrollmentError && (
        <div className="card" style={{ marginBottom: 'var(--space-6)', backgroundColor: '#FEF2F2', borderColor: '#FECACA', display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertCircle size={22} color="var(--error)" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ color: 'var(--error)', fontSize: 14 }}>Chưa tìm thấy hồ sơ học phần</strong>
            <p style={{ color: '#991B1B', fontSize: 13, margin: '2px 0 0' }}>
              {enrollmentError}
            </p>
          </div>
        </div>
      )}

      {/* ── Semester Header / Filter Tabs ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Admin and Mentor have Semester Dropdown; Student has Fixed Badge */}
          {isAdmin || isMentor ? (
            <select
              className="select input-sm"
              value={semesterCode}
              onChange={(e) => setSemesterCode(e.target.value)}
              style={{ fontWeight: 600, minWidth: 160 }}
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.code}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div className="badge badge-teal" style={{ fontSize: 13, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} />
                <span>
                  Học kỳ của bạn: <strong>{activeSemester ? `${activeSemester.code} · ${activeSemester.name}` : (studentSemesterCode || 'Chưa xếp kỳ')}</strong>
                </span>
              </div>
              {account?.student && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowCoreModal(true)}
                  title="Xem & chọn thế mạnh chuyên môn (Core) của bạn"
                >
                  <Sparkles size={14} color="var(--primary)" />
                  <span>
                    Core: {account.student.strengthRoles?.length
                      ? account.student.strengthRoles.map(getTeamRoleLabel).join(', ')
                      : 'Chưa chọn'}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* Filter Tabs */}
          <div className="filter-tab-bar" style={{ margin: 0 }}>
            <button
              className={`tab-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              Tất cả ({groups.length})
            </button>
            <button
              className={`tab-btn ${filter === 'recruiting' ? 'active' : ''}`}
              onClick={() => setFilter('recruiting')}
            >
              Đang tuyển ({groups.filter((g) => g.statusType === 'recruiting').length})
            </button>
            <button
              className={`tab-btn ${filter === 'full' ? 'active' : ''}`}
              onClick={() => setFilter('full')}
            >
              Đã chốt / Đủ người ({groups.filter((g) => g.statusType === 'full').length})
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', minWidth: 260 }}>
          <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="input input-sm"
            placeholder="Tìm theo tên nhóm, đề tài, leader..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>
      </div>

      {/* ── Group Cards Grid ── */}
      <div className="groups-grid">
        {filteredGroups.map((group) => {
          const isFull = group.statusType === 'full'
          const isInGroup = group.members.some((m) => m.studentId === currentStudentId)

          return (
            <div className="group-clean-card" key={group.id} style={{ borderColor: isInGroup ? 'var(--primary)' : undefined }}>
              <div className="group-status-header">
                {group.isLocked ? (
                  <span className="badge badge-teal">
                    <Lock size={12} /> Đã khóa nhóm
                  </span>
                ) : isFull ? (
                  <span className="badge badge-teal">
                    <CheckCircle2 size={12} /> {group.statusText}
                  </span>
                ) : (
                  <span className="badge badge-warning">
                    <Users size={12} /> {group.statusText}
                  </span>
                )}
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {group.members.length}/{group.maxMembers} thành viên
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <h2 className="group-title">{group.name}</h2>
                {isInGroup && (
                  <span className="badge badge-green" style={{ fontSize: 10 }}>Nhóm của bạn</span>
                )}
              </div>
              <p className="group-topic">{group.topic}</p>
              <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>{group.projectDescription}</p>
              {!!group.recruitmentNeeds.length && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>{group.recruitmentNeeds.map((need) => <span className="badge badge-warning" key={need.roleCode}>{need.roleCode} · {need.slots}</span>)}</div>}

              {/* Members List */}
              <div className="group-members-list">
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 2 }}>Đội ngũ:</span>
                {group.members.map((m, idx) => (
                  <span key={idx} className="member-avatar-pill" title={`${m.name} (${m.role})`}>
                    <span className="avatar avatar-sm avatar-primary" style={{ width: 20, height: 20, fontSize: 10 }}>
                      {m.name.charAt(0)}
                    </span>
                    <strong>{m.name.split(' ').pop()}</strong>
                    {m.isLeader && <Crown size={12} color="#EAB308" style={{ marginLeft: 2 }} />}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                <span>Trưởng nhóm: <strong style={{ color: 'var(--text-main)' }}>{group.leader}</strong></span>
                <span className="badge badge-neutral" style={{ fontSize: 10.5 }}>{group.semesterCode}</span>
              </div>

              {/* Action Buttons */}
              <div className="group-actions-footer">
                <button
                  className="btn btn-outline btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => openGroupDetails(group)}
                >
                  Chi tiết & Quản lý
                </button>

                {!isInGroup && !isFull && !group.isLocked && (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                    disabled={busy}
                    onClick={() => handleJoin(group)}
                  >
                    Xin gia nhập
                  </button>
                )}

                {(isAdmin || isInGroup) && !isFull && !group.isLocked && (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1 }}
                    disabled={busy}
                    onClick={() => openGroupDetails(group)}
                  >
                    <UserPlus size={14} /> Mời bạn
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {!filteredGroups.length && !busy && (
          <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px' }}>
            <Layers size={36} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>
              {studentSemesterCode ? `Không tìm thấy nhóm phù hợp trong kỳ ${studentSemesterCode}` : 'Chưa có dữ liệu nhóm'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              {studentSemesterCode
                ? 'Bạn có thể bấm "Tạo nhóm mới" để khởi tạo đội ngũ Khởi nghiệp của mình.'
                : 'Vui lòng liên hệ Admin để được xếp vào học kỳ.'}
            </p>
          </div>
        )}
      </div>

      {/* ── Detail & Management Modal ── */}
      {selectedGroup && (
        <div className="modal-backdrop" onClick={() => setSelectedGroup(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="badge badge-neutral" style={{ fontSize: 11 }}>{selectedGroup.semesterCode}</span>
                  {selectedGroup.isLocked ? (
                    <span className="badge badge-teal"><Lock size={12} /> Đã khóa nhóm</span>
                  ) : (
                    <span className="badge badge-green">Đang tuyển</span>
                  )}
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  {selectedGroup.name}
                </h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedGroup(null)} style={{ padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* Topic Section */}
            <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>ĐỀ TÀI KHỞI NGHIỆP:</span>
                {(isAdmin || selectedGroup.members.some((m) => m.studentId === currentStudentId)) && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11.5, padding: '3px 8px' }}
                    onClick={() => {
                      setEditGroupName(selectedGroup.name)
                      setEditGroupTopic(selectedGroup.topicTitle || '')
                      setEditGroupDescription(selectedGroup.projectDescription || '')
                      setEditGroupModal(true)
                    }}
                  >
                    <Edit3 size={12} /> Chỉnh sửa tên & đề tài
                  </button>
                )}
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--text-main)', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                {selectedGroup.topic}
              </p>
              {selectedGroup.projectDescription && (
                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 6, marginBottom: 0 }}>
                  {selectedGroup.projectDescription}
                </p>
              )}
              {selectedGroup.recruitmentNeeds && selectedGroup.recruitmentNeeds.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', alignSelf: 'center' }}>Vị trí cần tuyển:</span>
                  {selectedGroup.recruitmentNeeds.map((need) => (
                    <span className="badge badge-warning" key={need.roleCode} style={{ fontSize: 11 }}>
                      {need.roleCode} ({need.slots} chỗ)
                    </span>
                  ))}
                </div>
              )}
              {account?.role === 'Student' && selectedGroup.members.some((member) => member.studentId === currentStudentId) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--border-default)', marginTop: 12, paddingTop: 12 }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: 12.5, color: 'var(--text-main)' }}>
                      <GraduationCap size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                      Mentor hướng dẫn
                    </strong>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {mentorStatus?.groupId === selectedGroup.id && mentorStatus.data.hasActiveRequest
                        ? mentorStatus.data.status === 1
                          ? `${mentorStatus.data.mentorName} đang hướng dẫn nhóm.`
                          : `Lời mời ${mentorStatus.data.mentorName} đang chờ giảng viên phản hồi.`
                        : mentorStatusError
                          ? mentorStatusError
                          : loadingMentorStatus
                            ? 'Đang kiểm tra trạng thái mentor...'
                            : selectedGroup.canRequestMentor
                              ? selectedGroup.isCurrentLeader
                                ? 'Tìm mentor còn hạn ngạch và gửi lời mời; mentor cần chấp nhận.'
                                : 'Chỉ trưởng nhóm mới có thể gửi lời mời mentor.'
                              : selectedGroup.isLocked
                                ? 'Trưởng nhóm cần đăng ký đề tài chính thức trước khi mời mentor.'
                                : `Cần đủ 4–5 thành viên${selectedGroup.leaderStudentId ? '' : ', bầu trưởng nhóm'}, sau đó trưởng nhóm khóa nhóm và đăng ký đề tài.`}
                    </span>
                  </div>
                  {selectedGroup.canRequestMentor && selectedGroup.isCurrentLeader &&
                    !loadingMentorStatus && !mentorStatusError &&
                    !(mentorStatus?.groupId === selectedGroup.id && mentorStatus.data.hasActiveRequest) && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={loadingMentors}
                      onClick={() => openMentorRequest(selectedGroup)}
                    >
                      <Search size={14} /> {loadingMentors ? 'Đang tải mentor...' : 'Tìm mentor'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Members List with Vote & Kick Actions */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                <span>Thành viên nhóm ({selectedGroup.members.length}/5)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Bỏ phiếu bầu Nhóm trưởng</span>
                  {(isAdmin || (isStudent && selectedGroup.members.some((member) => member.studentId === currentStudentId))) &&
                    demoSeedEnabled && !selectedGroup.isLocked && selectedGroup.members.length < 5 && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={seedingDemoMembers}
                      onClick={() => handleSeedDemoMembers(selectedGroup)}
                      title="Thêm nhanh thành viên demo để test bầu Leader & khóa nhóm"
                    >
                      <Plus size={13} /> {seedingDemoMembers ? 'Đang seed...' : `Seed SV test (+${5 - selectedGroup.members.length})`}
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedGroup.members.map((m) => {
                  const isThisMemberMe = m.studentId === currentStudentId
                  const amIInGroup = selectedGroup.members.some((x) => x.studentId === currentStudentId)
                  const memberEmail = m.email || (isThisMemberMe ? account?.email : '')

                  return (
                    <div
                      key={m.studentId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        backgroundColor: m.isLeader ? '#F0FDF4' : 'var(--bg-subtle)',
                        border: m.isLeader ? '1px solid #BBF7D0' : '1px solid transparent',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar avatar-sm avatar-primary">
                          {m.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>{m.name}</strong>
                            {isThisMemberMe && <span className="badge badge-neutral" style={{ fontSize: 10 }}>Bạn</span>}
                            {m.isDemo && <span className="badge badge-neutral" style={{ fontSize: 10 }}>DEMO</span>}
                            {m.isLeader && (
                              <span className="badge badge-warning" style={{ fontSize: 10 }}>
                                <Crown size={11} /> Leader
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                            {memberEmail ? `${memberEmail} · ${m.studentCode}` : m.studentCode}
                            {m.major && m.major !== m.studentCode ? ` · ${m.major}` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Member Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {/* Vote Button */}
                        {amIInGroup && !selectedGroup.isLocked && !m.isLeader && (
                          <button
                            className="btn btn-outline btn-sm"
                            style={{ fontSize: 11, padding: '3px 8px' }}
                            disabled={busy}
                            onClick={() => handleVoteLeader(selectedGroup.id, m.studentId, m.name)}
                            title="Bỏ phiếu bầu bạn này làm Trưởng nhóm"
                          >
                            <Crown size={12} /> Bầu Leader
                          </button>
                        )}

                        {/* Kick Button (Admin only) */}
                        {isAdmin && !selectedGroup.isLocked && (
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--error)', padding: '3px 6px' }}
                            disabled={busy}
                            onClick={() => handleKickMember(selectedGroup.id, m.studentId, m.name)}
                            title="Xóa thành viên khỏi nhóm"
                          >
                            <UserMinus size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {(isAdmin || selectedGroup.members.some((x) => x.studentId === currentStudentId)) &&
                !selectedGroup.isLocked && selectedGroup.members.length < 5 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border-default)' }}>
                  <form onSubmit={handleInviteMember} style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="input input-sm"
                      placeholder="Tìm hoặc nhập Email / MSSV bạn (VD: SE196620, tên, email...)"
                      value={inviteIdentifier}
                      onChange={(e) => {
                        const val = e.target.value
                        setInviteIdentifier(val)
                        if (val.trim().length < 2) setInviteCandidates([])
                      }}
                      disabled={inviting}
                    />
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={inviting || !inviteIdentifier.trim()}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <UserPlus size={14} /> {inviting ? 'Đang thêm...' : 'Mời vào nhóm'}
                    </button>
                  </form>

                  {inviteIdentifier.trim().length >= 2 && (
                    <div style={{ marginTop: 8, border: '1px solid var(--border-default)', borderRadius: 8, backgroundColor: 'var(--bg-card)', maxHeight: 210, overflowY: 'auto' }}>
                      {searchingCandidates ? (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>
                          Đang tìm kiếm sinh viên trong học kỳ...
                        </div>
                      ) : inviteCandidates.length === 0 ? (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>
                          Không tìm thấy sinh viên phù hợp trong học kỳ {selectedGroup.semesterCode}.
                        </div>
                      ) : (
                        inviteCandidates.map((cand) => (
                          <div
                            key={cand.studentId}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 10,
                              padding: '8px 12px',
                              borderBottom: '1px solid var(--border-default)'
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: 12.5, color: 'var(--text-main)' }}>{cand.fullName}</strong>
                                <span className="badge badge-neutral" style={{ fontSize: 10 }}>{cand.studentCode}</span>
                                <span className={`badge ${cand.hasGroup ? 'badge-neutral' : 'badge-green'}`} style={{ fontSize: 10 }}>
                                  {cand.hasGroup ? 'Đã có nhóm' : 'Chưa có nhóm'}
                                </span>
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                                {cand.email}{cand.major ? ` · ${cand.major}` : ''}
                              </div>
                              {cand.strengthRoles?.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                  {cand.strengthRoles.map((r) => (
                                    <span key={r} className="badge badge-teal" style={{ fontSize: 9.5 }}>
                                      {getTeamRoleLabel(r)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              style={{ whiteSpace: 'nowrap', fontSize: 11.5 }}
                              disabled={inviting || cand.hasGroup}
                              onClick={() => inviteStudentByIdentifier(cand.studentCode)}
                            >
                              {cand.hasGroup ? 'Đã vào nhóm' : 'Chọn & Mời'}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* Delete Group (Leader or Admin) */}
                {(isAdmin || selectedGroup.leaderStudentId === currentStudentId) && (
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ color: 'var(--error)', borderColor: 'var(--border-default)' }}
                    disabled={busy}
                    onClick={() => handleDeleteGroup(selectedGroup)}
                  >
                    <Trash2 size={13} /> Xóa nhóm
                  </button>
                )}

                {/* Lock Group (Leader or Admin) */}
                {(isAdmin || selectedGroup.leaderStudentId === currentStudentId) && !selectedGroup.isLocked && (
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={busy}
                    onClick={() => handleLockGroup(selectedGroup)}
                    title="Khóa nhóm để hoàn tất thành viên"
                  >
                    <Lock size={13} /> Khóa nhóm
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedGroup(null)}>
                  Đóng
                </button>

                {/* Leave Group Button if User is inside */}
                {selectedGroup.members.some((m) => m.studentId === currentStudentId) && !selectedGroup.isLocked && (
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ color: 'var(--error)' }}
                    disabled={busy}
                    onClick={() => handleLeaveGroup(selectedGroup)}
                  >
                    <LogOut size={13} /> Rời nhóm
                  </button>
                )}

                {/* Join Group Button if User is NOT inside and group is Open */}
                {!selectedGroup.members.some((m) => m.studentId === currentStudentId) &&
                  !selectedGroup.isLocked &&
                  selectedGroup.members.length < 5 && (
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => handleJoin(selectedGroup)}
                    >
                      Xin gia nhập
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Group Modal ── */}
      {editGroupModal && (
        <div className="modal-backdrop" style={{ zIndex: 1050 }} onClick={() => setEditGroupModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>
                Chỉnh sửa tên nhóm & đề tài
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditGroupModal(false)} style={{ padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Tên nhóm *</label>
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  className="input"
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label className="input-label">
                  Tên đề tài khởi nghiệp {selectedGroup?.isLocked ? '*' : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(tùy chọn)</span>}
                </label>
                <input
                  required={Boolean(selectedGroup?.isLocked)}
                  maxLength={300}
                  className="input"
                  placeholder="Nhập tên đề tài khởi nghiệp của nhóm..."
                  value={editGroupTopic}
                  onChange={(e) => setEditGroupTopic(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label className="input-label">Mô tả dự án *</label>
                <textarea
                  required
                  minLength={3}
                  maxLength={1200}
                  rows={3}
                  className="textarea"
                  value={editGroupDescription}
                  onChange={(e) => setEditGroupDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditGroupModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create Team Modal ── */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>
                Tạo nhóm Khởi nghiệp mới
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreateModal(false)} style={{ padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup}>
              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Học kỳ áp dụng</label>
                <input className="input" disabled value={targetSemesterCode || 'Chưa được gán học kỳ'} />
              </div>
              {!targetSemesterCode && (
                <div className="alert alert-warning" role="alert" style={{ marginBottom: 14 }}>
                  {isStudent
                    ? 'Tài khoản của bạn chưa được Admin xếp vào học kỳ. Hãy nhờ Admin thêm email vào danh sách sinh viên và gán học kỳ trước khi tạo nhóm.'
                    : 'Chưa có học kỳ áp dụng. Hãy tạo hoặc mở một học kỳ trước khi tạo nhóm.'}
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label className="input-label">Tên nhóm / Tên dự án *</label>
                <input
                  required
                  className="input"
                  placeholder="Ví dụ: AI HealthTech Core"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label className="input-label">Mô tả tóm tắt đề tài khởi nghiệp</label>
                <textarea
                  rows={3}
                  className="textarea"
                  placeholder="Nêu ngắn gọn bài toán giải quyết, đối tượng khách hàng và công nghệ cốt lõi..."
                  value={newGroupTopic}
                  onChange={(e) => setNewGroupTopic(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label className="input-label">Đang cần tuyển role nào? <span style={{ color: 'var(--text-muted)' }}>(tối đa 4)</span></label>
                <div role="group" aria-label="Role nhóm đang cần tuyển" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {TEAM_ROLES.map((role) => {
                    const selected = newRecruitmentNeeds.includes(role)
                    return <button key={role} type="button" aria-pressed={selected} className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-outline'}`} onClick={() => setNewRecruitmentNeeds((roles) => selected ? roles.filter((item) => item !== role) : roles.length < 4 ? [...roles, role] : roles)}>{role}</button>
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy || !targetSemesterCode}>
                  Tạo nhóm & Mở tuyển
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mentorRequestGroup && (
        <div className="modal-backdrop" onClick={() => setMentorRequestGroup(null)}>
          <form className="modal-dialog" onSubmit={handleRequestMentor} onClick={(event) => event.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Mời mentor hướng dẫn</h2>
            <p className="page-subtitle" style={{ marginBottom: 16 }}>{mentorRequestGroup.name}</p>
            <label className="input-label">Chọn mentor *
              <input
                className="input"
                type="search"
                value={mentorSearch}
                onChange={(event) => {
                  setMentorSearch(event.target.value)
                  setMentorRequestId('')
                }}
                placeholder="Tìm theo tên, email hoặc khoa..."
                aria-label="Tìm mentor"
                style={{ marginTop: 6, marginBottom: 8 }}
              />
              <select className="select" required value={mentorRequestId} onChange={(event) => setMentorRequestId(event.target.value)}>
                <option value="" disabled>Chọn mentor còn nhận nhóm</option>
                {filteredMentors.map((mentor) => (
                  <option key={mentor.id} value={mentor.id}>
                    {mentor.fullName} · {mentor.department} · còn {mentor.availableQuota ?? mentor.maxQuota - mentor.currentAssigned} suất
                  </option>
                ))}
              </select>
            </label>
            {filteredMentors.length === 0 && (
              <p className="page-subtitle" role="status" style={{ marginTop: 6 }}>
                {mentors.length === 0 ? 'Hiện không có mentor còn hạn ngạch.' : 'Không tìm thấy mentor phù hợp.'}
              </p>
            )}
            <label className="input-label" style={{ display: 'block', marginTop: 14 }}>Lời mời *
              <textarea className="textarea" required minLength={10} maxLength={2000} rows={4} value={mentorRequestMessage} onChange={(event) => setMentorRequestMessage(event.target.value)} placeholder="Giới thiệu đề tài và mong muốn được mentor hỗ trợ..." />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setMentorRequestGroup(null)}>Hủy</button>
              <button type="submit" className="btn btn-primary" disabled={sendingMentorRequest || !mentorRequestId}>
                {sendingMentorRequest ? 'Đang gửi...' : 'Gửi lời mời'}
              </button>
            </div>
          </form>
        </div>
      )}
      {showRandomConfirm && (
        <div className="modal-backdrop" onClick={() => !busy && setShowRandomConfirm(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shuffle size={18} color="var(--primary)" /> Ghép nhóm ngẫu nhiên
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowRandomConfirm(false)} disabled={busy} style={{ padding: 4 }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 18 }}>
              Chạy ghép nhóm tự động cho toàn bộ sinh viên chưa có nhóm trong học kỳ <strong>{isAdmin ? semesterCode : studentSemesterCode}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowRandomConfirm(false)} disabled={busy}>
                Hủy
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={runRandomMatching} disabled={busy}>
                {busy ? 'Đang ghép...' : 'Xác nhận ghép ngay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCoreModal && <StudentCoreModal onClose={() => setShowCoreModal(false)} />}
    </div>
  )
}
