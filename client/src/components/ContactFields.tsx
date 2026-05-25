interface ContactFieldsProps {
  phone: string;
  email: string;
  onPhoneChange: (value: string) => void;
  onEmailChange: (value: string) => void;
}

export default function ContactFields({
  phone,
  email,
  onPhoneChange,
  onEmailChange,
}: ContactFieldsProps) {
  return (
    <div className="field-row">
      <div className="field">
        <label>Phone *</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label>Email *</label>
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
        />
      </div>
    </div>
  );
}
