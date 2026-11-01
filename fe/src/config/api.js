
const rawUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

export const API_BASE_URL = rawUrl.replace(/\/+$/, '')

export default API_BASE_URL
