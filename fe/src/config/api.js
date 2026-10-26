
const localUrl = import.meta.env.VITE_API_BASE_URL_LOCAL || 'http://localhost:8080'
const prodUrl = import.meta.env.VITE_API_BASE_URL_PROD


const rawBaseUrl = import.meta.env.PROD && prodUrl
  ? prodUrl
  : (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE_URL_LOCAL || localUrl)

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '')

export default API_BASE_URL
