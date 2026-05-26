"use client";

import { useState, useRef, useEffect } from "react";
import { type AddressValue, STATE_NAMES, US_STATES } from "@/types";

const STATE_NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAMES).map(([code, name]) => [name.toLowerCase(), code])
);

function parseState(state: string | undefined): string {
  if (!state) return "";
  const trimmed = state.trim();
  if ((US_STATES as readonly string[]).includes(trimmed)) return trimmed;
  return STATE_NAME_TO_CODE[trimmed.toLowerCase()] || trimmed;
}

interface GeoapifyProperties {
  formatted: string;
  street?: string;
  housenumber?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country_code: string;
}

interface GeoapifyFeature {
  properties: GeoapifyProperties;
}

interface AddressInputProps {
  label: string;
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  required?: boolean;
  showErrors?: boolean;
}

export default function AddressInput({
  label,
  value,
  onChange,
  required,
  showErrors,
}: AddressInputProps) {
  const [manual, setManual] = useState(false);
  const [blurred, setBlurred] = useState<Record<string, boolean>>({});
  const [inputText, setInputText] = useState(value.formatted || "");
  const [suggestions, setSuggestions] = useState<GeoapifyFeature[]>([]);
  const [dropdownIndex, setDropdownIndex] = useState(-1);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "verifying" | "verified" | "failed">("idle");
  const [userConfirmed, setUserConfirmed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const debounceVerifyRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  function markBlurred(field: string) {
    setBlurred((prev) => ({ ...prev, [field]: true }));
  }

  function markFocused(field: string) {
    setBlurred((prev) => ({ ...prev, [field]: false }));
  }

  function showError(field: string): boolean {
    return !!required && (showErrors || !!blurred[field]) && !value[field as keyof AddressValue];
  }

  useEffect(() => {
    setInputText(value.formatted || "");
  }, [value.formatted]);

  async function fetchPredictions(val: string) {
    if (!val.trim()) return;
    try {
      const params = new URLSearchParams({
        endpoint: "autocomplete",
        text: val,
        type: "street",
        country: "us",
        limit: "5",
      });
      const res = await fetch(`/api/geoapify?${params}`);
      const data = await res.json();
      setSuggestions(data.features || []);
      setDropdownIndex(-1);
    } catch {
      setSuggestions([]);
    }
  }

  function handleInputChange(val: string) {
    setInputText(val);
    clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => fetchPredictions(val), 200);
  }

  function selectSuggestion(feature: GeoapifyFeature) {
    setSuggestions([]);
    const p = feature.properties;
    const displayText = p.formatted || "";
    if (displayText) setInputText(displayText);

    const street = [p.housenumber, p.street].filter(Boolean).join(" ");
    const city = p.city || "";
    const state = parseState(p.state);
    const zip = p.postcode || "";

    const parts = [street];
    if (p.housenumber && p.street) {
      parts[0] = `${p.housenumber} ${p.street}`;
    }

    onChangeRef.current({
      formatted: displayText,
      street,
      street2: "",
      city,
      state,
      zip,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setDropdownIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDropdownIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && dropdownIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[dropdownIndex]);
    } else if (e.key === "Escape") {
      setSuggestions([]);
    }
  }

  function handleInputBlur() {
    if (!value.formatted) {
      markBlurred("autocomplete");
    }
    setTimeout(() => setSuggestions([]), 200);
  }

  function handleInputFocus() {
    if (inputText.trim()) {
      fetchPredictions(inputText);
    }
  }

  const showAddressError = !!required && (showErrors || !!blurred["autocomplete"]) && !value.formatted;

  async function verifyAddress(addr: AddressValue) {
    if (!addr.street || !addr.city || !addr.state || !addr.zip) return;
    setVerificationStatus("verifying");
    try {
      const query = `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`;
      const params = new URLSearchParams({
        endpoint: "search",
        text: query,
        country: "us",
        limit: "1",
      });
      const res = await fetch(`/api/geoapify?${params}`);
      const data = await res.json();
      setVerificationStatus(data.features && data.features.length > 0 ? "verified" : "failed");
    } catch {
      setVerificationStatus("failed");
    }
  }

  function handleFieldChange(
    field: "street" | "street2" | "city" | "state" | "zip",
    val: string
  ) {
    setUserConfirmed(false);
    setVerificationStatus("idle");
    const updated = { ...value, [field]: val };
    updated.formatted = `${updated.street}${updated.street2 ? `, ${updated.street2}` : ""}, ${updated.city}, ${updated.state} ${updated.zip}`.trim();
    if (!updated.street && !updated.city && !updated.state && !updated.zip) {
      updated.formatted = "";
    }
    onChange(updated);
  }

  function handleBlurWithVerify(field: "street" | "city" | "state" | "zip") {
    markBlurred(field);
    clearTimeout(debounceVerifyRef.current);
    debounceVerifyRef.current = setTimeout(() => verifyAddress(value), 300);
  }

  function toggleToManual() {
    setManual(true);
    if (value.formatted && !value.street) {
      const parts = value.formatted.split(",").map((s) => s.trim());
      const street = parts[0] || "";
      const street2 = parts[1] && parts.length >= 4 ? parts[1] : "";
      const cityIdx = street2 ? 2 : 1;
      const city = parts[cityIdx] || "";
      const rest = (parts[cityIdx + 1] || "").split(/\s+/);
      const state = rest[0] || "";
      const zip = rest.slice(1).join(" ") || "";
      onChange({ formatted: value.formatted, street, street2, city, state, zip });
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
            onBlur={() => handleBlurWithVerify("street")}
            onFocus={() => markFocused("street")}
            required={required}
            maxLength={200}
            className={showError("street") ? "field-error" : ""}
          />
          {showError("street") && <div className="field-error-msg">Street address is required</div>}
        </div>
        <div className="field">
          <label>Apt / Suite</label>
          <input
            value={value.street2}
            onChange={(e) => handleFieldChange("street2", e.target.value)}
            placeholder="Apt, suite, unit, etc."
            maxLength={200}
          />
        </div>
        <div className="field-row">
          <div className="field field-wide">
            <label>City</label>
            <input
              value={value.city}
              onChange={(e) => handleFieldChange("city", e.target.value)}
              onBlur={() => handleBlurWithVerify("city")}
              onFocus={() => markFocused("city")}
              required={required}
              maxLength={100}
              className={showError("city") ? "field-error" : ""}
            />
            {showError("city") && <div className="field-error-msg">City is required</div>}
          </div>
          <div className="field field-narrow">
            <label>State</label>
            <select
              value={value.state}
              onChange={(e) => handleFieldChange("state", e.target.value)}
              onBlur={() => handleBlurWithVerify("state")}
              onFocus={() => markFocused("state")}
              required={required}
              className={showError("state") ? "field-error" : ""}
            >
              <option value="">--</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {showError("state") && <div className="field-error-msg">State is required</div>}
          </div>
          <div className="field field-narrow">
            <label>ZIP</label>
            <input
              value={value.zip}
              onChange={(e) => handleFieldChange("zip", e.target.value)}
              onBlur={() => handleBlurWithVerify("zip")}
              onFocus={() => markFocused("zip")}
              required={required}
              maxLength={10}
              className={showError("zip") ? "field-error" : ""}
            />
            {showError("zip") && <div className="field-error-msg">ZIP code is required</div>}
          </div>
        </div>
        {verificationStatus === "failed" && !userConfirmed && (
          <div className="warning-msg" style={{ marginTop: "0.5rem" }}>
            We couldn&rsquo;t verify this address.{" "}
            <button type="button" className="link-btn" onClick={() => setUserConfirmed(true)}>
              Use this address anyway
            </button>
          </div>
        )}
        <button type="button" className="link-btn" onClick={toggleToAuto}>
          Use address lookup instead.
        </button>
      </div>
    );
  }

  return (
    <div className="field-group">
      <div className="field address-autocomplete-field">
        <label>{label}{required ? " *" : ""}</label>
        <div className="address-input-wrapper">
          <input
            type="text"
            value={inputText}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleInputBlur}
            onFocus={handleInputFocus}
            placeholder="Start typing an address..."
            autoComplete="off"
            maxLength={500}
            className={showAddressError ? "field-error" : ""}
          />
          {suggestions.length > 0 && (
            <ul className="address-suggestions">
              {suggestions.map((s, i) => (
                <li
                  key={s.properties.formatted}
                  className={i === dropdownIndex ? "highlighted" : ""}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSuggestion(s)}
                  onMouseEnter={() => setDropdownIndex(i)}
                >
                  {s.properties.formatted || "Address"}
                </li>
              ))}
            </ul>
          )}
        </div>
        {showAddressError && <div className="field-error-msg">Address is required</div>}
      </div>
      <button type="button" className="link-btn" onClick={toggleToManual}>
        Enter address manually.
      </button>
    </div>
  );
}
