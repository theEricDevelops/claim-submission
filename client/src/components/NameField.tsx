interface NameFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}

export default function NameField({
  label,
  value,
  onChange,
  required,
  placeholder,
}: NameFieldProps) {
  return (
    <div className="field">
      <label>{label}{required ? " *" : ""}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}
