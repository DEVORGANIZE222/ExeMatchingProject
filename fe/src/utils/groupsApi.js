export async function fetchAllGroupsBySemester(request, semesterCode, pageSize = 500) {
  let page = 1
  let totalCount = 0
  const items = []

  while (true) {
    const result = await request(
      `/api/groups?semesterCode=${encodeURIComponent(semesterCode)}&page=${page}&pageSize=${pageSize}`
    )
    const pageItems = result?.items || []
    items.push(...pageItems)
    totalCount = result?.totalCount ?? items.length
    if (pageItems.length === 0 || items.length >= totalCount) break
    page += 1
  }

  return { items, totalCount }
}

