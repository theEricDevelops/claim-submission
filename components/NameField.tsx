'use client'

import { useId, useState } from 'react'

interface NameFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  placeholder?: string
  maxLength?: number
  showError?: boolean
}

export default function NameField({
  label,
  value,
  onChange,
  required,
  placeholder,
  maxLength,
  showError,
}: NameFieldProps) {
  const [blurred, setBlurred] = useState(false)
  const id = useId()
  const showErr = (showError || blurred) && required && !value.trim()

  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setBlurred(true)}
        onFocus={() => setBlurred(false)}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        className={showErr ? 'field-error' : ''}
      />
      {showErr && <div className="field-error-msg">{label} is required</div>}
    </div>
  )
}
