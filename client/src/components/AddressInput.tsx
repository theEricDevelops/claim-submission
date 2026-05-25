import { useState } from "react";
import { type AddressValue, US_STATES } from "../types";

interface AddressInputProps {
  label: string;
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  required?: boolean;
}

export default function AddressInput({
  label,
  value,
  onChange,
  required,
}: AddressInputProps) {
  const [manual, setManual] = useState(false);

  function handleFormattedChange(formatted: string) {
    onChange({ ...value, formatted });
  }

  function handleFieldChange(
    field: "street" | "city" | "state" | "zip",
    val: string
  ) {
    const updated = { ...value, [field]: val };
    updated.formatted = `${updated.street}, ${updated.city}, ${updated.state} ${updated.zip}`.trim();
    if (!updated.street && !updated.city && !updated.state && !updated.zip) {
      updated.formatted = "";
    }
    onChange(updated);
  }

  function toggleToManual() {
    setManual(true);
    if (value.formatted && !value.street) {
      const parts = value.formatted.split(",").map((s) => s.trim());
      const street = parts[0] || "";
      const city = parts[1] || "";
      const rest = (parts[2] || "").split(/\s+/);
      const state = rest[0] || "";
      const zip = rest.slice(1).join(" ") || "";
      onChange({ formatted: value.formatted, street, city, state, zip });
    }
  }

  function toggleToAuto() {
    setManual(false);
  }

  if (manual) {
    return (
      <div className="field-group">
        <label className="field-group-label">{label}{required ? " *" : ""}</label>
        <div className="field">
          <label>Street Address</label>
          <input
            value={value.street}
            onChange={(e) => handleFieldChange("street", e.target.value)}
            required={required}
          />
        </div>
        <div className="field-row">
          <div className="field field-wide">
            <label>City</label>
            <input
              value={value.city}
              onChange={(e) => handleFieldChange("city", e.target.value)}
              required={required}
            />
          </div>
          <div className="field field-narrow">
            <label>State</label>
            <select
              value={value.state}
              onChange={(e) => handleFieldChange("state", e.target.value)}
              required={required}
            >
              <option value="">--</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field field-narrow">
            <label>ZIP</label>
            <input
              value={value.zip}
              onChange={(e) => handleFieldChange("zip", e.target.value)}
              required={required}
            />
          </div>
        </div>
        <button type="button" className="link-btn" onClick={toggleToAuto}>
          Use address lookup instead.
        </button>
      </div>
    );
  }

  return (
    <div className="field-group">
      <div className="field">
        <label>{label}{required ? " *" : ""}</label>
        <input
          value={value.formatted}
          onChange={(e) => handleFormattedChange(e.target.value)}
          placeholder="Start typing an address..."
          required={required}
        />
      </div>
      <button type="button" className="link-btn" onClick={toggleToManual}>
        Enter address manually.
      </button>
    </div>
  );
}
