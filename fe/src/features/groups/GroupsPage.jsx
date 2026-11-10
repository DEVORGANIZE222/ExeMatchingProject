import { useCallback, useEffect, useRef, useState } from 'react'
import {
  GraduationCap, Layers, Users, Plus, Search,
  CheckCircle2, X, Crown,
  LogOut, Lock, Unlock, Shuffle,
  Trash2, Edit3, UserMinus, UserPlus, Sparkles, Calendar, AlertCircle, MoreVertical
} from 'lucide-react'
import toast from 'react-hot-toast'
import '../../components/ServicePages.css'
import { useAuth } from '../../hooks/useAuth'
import { TEAM_ROLE_OPTIONS, getTeamRoleLabel } from '../../config/teamRoles'
import StudentCoreModal from '../../components/StudentCoreModal'
import ConfirmModal from '../../components/ConfirmModal'
import { fetchAllGroupsBySemester } from '../../utils/groupsApi'

const GROUPS_PER_PAGE = 24

function MemberAvatar({ src, name, size = 28 }) {
  const [failedSrc, setFailedSrc] = useState('')
  const validSrc = src && src !== failedSrc ? src : ''
  const fontSize = size <= 20 ? 10 : 11

  return (
    <span
      className="avatar avatar-sm avatar-primary"
      style={{ width: size, height: size, fontSize, overflow: 'hidden', flexShrink: 0 }}
    >
      {validSrc ? (
        <img
          key={validSrc}
          src={validSrc}
          alt={name || 'Avatar'}
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(validSrc)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
        />
      ) : (
        (name || 'U').charAt(0).toUpperCase()
      )}
    </span>
  )
}

const normalizeSearchText = (value) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase()
  .replace(/đ/g, 'd')

function analyzeGroupRoles(group, myRoles, isStudent, currentStudentId = null) {
  const memberRoleCounts = new Map()
  for (const member of group.members || []) {
    const memberRoles = member.studentId === currentStudentId && isStudent
      ? myRoles
      : (member.strengthRoles || [])
    const uniqueRoles = new Set(memberRoles)
    for (const code of uniqueRoles) {
      memberRoleCounts.set(code, (memberRoleCounts.get(code) || 0) + 1)
    }
  }

  const coveredEntries = TEAM_ROLE_OPTIONS
    .filter((opt) => memberRoleCounts.has(opt.code))
    .map((opt) => ({
      code: opt.code,
      label: opt.label,
      count: memberRoleCounts.get(opt.code)
    }))

  const coveredSet = new Set(coveredEntries.map((item) => item.code))
  const missingStandardRoles = TEAM_ROLE_OPTIONS.filter((opt) => !coveredSet.has(opt.code))
  const explicitNeeds = group.recruitmentNeeds || []
  const openSlots = Math.max(0, (group.maxMembers || 5) - (group.members?.length || 0))
  const isRecruiting = !group.isLocked && openSlots > 0

  let fit = null
  if (isStudent) {
    if (!myRoles || myRoles.length === 0) {
      fit = {
        status: 'no-core',
        label: 'Chưa chọn Core',
        detail: 'Chọn Core thế mạnh của bạn để biết nhóm này có phù hợp không.',
        matchedRoles: []
      }
    } else if (!isRecruiting) {
      fit = {
        status: 'closed',
        label: group.isLocked ? 'Đã khóa nhóm' : 'Đã đủ thành viên',
        detail: group.isLocked
          ? 'Nhóm đã khóa danh sách thành viên.'
          : 'Nhóm đã đủ 5/5 thành viên.',
        matchedRoles: []
      }
    } else if (explicitNeeds.length > 0) {
      const matchedRoles = explicitNeeds
        .filter((need) => myRoles.includes(need.roleCode))
        .map((need) => need.roleCode)
      if (matchedRoles.length > 0) {
        fit = {
          status: 'match',
          label: 'Phù hợp',
          detail: `Bạn khớp ${matchedRoles.length} vị trí nhóm đang tuyển: ${matchedRoles.map(getTeamRoleLabel).join(', ')}.`,
          matchedRoles
        }
      } else {
        fit = {
          status: 'mismatch',
          label: 'Chưa khớp role cần tuyển',
          detail: `Nhóm đang ưu tiên tuyển: ${explicitNeeds.map((n) => getTeamRoleLabel(n.roleCode)).join(', ')}.`,
          matchedRoles: []
        }
      }
    } else {
      const complementary = myRoles.filter((code) => !coveredSet.has(code))
      if (complementary.length > 0) {
        fit = {
          status: 'complement',
          label: 'Bù trừ tốt',
          detail: `Nhóm còn ${openSlots} chỗ và chưa có role: ${complementary.map(getTeamRoleLabel).join(', ')}.`,
          matchedRoles: complementary
        }
      } else {
        fit = {
          status: 'available',
          label: 'Có thể gia nhập',
          detail: `Nhóm còn ${openSlots} chỗ trống (nhận mọi role).`,
          matchedRoles: myRoles
        }
      }
    }
  }

  return {
    coveredEntries,
    coveredSet,
    missingStandardRoles,
    explicitNeeds,
    openSlots,
    isRecruiting,
    fit
  }
}

