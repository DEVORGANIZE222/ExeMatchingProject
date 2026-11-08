
// An empty value keeps requests same-origin. Vite and the production frontend
// nginx proxy /api to the Docker services, avoiding browser CORS concerns.
const rawUrl = import.meta.env.VITE_API_BASE_URL || ''

export const API_BASE_URL = rawUrl.replace(/\/+$/, '')

export default API_BASE_URL
