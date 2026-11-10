import { API_BASE_URL as apiBase } from '../config/api'

export function uploadFormDataWithProgress(path, formData, token, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${apiBase}${path}`, true)
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }

    xhr.upload.onprogress = (event) => {
      if (!onProgress) return
      if (event.lengthComputable && event.total > 0) {
        const uploadRatio = event.loaded / event.total
        const percent = Math.min(90, Math.max(5, Math.round(uploadRatio * 90)))
        const loadedKb = Math.max(1, Math.round(event.loaded / 1024))
        const totalKb = Math.max(1, Math.round(event.total / 1024))
        onProgress({
          phase: 'uploading',
          percent,
          label: 'Đang tải tệp Excel lên máy chủ...',
          detail: `Đã gửi ${loadedKb} KB / ${totalKb} KB`
        })
      } else {
        onProgress({
          phase: 'uploading',
          percent: 45,
          label: 'Đang tải tệp Excel lên máy chủ...',
          detail: 'Đang truyền dữ liệu lên hệ thống...'
        })
      }
    }

    xhr.upload.onload = () => {
      if (!onProgress) return
      onProgress({
        phase: 'processing',
        percent: 95,
        label: 'Hệ thống đã nhận tệp — đang kiểm tra & lưu dữ liệu...',
        detail: 'Với danh sách lớn (1.000+ dòng), bước này có thể mất vài chục giây.'
      })
    }

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return
      let body = {}
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : {}
      } catch {
        body = {}
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body.data)
      } else {
        const error = new Error(body.message || `Tải lên thất bại (mã ${xhr.status || 'mạng'}).`)
        error.status = xhr.status
        reject(error)
      }
    }

    xhr.onerror = () => {
      reject(new Error('Không thể kết nối tới máy chủ khi tải tệp lên.'))
    }

    xhr.onabort = () => {
      reject(new Error('Đã hủy tải tệp lên.'))
    }

    onProgress?.({
      phase: 'uploading',
      percent: 5,
      label: 'Đang bắt đầu tải tệp lên máy chủ...',
      detail: 'Đang gửi yêu cầu đến hệ thống...'
    })
    xhr.send(formData)
  })
}

