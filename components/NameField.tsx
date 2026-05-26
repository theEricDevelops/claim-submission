"use client";

import { useState } from "react";

interface NameFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  showError?: boolean;
}

export default function NameField({
  label,
  value,
  onChange,
  required,
  placeholder,
  showError,
}: NameFieldProps) {
  const [blurred, setBlurred] = useState(false);
  const showErr = (showError || blurred) && required && !value.trim();

  return (
    <div className="field">
      <label>{label}{required ? " *" : ""}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setBlurred(true)}
        onFocus={() => setBlurred(false)}
        required={required}
        placeholder={placeholder}
        className={showErr ? "field-error" : ""}
      />
      {showErr && <div className="field-error-msg">{label} is required</div>}
    </div>
  );
}