export default function GroupsPage() {
  const { account, request, isAdmin, isMentor, isStudent } = useAuth()
  const [groups, setGroups] = useState([])
  const [myGroup, setMyGroup] = useState(null)
  const [semesters, setSemesters] = useState([])
  const [semesterCode, setSemesterCode] = useState('')
  const [filter, setFilter] = useState('all') // 'all' | 'recruiting' | 'full'
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [enrollmentError, setEnrollmentError] = useState(null)
  const [demoSeedEnabled, setDemoSeedEnabled] = useState(false)
  const [seedingDemoMembers, setSeedingDemoMembers] = useState(false)

  // Modals state
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCoreModal, setShowCoreModal] = useState(false)
  const [showRandomConfirm, setShowRandomConfirm] = useState(false)
  const [confirmState, setConfirmState] = useState(null)
  const [showAdminMenu, setShowAdminMenu] = useState(false)
  const adminMenuRef = useRef(null)

  useEffect(() => {
    if (!showAdminMenu) return
    const handleOutsideClick = (event) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target)) {
        setShowAdminMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showAdminMenu])
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
  const [editRecruitmentNeeds, setEditRecruitmentNeeds] = useState([])
  const [editNeedsDirty, setEditNeedsDirty] = useState(false)

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
    const currentStudentIdForMap = account?.student?.id
    const currentStudentRoles = account?.student?.strengthRoles
    const mappedMembers = (group.members || []).map((member) => {
      const resolvedRoles = member.studentId === currentStudentIdForMap
        ? (currentStudentRoles ?? member.strengthRoles ?? [])
        : (member.strengthRoles ?? [])
      return {
        ...member,
        name: member.fullName,
        isDemo: Boolean(member.isDemo),
        isLeader: member.role === 1 || member.role === 'Leader',
        role: member.role === 1 || member.role === 'Leader' ? 'Trưởng nhóm' : 'Thành viên',
        major: member.major || '',
        avatarUrl: member.avatarUrl || '',
        strengthRoles: Array.isArray(resolvedRoles) ? resolvedRoles : []
      }
    })
    const firstMemberId = group.createdByStudentId && mappedMembers.some((m) => m.studentId === group.createdByStudentId)
      ? group.createdByStudentId
      : mappedMembers[0]?.studentId || null

    return {
      ...group,
      name: group.groupName,
      topic: group.topicTitle || 'Chưa đăng ký đề tài',
      projectDescription: group.projectDescription || 'Chưa có mô tả dự án.',
      recruitmentNeeds: group.recruitmentNeeds || [],
      leader: leader?.fullName || 'Chưa bầu trưởng nhóm',
      isLocked,
      firstMemberId,
      members: mappedMembers,
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

  // 2. Load Groups by Semester (fetch all pages so >100 groups are never truncated)
  const loadGroups = useCallback(async () => {
    const targetCode = isStudent ? studentSemesterCode : semesterCode
    if (!targetCode) {
      setGroups([])
      setMyGroup(null)
      return
    }

    setBusy(true)
    setEnrollmentError(null)
    try {
      const [{ items: rawItems }, myRaw] = await Promise.all([
        fetchAllGroupsBySemester(request, targetCode),
        isStudent
          ? request(`/api/groups/my?semesterCode=${encodeURIComponent(targetCode)}`).catch(() => null)
          : Promise.resolve(null)
      ])

      const mappedMy = myRaw ? mapGroup(myRaw) : null
      setMyGroup(mappedMy)

      let mapped = rawItems.map(mapGroup)
      if (mappedMy && !mapped.some((g) => g.id === mappedMy.id)) {
        mapped = [mappedMy, ...mapped]
      }
      const studentId = account?.student?.id
      mapped.sort((a, b) => {
        const aIsMine = Boolean(mappedMy?.id === a.id || (studentId && a.members.some((m) => m.studentId === studentId)))
        const bIsMine = Boolean(mappedMy?.id === b.id || (studentId && b.members.some((m) => m.studentId === studentId)))
        if (aIsMine !== bIsMine) return aIsMine ? -1 : 1
        return 0
      })

      setGroups(mapped)

      // Refresh currently selected group modal if open
      setSelectedGroup((current) => current
        ? mapped.find((group) => group.id === current.id) || (mappedMy?.id === current.id ? mappedMy : current)
        : null)
    } catch (error) {
      if (error.message?.includes('No enrollment') || error.status === 409 || error.status === 404) {
        setEnrollmentError('Tài khoản của bạn chưa có danh sách đăng ký học phần (Enrollment) trong học kỳ này.')
        setGroups([])
        setMyGroup(null)
      } else {
        toast.error(error.message || 'Không thể tải danh sách nhóm.')
      }
    } finally {
      setBusy(false)
    }
  }, [account, isStudent, mapGroup, request, semesterCode, studentSemesterCode])

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

  const handleSeedDemoMembers = (group) => {
    const emptySlots = 5 - group.members.length
    if (emptySlots <= 0) {
      toast.error('Nhóm đã đủ 5 thành viên.')
      return
    }
    setConfirmState({
      title: 'Seed thành viên demo',
      message: `Thêm ${emptySlots} thành viên demo vào nhóm "${group.name}"? Khi bỏ phiếu, các thành viên demo sẽ vote theo ứng viên bạn chọn.`,
      confirmLabel: `Seed +${emptySlots} thành viên`,
      tone: 'primary',
      onConfirm: async () => {
        setSeedingDemoMembers(true)
        try {
          const updatedGroup = await request(`/api/groups/${group.id}/demo-members`, { method: 'POST' })
          setSelectedGroup(mapGroup(updatedGroup))
          toast.success(`Đã thêm ${emptySlots} thành viên demo.`)
          setConfirmState(null)
          await loadGroups()
        } catch (error) {
          toast.error(error.message || 'Không thể seed thành viên demo.')
        } finally {
          setSeedingDemoMembers(false)
        }
      }
    })
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
      toast.error(error.message || 'Không thể tải danh sách mentor.', { id: 'mentor-rec-error' })
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
        : 'Chưa có học kỳ áp dụng. Vui lòng tạo hoặc mở một học kỳ trước.', { id: 'group-create-error' })
      return
    }
    const cleanName = newGroupName.trim()
    const cleanDesc = newGroupTopic.trim() || cleanName
    if (cleanName.length < 2) {
      toast.error('Tên nhóm phải có ít nhất 2 ký tự.', { id: 'group-create-error' })
      return
    }
    if (cleanDesc.length < 2) {
      toast.error('Mô tả tóm tắt đề tài phải có ít nhất 2 ký tự.', { id: 'group-create-error' })
      return
    }
    try {
      setBusy(true)
      await request('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: cleanName,
          semesterCode: targetSemesterCode,
          projectDescription: cleanDesc,
          recruitmentNeeds: newRecruitmentNeeds.map((roleCode) => ({ roleCode, slots: 1 }))
        })
      })

      toast.success(`Đã khởi tạo nhóm "${cleanName}".`)
      setShowCreateModal(false)
      setNewGroupName('')
      setNewGroupTopic('')
      setNewRecruitmentNeeds([])
      await loadGroups()
    } catch (error) {
      toast.error(error.message || 'Không thể tạo nhóm.', { id: 'group-create-error' })
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
  const handleLeaveGroup = (group) => {
    setConfirmState({
      title: 'Rời khỏi nhóm',
      message: `Bạn có chắc chắn muốn rời nhóm "${group.name}"?`,
      confirmLabel: 'Rời nhóm',
      tone: 'danger',
      onConfirm: async () => {
        try {
          setBusy(true)
          await request(`/api/groups/${group.id}/members/me`, { method: 'DELETE' })
          toast.success('Đã rời khỏi nhóm thành công.')
          setConfirmState(null)
          setSelectedGroup(null)
          await loadGroups()
        } catch (error) {
          toast.error(error.message || 'Không thể rời nhóm.')
        } finally {
          setBusy(false)
        }
      }
    })
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
  const handleLockGroup = (group) => {
    setConfirmState({
      title: 'Khóa nhóm khởi nghiệp',
      message: `Xác nhận khóa nhóm "${group.name}"? Sau khi khóa sẽ không thể thêm hoặc rời thành viên (có thể gỡ khóa lại trước hạn đề tài).`,
      confirmLabel: 'Khóa nhóm',
      tone: 'warning',
      onConfirm: async () => {
        try {
          setBusy(true)
          const updated = await request(`/api/groups/${group.id}/lock`, { method: 'POST' })
          setSelectedGroup(mapGroup(updated))
          toast.success(`Đã khóa danh sách nhóm "${group.name}" thành công!`)
          setConfirmState(null)
          await loadGroups()
        } catch (error) {
          setConfirmState(null)
          toast.error(error.message || 'Không thể khóa nhóm.', { id: 'group-action-error' })
        } finally {
          setBusy(false)
        }
      }
    })
  }

  // 5b. Unlock Group (Leader or Admin)
  const handleUnlockGroup = (group) => {
    setConfirmState({
      title: 'Gỡ khóa nhóm',
      message: `Xác nhận gỡ khóa nhóm "${group.name}" để mở lại quyền thêm hoặc rời thành viên?`,
      confirmLabel: 'Gỡ khóa nhóm',
      tone: 'warning',
      onConfirm: async () => {
        try {
          setBusy(true)
          const updated = await request(`/api/groups/${group.id}/unlock`, { method: 'POST' })
          setSelectedGroup(mapGroup(updated))
          toast.success(`Đã gỡ khóa nhóm "${group.name}".`)
          setConfirmState(null)
          await loadGroups()
        } catch (error) {
          setConfirmState(null)
          toast.error(error.message || 'Không thể gỡ khóa nhóm.', { id: 'group-action-error' })
        } finally {
          setBusy(false)
        }
      }
    })
  }

  // 6. Update group name, topic, project description, and open recruitment needs.
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!selectedGroup) return
    const cleanTopic = editGroupTopic.trim()
    if (cleanTopic.length > 0 && cleanTopic.length < 3) {
      toast.error('Tên đề tài phải có ít nhất 3 ký tự.')
      return
    }
    const remainingSlots = Math.max(0, 5 - (selectedGroup.members?.length || 0))
    const maxNeeds = Math.min(4, remainingSlots)
    const recruitmentNeeds = !selectedGroup.isLocked && editNeedsDirty
      ? editRecruitmentNeeds.slice(0, maxNeeds).map((roleCode) => ({ roleCode, slots: 1 }))
      : null
    try {
      setBusy(true)
      const updated = await request(`/api/groups/${selectedGroup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: editGroupName.trim(),
          projectDescription: editGroupDescription.trim(),
          topicTitle: cleanTopic,
          recruitmentNeeds
        })
      })
      setSelectedGroup(mapGroup(updated))
      toast.success('Đã cập nhật thông tin nhóm thành công.')
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
  const handleDeleteGroup = (group) => {
    setConfirmState({
      title: 'Xóa nhóm khởi nghiệp',
      message: `CẢNH BÁO: Bạn có chắc chắn muốn xóa nhóm "${group.name}" không? Thao tác này không thể hoàn tác.`,
      confirmLabel: 'Xóa nhóm',
      tone: 'danger',
      onConfirm: async () => {
        try {
          setBusy(true)
          await request(`/api/groups/${group.id}`, { method: 'DELETE' })
          toast.success(`Đã xóa nhóm "${group.name}".`)
          setConfirmState(null)
          setSelectedGroup(null)
          await loadGroups()
        } catch (error) {
          toast.error(error.message || 'Không thể xóa nhóm.')
        } finally {
          setBusy(false)
        }
      }
    })
  }

  // 8. Kick Member (Admin or first member of group)
  const handleKickMember = (groupId, studentId, studentName) => {
    setConfirmState({
      title: 'Xóa thành viên khỏi nhóm',
      message: `Xác nhận xóa "${studentName}" khỏi nhóm? Nếu đã có bầu Leader trước đó, hệ thống sẽ reset để cả nhóm bầu lại.`,
      confirmLabel: 'Xóa khỏi nhóm',
      tone: 'danger',
      onConfirm: async () => {
        try {
          setBusy(true)
          await request(`/api/groups/${groupId}/members/${studentId}`, { method: 'DELETE' })
          toast.success(`Đã xóa ${studentName} khỏi nhóm.`)
          setConfirmState(null)
          await loadGroups()
        } catch (error) {
          toast.error(error.message || 'Không thể xóa thành viên.')
        } finally {
          setBusy(false)
        }
      }
    })
  }

  // 9. Admin Trigger Random Matching
  const handleRandomMatching = () => {
    const targetCode = isAdmin ? semesterCode : studentSemesterCode
    if (!targetCode) return
    setShowRandomConfirm(true)
  }

  // 10. Admin Bulk Delete All Unlocked Groups (preserves Locked groups)
  const handleDeleteUnlockedGroups = () => {
    if (!isAdmin || !semesterCode) return
    const openCount = groups.filter((g) => !g.isLocked).length
    const lockedCount = groups.filter((g) => g.isLocked).length
    if (openCount === 0) {
      toast.error(`Không có nhóm chưa khóa nào trong học kỳ ${semesterCode}.`)
      return
    }
    setConfirmState({
      title: 'Xóa tất cả nhóm chưa khóa',
      message: `Xác nhận xóa toàn bộ ${openCount} nhóm chưa khóa trong học kỳ "${semesterCode}"? Hệ thống sẽ giữ nguyên ${lockedCount} nhóm đã khóa (Locked) và không thể hoàn tác với các nhóm đã xóa.`,
      confirmLabel: `Xóa ${openCount} nhóm chưa khóa`,
      tone: 'danger',
      onConfirm: async () => {
        try {
          setBusy(true)
          const res = await request(`/api/groups/semester/${encodeURIComponent(semesterCode)}`, { method: 'DELETE' })
          const deleted = res?.deletedGroups ?? 0
          const released = res?.releasedStudents ?? 0
          const skipped = res?.skippedLockedGroups ?? lockedCount
          toast.success(`Đã xóa ${deleted} nhóm chưa khóa (giải phóng ${released} sinh viên); giữ nguyên ${skipped} nhóm đã khóa.`, { duration: 5000 })
          setConfirmState(null)
          setSelectedGroup((current) => (current?.isLocked ? current : null))
          await loadGroups()
        } catch (error) {
          toast.error(error.message || 'Không thể xóa danh sách nhóm chưa khóa.')
        } finally {
          setBusy(false)
        }
      }
    })
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
  const myRoles = account?.student?.strengthRoles || []
  const activeSemester = semesters.find((s) => s.code === (isAdmin ? semesterCode : studentSemesterCode))
  const currentStudentGroup = myGroup || groups.find((g) => g.members.some((m) => m.studentId === currentStudentId)) || null
  const studentHasGroup = isStudent && Boolean(currentStudentGroup)

  const matchingGroupsCount = isStudent && myRoles.length > 0
    ? groups.filter((g) => {
        if (g.members.some((m) => m.studentId === currentStudentId)) return false
        const { fit } = analyzeGroupRoles(g, myRoles, true, currentStudentId)
        return fit?.status === 'match' || fit?.status === 'complement'
      }).length
    : 0

  const filteredGroups = groups.filter((g) => {
    const roleFit = filter === 'matching' ? analyzeGroupRoles(g, myRoles, isStudent, currentStudentId).fit : null
    const isInThisGroup = g.members.some((m) => m.studentId === currentStudentId)
    const matchesFilter =
      filter === 'all' ||
      (filter === 'recruiting' && g.statusType === 'recruiting') ||
      (filter === 'full' && g.statusType === 'full') ||
      (filter === 'matching' && !isInThisGroup && (roleFit?.status === 'match' || roleFit?.status === 'complement'))

    const q = normalizeSearchText(search.trim())
    const matchesSearch =
      !q ||
      normalizeSearchText(g.name || '').includes(q) ||
      normalizeSearchText(g.topic || '').includes(q) ||
      normalizeSearchText(g.leader || '').includes(q) ||
      g.members.some((m) => normalizeSearchText(`${m.name || ''} ${m.studentCode || ''}`).includes(q))

    return matchesFilter && matchesSearch
  })

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / GROUPS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const pagedGroups = filteredGroups.slice((safePage - 1) * GROUPS_PER_PAGE, safePage * GROUPS_PER_PAGE)

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div style={{ flex: '1 1 340px', minWidth: 0 }}>
          <h1 className="page-title">Nhóm & Đề tài Khởi nghiệp</h1>
          <p className="page-subtitle">
            Khám phá danh sách các nhóm Khởi nghiệp, tìm đồng đội bù trừ kỹ năng, bầu trưởng nhóm hoặc đăng ký đề tài.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap', marginLeft: 'auto' }}>
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

          {/* Primary action placed prominently at top-right */}
          {(isAdmin || studentSemesterCode) && (
            <span
              title={studentHasGroup ? 'Bạn đã tham gia một nhóm trong học kỳ này' : 'Tạo nhóm khởi nghiệp mới'}
              style={studentHasGroup ? { cursor: 'not-allowed' } : undefined}
            >
              <button
                type="button"
                className={`btn ${studentHasGroup ? 'btn-outline' : 'btn-primary'}`}
                disabled={studentHasGroup}
                onClick={() => !studentHasGroup && setShowCreateModal(true)}
                style={studentHasGroup ? { opacity: 0.6 } : undefined}
              >
                <Plus size={16} />
                <span>Tạo nhóm mới</span>
              </button>
            </span>
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

      {/* ── Personal Context Chips (Separated from List Filters) ── */}
      <div className="groups-context-bar">
        {isAdmin || isMentor ? (
          <select
            className="select input-sm"
            value={semesterCode}
            onChange={(e) => {
              setSemesterCode(e.target.value)
              setCurrentPage(1)
            }}
            style={{ fontWeight: 600, width: 'auto', minWidth: 180, maxWidth: 260 }}
          >
            {semesters.map((s) => (
              <option key={s.id} value={s.code}>
                {s.code} - {s.name}
              </option>
            ))}
          </select>
        ) : (
          <>
            <div className="groups-context-pill semester">
              <Calendar size={14} />
              <span>
                Học kỳ:{' '}
                <strong>
                  {activeSemester
                    ? (activeSemester.name && activeSemester.name.toLowerCase() !== activeSemester.code.toLowerCase()
                      ? `${activeSemester.code} - ${activeSemester.name}`
                      : activeSemester.code)
                    : (studentSemesterCode || 'Chưa xếp kỳ')}
                </strong>
              </span>
            </div>
            {account?.student && (
              <button
                type="button"
                className="groups-context-pill core-btn"
                onClick={() => setShowCoreModal(true)}
                title="Xem & chọn thế mạnh chuyên môn (Core) của bạn"
              >
                <Sparkles size={14} color="var(--primary)" />
                <span>
                  Core cá nhân:{' '}
                  <strong style={{ color: 'var(--text-main)' }}>
                    {account.student.strengthRoles?.length
                      ? account.student.strengthRoles.map(getTeamRoleLabel).join(', ')
                      : 'Chưa chọn'}
                  </strong>
                </span>
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Single-Row List Filter Tabs + Right Search Bar ── */}
      <div className="groups-toolbar">
        <div className="filter-tab-bar" style={{ margin: 0, flexWrap: 'wrap' }}>
          <button
            className={`tab-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => {
              setFilter('all')
              setCurrentPage(1)
            }}
          >
            Tất cả ({groups.length})
          </button>
          <button
            className={`tab-btn ${filter === 'recruiting' ? 'active' : ''}`}
            onClick={() => {
              setFilter('recruiting')
              setCurrentPage(1)
            }}
          >
            Đang tuyển ({groups.filter((g) => g.statusType === 'recruiting').length})
          </button>
          <button
            className={`tab-btn ${filter === 'full' ? 'active' : ''}`}
            onClick={() => {
              setFilter('full')
              setCurrentPage(1)
            }}
          >
            Đã chốt / Đủ người ({groups.filter((g) => g.statusType === 'full').length})
          </button>
          {isStudent && myRoles.length > 0 && (
            <button
              className={`tab-btn ${filter === 'matching' ? 'active' : ''}`}
              onClick={() => {
                setFilter('matching')
                setCurrentPage(1)
              }}
            >
              Phù hợp Core ({matchingGroupsCount})
            </button>
          )}
        </div>

        <div className="groups-toolbar-search">
          <div className="groups-search-wrap">
            <Search size={15} className="groups-search-icon" />
            <input
              type="text"
              className="input input-sm"
              placeholder="Tìm nhóm, đề tài, MSSV, thành viên..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>

          {isAdmin && (
            <div ref={adminMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ padding: '7px 10px' }}
                onClick={() => setShowAdminMenu((prev) => !prev)}
                disabled={busy || !semesterCode}
                aria-expanded={showAdminMenu}
                aria-haspopup="menu"
                aria-label="Tác vụ quản trị nhóm"
                title="Tác vụ quản trị nhóm"
              >
                <MoreVertical size={16} />
              </button>

              {showAdminMenu && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 6px)',
                    minWidth: 260,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    padding: 6,
                    zIndex: 35
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '6px 10px 4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Quản trị kỳ {semesterCode}
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowAdminMenu(false)
                      handleDeleteUnlockedGroups()
                    }}
                    disabled={busy || groups.filter((g) => !g.isLocked).length === 0}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '9px 10px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: 'transparent',
                      color: groups.filter((g) => !g.isLocked).length === 0 ? 'var(--text-muted)' : 'var(--error)',
                      cursor: groups.filter((g) => !g.isLocked).length === 0 ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                      fontSize: 13
                    }}
                  >
                    <Trash2 size={15} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>Xóa nhóm chưa khóa</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {groups.filter((g) => !g.isLocked).length} nhóm đang mở · giữ nguyên {groups.filter((g) => g.isLocked).length} nhóm Locked
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Group Cards Grid ── */}
      <div className="groups-grid">
        {pagedGroups.map((group) => {
          const isFull = group.statusType === 'full'
          const isInGroup = group.members.some((m) => m.studentId === currentStudentId)
          const roleAnalysis = analyzeGroupRoles(group, myRoles, isStudent, currentStudentId)
          const showFitBadge = isStudent && !isInGroup && roleAnalysis.isRecruiting && roleAnalysis.fit
          const hasRealDescription = Boolean(group.projectDescription && group.projectDescription !== 'Chưa có mô tả dự án.')
          const capacityPercent = Math.min(100, Math.round((group.members.length / group.maxMembers) * 100))

          return (
            <div className="group-clean-card" key={group.id} style={{ borderColor: isInGroup ? 'var(--primary)' : undefined }}>
              {/* Line 1: Title + Semantic Badges (left) & Capacity Mini Meter (right) */}
              <div className="group-card-head">
                <div className="group-head-main">
                  <h2 className="group-title">{group.name}</h2>
                  {isInGroup && (
                    <span className="badge badge-green" style={{ fontSize: 10.5 }}>Nhóm của bạn</span>
                  )}
                  {group.isLocked ? (
                    <span className="badge badge-teal" style={{ fontSize: 10.5 }}>
                      <Lock size={11} /> Đã chốt
                    </span>
                  ) : isFull ? (
                    <span className="badge badge-teal" style={{ fontSize: 10.5 }}>
                      <CheckCircle2 size={11} /> Đủ người
                    </span>
                  ) : (
                    <span className="badge badge-warning" style={{ fontSize: 10.5 }}>
                      <Users size={11} /> Cần {roleAnalysis.openSlots} TV
                    </span>
                  )}
                  {showFitBadge && (roleAnalysis.fit.status === 'match' || roleAnalysis.fit.status === 'complement') && (
                    <span className="badge badge-green" style={{ fontSize: 10.5 }} title={roleAnalysis.fit.detail}>
                      ✓ {roleAnalysis.fit.label}
                    </span>
                  )}
                </div>

                <div className="group-capacity-pill" title={`${group.members.length}/${group.maxMembers} thành viên`}>
                  <span className="group-capacity-text">{group.members.length}/{group.maxMembers}</span>
                  <div className="group-capacity-track">
                    <div
                      className={`group-capacity-fill ${roleAnalysis.isRecruiting ? 'recruiting' : ''}`}
                      style={{ width: `${capacityPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Line 2: Topic with explicit label */}
              <p className="group-card-topic">
                <span className="group-card-meta-label">Đề tài: </span>
                <strong style={{ fontWeight: 600 }}>{group.topic}</strong>
              </p>

              {/* Line 3: Compact 2-line project description */}
              {hasRealDescription && (
                <p className="group-card-desc">{group.projectDescription}</p>
              )}

              {/* Role Breakdown: Full box for Recruiting groups, ultra-compact covered row for Closed/Full groups */}
              {roleAnalysis.isRecruiting ? (
                <div className="group-card-roles">
                  <div className="group-role-row">
                    <span className="group-role-row-label">Đang có:</span>
                    {roleAnalysis.coveredEntries.length > 0 ? (
                      roleAnalysis.coveredEntries.map((item) => (
                        <span
                          className="group-role-chip covered"
                          key={item.code}
                          title={`${item.count} thành viên có role ${item.label}`}
                        >
                          {item.label}{item.count > 1 ? ` ×${item.count}` : ''}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Chưa có thành viên chọn Core</span>
                    )}
                  </div>

                  <div className="group-role-row">
                    <span className="group-role-row-label">Cần tuyển:</span>
                    {roleAnalysis.explicitNeeds.length > 0 ? (
                      roleAnalysis.explicitNeeds.map((need) => {
                        const isMatch = isStudent && myRoles.includes(need.roleCode)
                        return (
                          <span
                            className={`group-role-chip ${isMatch ? 'matched' : ''}`}
                            key={need.roleCode}
                            style={!isMatch ? { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' } : undefined}
                            title={isMatch ? 'Phù hợp với Core của bạn' : undefined}
                          >
                            {isMatch ? '✓ ' : ''}{getTeamRoleLabel(need.roleCode)} · {need.slots}
                          </span>
                        )
                      })
                    ) : (
                      <>
                        {roleAnalysis.missingStandardRoles.slice(0, 3).map((opt) => {
                          const isMatch = isStudent && myRoles.includes(opt.code)
                          return (
                            <span
                              className={`group-role-chip ${isMatch ? 'matched' : 'missing'}`}
                              key={opt.code}
                              title={isMatch ? 'Nhóm chưa có role này & khớp Core bạn' : 'Nhóm chưa có role này'}
                            >
                              {isMatch ? '✓ ' : ''}{opt.label}
                            </span>
                          )
                        })}
                        {roleAnalysis.missingStandardRoles.length > 3 && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            +{roleAnalysis.missingStandardRoles.length - 3} role chưa có
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {showFitBadge && roleAnalysis.fit.status === 'mismatch' && (
                    <div style={{ fontSize: 11, color: '#92400E', marginTop: 2 }}>
                      {roleAnalysis.fit.detail}
                    </div>
                  )}
                </div>
              ) : (
                <div className="group-skills-closed-row">
                  <span className="group-role-row-label">Role hiện có:</span>
                  {roleAnalysis.coveredEntries.length > 0 ? (
                    roleAnalysis.coveredEntries.map((item) => (
                      <span
                        className="group-role-chip covered"
                        key={item.code}
                        title={`${item.count} thành viên có role ${item.label}`}
                      >
                        {item.label}{item.count > 1 ? ` ×${item.count}` : ''}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Chưa có thành viên chọn Core</span>
                  )}
                </div>
              )}

              {/* Compact Overlapping Avatar Stack */}
              <div className="group-members-row">
                <div className="member-avatar-stack">
                  {group.members.map((m, idx) => {
                    const memberAvatar = m.avatarUrl || (m.studentId === currentStudentId ? (account?.avatarUrl || account?.googlePictureUrl) : '')
                    const memberRoles = m.studentId === currentStudentId && isStudent ? myRoles : (m.strengthRoles || [])
                    const memberRoleText = memberRoles.length ? ` · Core: ${memberRoles.map(getTeamRoleLabel).join(', ')}` : ''
                    return (
                      <span
                        key={m.studentId || idx}
                        className={`member-stack-item ${m.isLeader ? 'leader' : ''}`}
                        style={{ zIndex: m.isLeader ? 10 : Math.max(1, group.members.length - idx) }}
                        title={`${m.name} (${m.role})${memberRoleText}`}
                      >
                        <MemberAvatar src={memberAvatar} name={m.name} size={30} />
                        {m.isLeader && (
                          <span className="member-stack-crown" aria-label="Trưởng nhóm">
                            <Crown size={9} />
                          </span>
                        )}
                      </span>
                    )
                  })}
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {group.members.length} thành viên
                </span>
              </div>

              <div className="group-card-footer-meta">
                <span>Trưởng nhóm: <strong style={{ color: 'var(--text-main)' }}>{group.leader}</strong></span>
                <span className="badge badge-neutral" style={{ fontSize: 11 }}>Kỳ: {group.semesterCode}</span>
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

                {isStudent && !currentStudentGroup && !isInGroup && !isFull && !group.isLocked && (
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

      {filteredGroups.length > GROUPS_PER_PAGE && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-4)',
            borderTop: '1px solid var(--border-default)'
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Hiển thị {(safePage - 1) * GROUPS_PER_PAGE + 1}–{Math.min(safePage * GROUPS_PER_PAGE, filteredGroups.length)} / {filteredGroups.length} nhóm
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Trang trước
            </button>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', padding: '0 6px' }}>
              Trang {safePage} / {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Trang sau
            </button>
          </div>
        </div>
      )}

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
                      const maxNeeds = Math.min(4, Math.max(0, 5 - (selectedGroup.members?.length || 0)))
                      setEditGroupName(selectedGroup.name)
                      setEditGroupTopic(selectedGroup.topicTitle || '')
                      setEditGroupDescription(selectedGroup.projectDescription || '')
                      setEditRecruitmentNeeds((selectedGroup.recruitmentNeeds || []).map((n) => n.roleCode).slice(0, maxNeeds))
                      setEditNeedsDirty(false)
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

              {(() => {
                const detailRoles = analyzeGroupRoles(selectedGroup, myRoles, isStudent, currentStudentId)
                const viewerInGroup = selectedGroup.members.some((m) => m.studentId === currentStudentId)
                return (
                  <div style={{ borderTop: '1px solid var(--border-default)', marginTop: 12, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {isStudent && detailRoles.fit && (!viewerInGroup || detailRoles.fit.status === 'no-core') && (
                      <div className={`group-fit-banner ${
                        detailRoles.fit.status === 'match' || detailRoles.fit.status === 'complement'
                          ? 'match'
                          : detailRoles.fit.status === 'mismatch' || detailRoles.fit.status === 'no-core'
                            ? 'mismatch'
                            : ''
                      }`} style={{ marginBottom: 2 }}>
                        <div>
                          <strong style={{ display: 'block', marginBottom: 2 }}>
                            {detailRoles.fit.status === 'match' || detailRoles.fit.status === 'complement'
                              ? `✓ ${detailRoles.fit.label} với bạn`
                              : detailRoles.fit.label}
                          </strong>
                          <span>{detailRoles.fit.detail}</span>
                        </div>
                        {detailRoles.fit.status === 'no-core' && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setShowCoreModal(true)}
                          >
                            Chọn Core ngay
                          </button>
                        )}
                      </div>
                    )}

                    <div className="group-role-row">
                      <span className="group-role-row-label">Role hiện có trong nhóm:</span>
                      {detailRoles.coveredEntries.length > 0 ? (
                        detailRoles.coveredEntries.map((item) => (
                          <span className="group-role-chip covered" key={item.code}>
                            {item.label}{item.count > 1 ? ` ×${item.count}` : ''}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Chưa có thành viên nào chọn Core</span>
                      )}
                    </div>

                    {detailRoles.isRecruiting && detailRoles.explicitNeeds.length > 0 && (
                      <div className="group-role-row">
                        <span className="group-role-row-label">Vị trí đang cần tuyển:</span>
                        {detailRoles.explicitNeeds.map((need) => {
                          const isMatch = isStudent && myRoles.includes(need.roleCode)
                          return (
                            <span
                              className={`group-role-chip ${isMatch ? 'matched' : ''}`}
                              key={need.roleCode}
                              style={!isMatch ? { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' } : undefined}
                            >
                              {isMatch ? '✓ Khớp bạn · ' : ''}{getTeamRoleLabel(need.roleCode)} ({need.slots} chỗ)
                            </span>
                          )
                        })}
                      </div>
                    )}

                    <div className="group-role-row">
                      <span className="group-role-row-label">
                        {detailRoles.isRecruiting && detailRoles.explicitNeeds.length === 0
                          ? `Còn ${detailRoles.openSlots} chỗ · Role chưa có trong nhóm:`
                          : 'Role nhóm chưa có:'}
                      </span>
                      {detailRoles.missingStandardRoles.length > 0 ? (
                        detailRoles.missingStandardRoles.map((opt) => {
                          const isMatch = detailRoles.isRecruiting && isStudent && myRoles.includes(opt.code)
                          return (
                            <span
                              className={`group-role-chip ${isMatch ? 'matched' : 'missing'}`}
                              key={opt.code}
                              title={isMatch ? 'Nhóm chưa có role này & khớp với Core của bạn' : undefined}
                            >
                              {isMatch ? '✓ Bạn có · ' : ''}{opt.label}
                            </span>
                          )
                        })
                      ) : (
                        <span style={{ fontSize: 12, color: '#15803D', fontWeight: 600 }}>Nhóm đã phủ đầy đủ 8 role cốt lõi</span>
                      )}
                    </div>
                  </div>
                )
              })()}
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
                  const memberCoreRoles = isThisMemberMe
                    ? (account?.student?.strengthRoles ?? m.strengthRoles ?? [])
                    : (m.strengthRoles ?? [])

                  return (
                    <div
                      key={m.studentId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '10px 12px',
                        backgroundColor: m.isLeader ? '#F0FDF4' : 'var(--bg-subtle)',
                        border: m.isLeader ? '1px solid #BBF7D0' : '1px solid transparent',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
                        <MemberAvatar
                          src={m.avatarUrl || (isThisMemberMe ? (account?.avatarUrl || account?.googlePictureUrl) : '')}
                          name={m.name}
                          size={28}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 13, color: 'var(--text-main)' }}>{m.name}</strong>
                            {isThisMemberMe && <span className="badge badge-neutral" style={{ fontSize: 10 }}>Bạn</span>}
                            {m.studentId === selectedGroup.firstMemberId && !m.isDemo && (
                              <span className="badge badge-neutral" style={{ fontSize: 10 }}>Người tạo / Đầu nhóm</span>
                            )}
                            {m.isDemo && <span className="badge badge-neutral" style={{ fontSize: 10 }}>DEMO</span>}
                            {m.isLeader && (
                              <span className="badge badge-warning" style={{ fontSize: 10 }}>
                                <Crown size={11} /> Leader
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'block' }}>
                            {memberEmail ? `${memberEmail} · ${m.studentCode}` : m.studentCode}
                            {m.major && m.major !== m.studentCode ? ` · ${m.major}` : ''}
                          </span>
                          {!m.isDemo && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
                              {memberCoreRoles.length > 0 ? (
                                memberCoreRoles.map((code) => (
                                  <span key={code} className="group-role-chip covered" style={{ fontSize: 10.5, padding: '1px 7px' }}>
                                    {getTeamRoleLabel(code)}
                                  </span>
                                ))
                              ) : isThisMemberMe ? (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  style={{ fontSize: 11, padding: '1px 7px', color: 'var(--primary)', border: '1px dashed var(--primary-border)' }}
                                  onClick={() => setShowCoreModal(true)}
                                >
                                  + Chọn Core của bạn
                                </button>
                              ) : (
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Chưa chọn role</span>
                              )}
                            </div>
                          )}
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

                        {/* Kick Button (Admin or first member of group for later members) */}
                        {!selectedGroup.isLocked &&
                          (isAdmin || (selectedGroup.firstMemberId === currentStudentId && m.studentId !== currentStudentId)) && (
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              <MemberAvatar src={cand.avatarUrl} name={cand.fullName} size={26} />
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
                {/* Delete Group (Open group only: Admin or creator) */}
                {!selectedGroup.isLocked && (isAdmin || selectedGroup.firstMemberId === currentStudentId) && (
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

                {/* Unlock Group (Leader or Admin) */}
                {(isAdmin || selectedGroup.leaderStudentId === currentStudentId) && selectedGroup.isLocked && (
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={busy}
                    onClick={() => handleUnlockGroup(selectedGroup)}
                    title="Gỡ khóa để cho phép chỉnh sửa thành viên"
                  >
                    <Unlock size={13} /> Gỡ khóa nhóm
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

                {/* Join Group Button if Student has no group yet and group is Open */}
                {isStudent && !currentStudentGroup && !selectedGroup.members.some((m) => m.studentId === currentStudentId) &&
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
                  minLength={2}
                  maxLength={1200}
                  rows={3}
                  className="textarea"
                  value={editGroupDescription}
                  onChange={(e) => setEditGroupDescription(e.target.value)}
                />
              </div>

              {!selectedGroup?.isLocked && 5 - (selectedGroup?.members?.length || 0) > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <label className="input-label">
                    Đang cần tuyển role nào?{' '}
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                      (tối đa {Math.min(4, 5 - (selectedGroup?.members?.length || 0))} vị trí)
                    </span>
                  </label>
                  <div role="group" aria-label="Cập nhật role nhóm đang cần tuyển" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {TEAM_ROLE_OPTIONS.map((role) => {
                      const selected = editRecruitmentNeeds.includes(role.code)
                      const maxNeeds = Math.min(4, 5 - (selectedGroup?.members?.length || 0))
                      return (
                        <button
                          key={role.code}
                          type="button"
                          aria-pressed={selected}
                          className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => {
                            setEditNeedsDirty(true)
                            setEditRecruitmentNeeds((prev) => {
                              if (selected) return prev.filter((item) => item !== role.code)
                              const clamped = prev.slice(0, maxNeeds)
                              if (clamped.length >= maxNeeds) {
                                toast.error(`Nhóm chỉ còn tối đa ${maxNeeds} chỗ trống.`)
                                return clamped
                              }
                              return [...clamped, role.code]
                            })
                          }}
                        >
                          {role.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

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
                  minLength={2}
                  maxLength={120}
                  className="input"
                  placeholder="Ví dụ: AI HealthTech Core"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label className="input-label">Mô tả tóm tắt đề tài khởi nghiệp</label>
                <textarea
                  maxLength={1200}
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
                  {TEAM_ROLE_OPTIONS.map((role) => {
                    const selected = newRecruitmentNeeds.includes(role.code)
                    return <button key={role.code} type="button" aria-pressed={selected} className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-outline'}`} onClick={() => setNewRecruitmentNeeds((roles) => selected ? roles.filter((item) => item !== role.code) : roles.length < 4 ? [...roles, role.code] : roles)}>{role.label}</button>
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

      {showCoreModal && (
        <StudentCoreModal
          onClose={() => setShowCoreModal(false)}
          onSaved={() => loadGroups()}
        />
      )}

      <ConfirmModal
        open={Boolean(confirmState)}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        tone={confirmState?.tone}
        busy={busy || seedingDemoMembers}
        onConfirm={() => confirmState?.onConfirm?.()}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  )
}
