"use client";

import { useState } from "react";
import { isValidPhone, isValidEmail } from "@/types";

interface ContactFieldsProps {
  phone: string;
  email: string;
  onPhoneChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  showErrors?: boolean;
}

export default function ContactFields({
  phone,
  email,
  onPhoneChange,
  onEmailChange,
  showErrors,
}: ContactFieldsProps) {
  const [phoneBlurred, setPhoneBlurred] = useState(false);
  const [emailBlurred, setEmailBlurred] = useState(false);

  const touchedPhone = showErrors || phoneBlurred;
  const touchedEmail = showErrors || emailBlurred;
  const phoneError = touchedPhone && !isValidPhone(phone);
  const emailError = touchedEmail && !isValidEmail(email);

  return (
    <div className="field-row">
      <div className="field">
        <label>Phone *</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          onBlur={() => setPhoneBlurred(true)}
          onFocus={() => setPhoneBlurred(false)}
          pattern="[\d\s().+-]{10,}"
          title="Enter a valid 10-digit US phone number"
          required
          className={phoneError ? "field-error" : ""}
        />
        {phoneError && <div className="field-error-msg">Enter a valid 10-digit US phone number</div>}
      </div>
      <div className="field">
        <label>Email *</label>
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          onBlur={() => setEmailBlurred(true)}
          onFocus={() => setEmailBlurred(false)}
          required
          pattern="[^\s@]+@[^\s@]+\.[^\s@]{2,}"
          title="Enter a valid email address (e.g. name@domain.com)"
          className={emailError ? "field-error" : ""}
        />
        {emailError && <div className="field-error-msg">Enter a valid email address (e.g. name@domain.com)</div>}
      </div>
    </div>
  );
}
