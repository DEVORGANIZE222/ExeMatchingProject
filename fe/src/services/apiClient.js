import { API_BASE_URL } from '../config/api'

/**
 * ApiClient - HTTP Service Layer tương tự HttpClient trong C# / .NET.
 * Tự động gắn Token Authorization: Bearer, parse JSON và format lỗi tập trung.
 */
class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl
  }

  /**
   * Tạo headers mặc định kèm JWT token từ localStorage
   */
  getHeaders(customHeaders = {}) {
    const token = localStorage.getItem('exe_access_token')
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...customHeaders
    }
  }

  /**
   * Phương thức fetch cốt lõi (Core Request Handler)
   */
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`
    const isFormData = options.body instanceof FormData

    const token = localStorage.getItem('exe_access_token')
    const headers = isFormData
      ? {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers || {})
        }
      : this.getHeaders(options.headers)

    const response = await fetch(url, {
      ...options,
      headers
    })

    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      const errorMsg = body?.message || `Yêu cầu thất bại (HTTP ${response.status})`
      const error = new Error(errorMsg)
      error.status = response.status
      error.data = body
      throw error
    }

    return body.data !== undefined ? body.data : body
  }

  /**
   * GET Request
   */
  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' })
  }

  /**
   * POST Request (Tự động serialize JSON hoặc truyền nguyên FormData)
   */
  post(endpoint, data, options = {}) {
    const isFormData = data instanceof FormData
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: isFormData ? data : JSON.stringify(data)
    })
  }

  /**
   * PUT Request
   */
  put(endpoint, data, options = {}) {
    const isFormData = data instanceof FormData
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: isFormData ? data : JSON.stringify(data)
    })
  }

  /**
   * DELETE Request
   */
  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' })
  }
}

export const apiClient = new ApiClient(API_BASE_URL)
export default apiClient
