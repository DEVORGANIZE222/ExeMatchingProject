import { useState, useRef, useEffect, useCallback } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react'
import './DatePicker.css'

const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
  'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
  'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
]

const WEEKDAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function parseIso(str) {
  if (!str) return null
  const parts = str.split('-')
  if (parts.length !== 3) return null
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10) - 1
  const d = parseInt(parts[2], 10)
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null
  return new Date(y, m, d)
}

function toIsoString(date) {
  if (!date || isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toDisplayString(isoStr) {
  if (!isoStr) return ''
  const parts = isoStr.split('-')
  if (parts.length !== 3) return ''
  return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`
}

function parseDisplayString(displayStr) {
  if (!displayStr) return null
  const parts = displayStr.trim().split('/')
  if (parts.length !== 3) return null
  const d = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10) - 1
  const y = parseInt(parts[2], 10)
  if (isNaN(d) || isNaN(m) || isNaN(y) || y < 1900 || y > 2100 || m < 0 || m > 11) return null
  const date = new Date(y, m, d)
  if (date.getFullYear() !== y || date.getMonth() !== m || date.getDate() !== d) return null
  return date
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
  required = false,
  disabled = false,
  className = '',
  minDate,
  maxDate
}) {
  const [open, setOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const [text, setText] = useState(() => toDisplayString(value))
  const containerRef = useRef(null)

  // Detect available space and decide whether to open upward or downward
  const updatePosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      // Popover needs ~280px. If space below is not enough and space above is larger, flip upward
      if (spaceBelow < 290 && spaceAbove > 280) {
        setOpenUpward(true)
      } else {
        setOpenUpward(false)
      }
    }
  }, [])

  const handleOpen = () => {
    if (disabled) return
    updatePosition()
    setOpen(true)
  }

  const handleToggle = () => {
    if (disabled) return
    if (!open) {
      updatePosition()
      setOpen(true)
    } else {
      setOpen(false)
    }
  }

  // Current view year & month for calendar popover
  const initialDate = parseIso(value) || new Date()
  const [viewYear, setViewYear] = useState(initialDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth())

  // Keep text input in sync if value prop changes externally
  useEffect(() => {
    setText(toDisplayString(value))
    const parsed = parseIso(value)
    if (parsed) {
      setViewYear(parsed.getFullYear())
      setViewMonth(parsed.getMonth())
    }
  }, [value])

  // Close calendar popover on outside click or reposition on window scroll/resize
  useEffect(() => {
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const handleScrollOrResize = () => {
      if (open) updatePosition()
    }

    if (open) {
      document.addEventListener('mousedown', handleOutside)
      window.addEventListener('scroll', handleScrollOrResize, true)
      window.addEventListener('resize', handleScrollOrResize)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [open, updatePosition])

  // Handle direct text editing (auto-insert slash and validate)
  const handleTextChange = (e) => {
    let input = e.target.value.replace(/[^\d/]/g, '')
    if (input.length === 2 && !input.includes('/')) {
      input = input + '/'
    } else if (input.length === 5 && input.split('/').length === 2) {
      input = input + '/'
    }
    if (input.length > 10) input = input.slice(0, 10)
    setText(input)

    if (input.length === 10) {
      const parsed = parseDisplayString(input)
      if (parsed) {
        const iso = toIsoString(parsed)
        onChange(iso)
        setViewYear(parsed.getFullYear())
        setViewMonth(parsed.getMonth())
      }
    } else if (input === '') {
      onChange('')
    }
  }

  const handleTextBlur = () => {
    if (!text) {
      onChange('')
      return
    }
    const parsed = parseDisplayString(text)
    if (parsed) {
      const iso = toIsoString(parsed)
      onChange(iso)
      setText(toDisplayString(iso))
    } else {
      // Revert to current valid value if invalid input
      setText(toDisplayString(value))
    }
  }

  // Select day from calendar
  const handleSelectDay = (year, month, day) => {
    const chosen = new Date(year, month, day)
    const iso = toIsoString(chosen)
    onChange(iso)
    setText(toDisplayString(iso))
    setOpen(false)
  }

  // Prev / Next month
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  // Generate calendar days grid (Monday first)
  const getDaysArray = useCallback(() => {
    const days = []
    const firstDay = new Date(viewYear, viewMonth, 1)
    let startDayOfWeek = firstDay.getDay() // 0 = Sun, 1 = Mon...
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1 // Make Mon = 0, Sun = 6

    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

    // Trailing days from previous month
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        month: viewMonth === 0 ? 11 : viewMonth - 1,
        year: viewMonth === 0 ? viewYear - 1 : viewYear,
        otherMonth: true
      })
    }

    // Days in current month
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      days.push({
        day: i,
        month: viewMonth,
        year: viewYear,
        otherMonth: false
      })
    }

    // Days in next month to complete the 35 or 42 grid
    const remaining = (7 - (days.length % 7)) % 7
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        month: viewMonth === 11 ? 0 : viewMonth + 1,
        year: viewMonth === 11 ? viewYear + 1 : viewYear,
        otherMonth: true
      })
    }

    return days
  }, [viewMonth, viewYear])

  const daysGrid = getDaysArray()
  const today = new Date()
  const selectedDate = parseIso(value)

  // Generate year options around current year (current - 5 to current + 10)
  const currentYear = new Date().getFullYear()
  const yearOptions = []
  for (let y = currentYear - 5; y <= currentYear + 10; y++) {
    yearOptions.push(y)
  }

  return (
    <div className={`custom-datepicker-container ${className}`} ref={containerRef}>
      <div className="custom-datepicker-input-wrapper">
        <input
          type="text"
          className="custom-datepicker-input"
          placeholder={placeholder}
          value={text}
          required={required}
          disabled={disabled}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          onClick={handleOpen}
        />
        <button
          type="button"
          tabIndex={-1}
          className="custom-datepicker-icon-btn"
          disabled={disabled}
          onClick={handleToggle}
          title="Chọn ngày"
        >
          <CalendarIcon size={16} />
        </button>
      </div>

      {open && (
        <div className={`custom-datepicker-popover ${openUpward ? 'open-upward' : ''}`}>
          {/* Header Month / Year Navigation */}
          <div className="datepicker-header">
            <button
              type="button"
              className="datepicker-nav-btn"
              onClick={handlePrevMonth}
              title="Tháng trước"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="datepicker-month-year">
              <select
                className="datepicker-select-month"
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
              >
                {MONTH_NAMES.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                className="datepicker-select-year"
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="datepicker-nav-btn"
              onClick={handleNextMonth}
              title="Tháng sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday labels */}
          <div className="datepicker-weekdays">
            {WEEKDAY_NAMES.map((name) => (
              <span key={name} className="datepicker-weekday-label">
                {name}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="datepicker-days-grid">
            {daysGrid.map((item, index) => {
              const isSelected =
                selectedDate &&
                selectedDate.getFullYear() === item.year &&
                selectedDate.getMonth() === item.month &&
                selectedDate.getDate() === item.day

              const isToday =
                today.getFullYear() === item.year &&
                today.getMonth() === item.month &&
                today.getDate() === item.day

              return (
                <button
                  key={index}
                  type="button"
                  className={`datepicker-day-cell ${item.otherMonth ? 'other-month' : ''} ${
                    isToday ? 'is-today' : ''
                  } ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => handleSelectDay(item.year, item.month, item.day)}
                >
                  {item.day}
                </button>
              )
            })}
          </div>

          {/* Footer Quick Actions */}
          <div className="datepicker-footer">
            <button
              type="button"
              className="datepicker-quick-btn"
              onClick={() => {
                const now = new Date()
                handleSelectDay(now.getFullYear(), now.getMonth(), now.getDate())
              }}
            >
              Hôm nay
            </button>

            <div style={{ display: 'flex', gap: 6 }}>
              {value && (
                <button
                  type="button"
                  className="datepicker-quick-btn text-muted"
                  onClick={() => {
                    onChange('')
                    setText('')
                    setOpen(false)
                  }}
                >
                  Xóa
                </button>
              )}
              <button
                type="button"
                className="datepicker-quick-btn text-muted"
                onClick={() => setOpen(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

