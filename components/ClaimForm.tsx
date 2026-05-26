"use client";

import { useState, useCallback, useRef, useEffect, type FormEvent } from "react";
import {
  type AddressValue,
  type NamedInsured,
  type ClaimFormData,
  type TemplateField,
  type TemplateSubmitter,
  emptyAddress,
  emptyInsured,
  SALUTATIONS,
  NAME_SUFFIXES,
  STATE_NAMES,
  AUTO_POPULATED_FIELDS,
  SKIP_FIELD_TYPES,
  CHECKBOX_FIELDS,
  isValidPhone,
  isValidEmail,
  formatPhone,
} from "@/types";
import StepIndicator from "./StepIndicator";
import AddressInput from "./AddressInput";
import ContactFields from "./ContactFields";
import NameField from "./NameField";

const STEP_LABELS = [
  "Loss Address",
  "Insured Parties",
  "Loss Details",
  "Adjuster Info",
  "Review & Submit",
];

type SubmissionStatus =
  | { type: "idle" }
  | { type: "submitting" }
  | { type: "success"; data: unknown }
  | { type: "error"; message: string };

export default function ClaimForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [maxCompletedStep, setMaxCompletedStep] = useState(0);
  const [propertyAddress, setPropertyAddress] = useState<AddressValue>(emptyAddress());
  const [namedInsureds, setNamedInsureds] = useState<NamedInsured[]>([
    emptyInsured(),
  ]);
  const [adjFirstName, setAdjFirstName] = useState("");
  const [adjLastName, setAdjLastName] = useState("");
  const [adjEmail, setAdjEmail] = useState("");
  const [adjPhone, setAdjPhone] = useState("");
  const [adjLicense, setAdjLicense] = useState("");
  const [adjMailingAddress, setAdjMailingAddress] = useState<AddressValue>(emptyAddress());
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const [templateSubmitters, setTemplateSubmitters] = useState<TemplateSubmitter[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [status, setStatus] = useState<SubmissionStatus>({ type: "idle" });
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const stepRef = useRef<HTMLFieldSetElement>(null);

  function resetForm() {
    setCurrentStep(0);
    setMaxCompletedStep(0);
    setPropertyAddress(emptyAddress());
    setNamedInsureds([emptyInsured()]);
    setAdjFirstName("");
    setAdjLastName("");
    setAdjEmail("");
    setAdjPhone("");
    setAdjLicense("");
    setAdjMailingAddress(emptyAddress());
    setTemplateFields([]);
    setTemplateSubmitters([]);
    setFieldValues({});
    setTemplateError("");
    setShowFieldErrors(false);
    setStatus({ type: "idle" });
  }

  useEffect(() => {
    if (stepRef.current) {
      const first = stepRef.current.querySelector<HTMLElement>("input, select, textarea");
      first?.focus();
    }
    setShowFieldErrors(false);
  }, [currentStep]);

  const state = propertyAddress.state || "";

  function updateInsured(index: number, updates: Partial<NamedInsured>) {
    setNamedInsureds((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  }

  const addInsured = useCallback(() => {
    if (namedInsureds.length >= 2) return;
    setNamedInsureds((prev) => [...prev, emptyInsured()]);
  }, [namedInsureds.length]);

  const removeInsured = useCallback((index: number) => {
    setNamedInsureds((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  function validateStep(step: number): boolean {
    switch (step) {
      case 0:
        return !!(propertyAddress.street && propertyAddress.city && propertyAddress.state && propertyAddress.zip);
      case 1:
        for (const ni of namedInsureds) {
          if (!ni.typeChosen) return false;
          if (ni.type === "individual" && (!ni.firstName || !ni.lastName)) return false;
          if (ni.type === "company" && !ni.companyName) return false;
          if (!ni.phone || !ni.email) return false;
          if (!isValidPhone(ni.phone)) return false;
          if (!isValidEmail(ni.email)) return false;
        }
        return true;
      case 2:
        return templateFields
          .filter((f) => f.required && !AUTO_POPULATED_FIELDS.has(f.name) && !SKIP_FIELD_TYPES.has(f.type) && !/sign|initial/i.test(f.name))
          .every((f) => !!fieldValues[f.name]);
      case 3:
        if (!(adjFirstName && adjLastName && adjEmail && adjPhone && adjLicense)) return false;
        if (!isValidPhone(adjPhone)) return false;
        if (!isValidEmail(adjEmail)) return false;
        return true;
      default:
        return true;
    }
  }

  function goToStep(s: number) {
    setCurrentStep(s);
    setMaxCompletedStep((prev) => Math.max(prev, s));
  }

  async function handleNext() {
    if (!validateStep(currentStep)) {
      setShowFieldErrors(true);
      return;
    }
    setTemplateError("");

    if (currentStep === 0 && state) {
      setLoadingTemplates(true);
      try {
        const res = await fetch("/api/templates/fields", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state, insuredCount: 1 }),
        });
        const data = await res.json();
        if (!data.success) {
          setTemplateError(data.error || "No template configured for this state");
          setLoadingTemplates(false);
          return;
        }
      } catch (err) {
        setTemplateError(
          err instanceof Error ? err.message : "Failed to validate template"
        );
        setLoadingTemplates(false);
        return;
      }
      setLoadingTemplates(false);
    }

    if (currentStep === 1) {
      setNamedInsureds((prev) =>
        prev.map((ni) => ({ ...ni, phone: formatPhone(ni.phone) }))
      );
      setLoadingTemplates(true);
      try {
        const res = await fetch("/api/templates/fields", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state, insuredCount: namedInsureds.length }),
        });
        const data = await res.json();
        if (data.success) {
          setTemplateFields(data.fields);
          setTemplateSubmitters(data.submitters || []);
          goToStep(currentStep + 1);
        } else {
          setTemplateError(data.error || "No template configured for this state");
        }
      } catch (err) {
        setTemplateError(
          err instanceof Error ? err.message : "Failed to fetch template fields"
        );
      } finally {
        setLoadingTemplates(false);
      }
      return;
    }

    if (currentStep === 3) {
      setAdjPhone(formatPhone(adjPhone));
    }

    goToStep(Math.min(currentStep + 1, 4));
  }

  function handleBack() {
    goToStep(Math.max(currentStep - 1, 0));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateStep(4)) return;

    setStatus({ type: "submitting" });

    const allValues: Record<string, string> = { ...fieldValues };

    function insuredName(ni: NamedInsured): string {
      return ni.type === "individual"
        ? [ni.firstName, ni.middleName, ni.lastName].filter(Boolean).join(" ")
        : ni.companyName || "";
    }

    for (const tf of templateFields) {
      if (tf.name === "Loss Address") allValues[tf.name] = propertyAddress.formatted;
      else if (tf.name === "First Insured Name") allValues[tf.name] = insuredName(namedInsureds[0]);
      else if (tf.name === "First Insured Phone") allValues[tf.name] = namedInsureds[0]?.phone || "";
      else if (tf.name === "First Insured Email") allValues[tf.name] = namedInsureds[0]?.email || "";
      else if (tf.name === "Insured Mailing Address") allValues[tf.name] = namedInsureds[0]?.mailingAddress?.formatted || propertyAddress.formatted;
      else if (tf.name === "Second Insured Name") allValues[tf.name] = namedInsureds[1] ? insuredName(namedInsureds[1]) : "";
      else if (tf.name === "Second Insured Phone") allValues[tf.name] = namedInsureds[1]?.phone || "";
      else if (tf.name === "Second Insured Email") allValues[tf.name] = namedInsureds[1]?.email || "";
      else if (tf.name === "Public Adjuster Name") allValues[tf.name] = [adjFirstName, adjLastName].filter(Boolean).join(" ");
      else if (tf.name === "Public Adjuster License Number") allValues[tf.name] = adjLicense;
      else if (tf.name === "Public Adjuster Email") allValues[tf.name] = adjEmail;
      else if (tf.name === "Public Adjuster Phone") allValues[tf.name] = adjPhone;
      else if (tf.name === "Public Adjuster Mailing Address") allValues[tf.name] = adjMailingAddress.formatted || "";
    }

    if (allValues["Emergency Claim"] === "X" && allValues["Non-Emergency Claim"] === "") {
      allValues["Non-Emergency Claim"] = " ";
    } else if (allValues["Non-Emergency Claim"] === "X" && allValues["Emergency Claim"] === "") {
      allValues["Emergency Claim"] = " ";
    }

    const payload: ClaimFormData = {
      state,
      namedInsureds,
      propertyAddress,
      adjuster: {
        firstName: adjFirstName,
        lastName: adjLastName,
        email: adjEmail,
        phone: adjPhone,
        licenseNumber: adjLicense,
        mailingAddress: adjMailingAddress,
      },
      fieldValues: allValues,
    };

    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Submission failed");
      setStatus({ type: "success", data: result.submission });
    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Submission failed",
      });
    }
  }

  if (status.type === "success") {
    return (
      <div className="success">
        <h2>Claim Submitted Successfully</h2>
        <p>A DocuSeal agreement has been created and sent to the signers.</p>
        <pre>{JSON.stringify(status.data, null, 2)}</pre>
        <button onClick={resetForm}>
          Submit Another Claim
        </button>
      </div>
    );
  }

  function renderStep() {
    switch (currentStep) {
      case 0: return renderStep0();
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return null;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="claim-form multi-step" onKeyDown={(e) => { if (e.key === "Enter" && currentStep < 4 && !e.shiftKey) { e.preventDefault(); handleNext(); } }}>
      <h1>Claim Submission</h1>
      <StepIndicator currentStep={currentStep} totalSteps={5} labels={STEP_LABELS} maxCompletedStep={maxCompletedStep} onStepClick={goToStep} />
      {renderStep()}
      {status.type === "error" && (
        <div className="error-msg">Error: {status.message}</div>
      )}
      {renderNavButtons()}
    </form>
  );

  function renderNavButtons() {
    return (
      <div className="nav-buttons">
        {currentStep > 0 && currentStep < 4 && (
          <button type="button" className="btn btn-secondary" onClick={handleBack}>
            Back
          </button>
        )}
        {currentStep < 4 && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleNext}
            disabled={!validateStep(currentStep) || loadingTemplates}
          >
            {loadingTemplates ? "Loading..." : currentStep === 3 ? "Review" : "Next"}
          </button>
        )}
        {currentStep === 4 && (
          <button
            type="submit"
            className="btn btn-primary"
            disabled={status.type === "submitting"}
          >
            {status.type === "submitting" ? "Submitting..." : "Submit & Generate Agreement"}
          </button>
        )}
      </div>
    );
  }

  function renderStep0() {
    return (
      <fieldset ref={stepRef}>
        <legend>Loss Address</legend>
        <p className="step-description">Enter the property address where the loss occurred.</p>
        <AddressInput label="Property Address" value={propertyAddress} onChange={(v) => {
          setPropertyAddress(v);
          setTemplateError("");
        }} required showErrors={showFieldErrors} />
        {templateError && (
          <div className="warning-msg">
            No DocuSeal template configured for {STATE_NAMES[state] || state}.{' '}
            Create a template with name starting with &ldquo;{state}&rdquo;
          </div>
        )}
      </fieldset>
    );
  }

  function renderStep1() {
    return (
      <fieldset ref={stepRef}>
        <legend>Insured Parties</legend>
        <p className="step-description">Add the person(s) or company(ies) filing the claim.</p>
        {templateError && (
          <div className="warning-msg">{templateError}</div>
        )}
        {namedInsureds.map((ni, i) => (
          <div key={i} className="insured-entry">
            <div className="insured-header">
              <h3>{i === 0 ? "First Named Insured" : `Second Named Insured`}</h3>
              {namedInsureds.length > 1 && (
                <button type="button" className="btn-remove" onClick={() => removeInsured(i)} aria-label="Remove insured">&minus;</button>
              )}
            </div>
            <div className="field-row">
              <div className="field field-narrow">
                <label>Type *</label>
                <select
                  value={ni.typeChosen ? ni.type : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "individual" || val === "company") {
                      updateInsured(i, { type: val, typeChosen: true });
                    }
                  }}
                >
                  <option value="">-- Select --</option>
                  <option value="individual">Individual</option>
                  <option value="company">Company</option>
                </select>
              </div>
            </div>
            {ni.typeChosen && ni.type === "individual" && (
              <>
                <div className="field-row">
                  <div className="field field-narrow">
                    <label>Salutation</label>
                    <select value={ni.salutation} onChange={(e) => updateInsured(i, { salutation: e.target.value })}>
                      <option value="">--</option>
                      {SALUTATIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  </div>
                  <NameField label="First Name" value={ni.firstName} onChange={(v) => updateInsured(i, { firstName: v })} required showError={showFieldErrors} />
                  <NameField label="Middle Name" value={ni.middleName} onChange={(v) => updateInsured(i, { middleName: v })} />
                  <NameField label="Last Name" value={ni.lastName} onChange={(v) => updateInsured(i, { lastName: v })} required showError={showFieldErrors} />
                  <div className="field field-narrow">
                    <label>Suffix</label>
                    <select value={ni.suffix} onChange={(e) => updateInsured(i, { suffix: e.target.value })}>
                      <option value="">--</option>
                      {NAME_SUFFIXES.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  </div>
                </div>
                <ContactFields phone={ni.phone} email={ni.email} onPhoneChange={(v) => updateInsured(i, { phone: v })} onEmailChange={(v) => updateInsured(i, { email: v })} showErrors={showFieldErrors} />
              </>
            )}
            {ni.typeChosen && ni.type === "company" && (
              <>
                <NameField label="Company Name" value={ni.companyName} onChange={(v) => updateInsured(i, { companyName: v })} required showError={showFieldErrors} />
                <ContactFields phone={ni.phone} email={ni.email} onPhoneChange={(v) => updateInsured(i, { phone: v })} onEmailChange={(v) => updateInsured(i, { email: v })} showErrors={showFieldErrors} />
              </>
            )}
            {ni.typeChosen && (
              <div className="field-checkbox">
                <label>
                  <input type="checkbox" checked={ni.differentMailingAddress} onChange={(e) => updateInsured(i, { differentMailingAddress: e.target.checked })} />
                  Different mailing address
                </label>
              </div>
            )}
            {ni.typeChosen && ni.differentMailingAddress && (
              <AddressInput label="Mailing Address" value={ni.mailingAddress} onChange={(v) => updateInsured(i, { mailingAddress: v })} />
            )}
          </div>
        ))}
        {namedInsureds.length < 2 && (
          <button type="button" className="btn-add" onClick={addInsured} aria-label="Add insured">+</button>
        )}
      </fieldset>
    );
  }

  function renderStep2() {
    const extraFields = templateFields.filter(
      (f) => !AUTO_POPULATED_FIELDS.has(f.name) && !SKIP_FIELD_TYPES.has(f.type)
        && !/sign|initial/i.test(f.name)
    );
    return (
      <fieldset ref={stepRef}>
        <legend>Loss Details</legend>
        <p className="step-description">Provide information about the loss and insurance policy.</p>
        {extraFields.length > 0 && (
          <div className="extra-fields">
            {extraFields.map((f) => (
              <div key={f.name} className="field">
                {CHECKBOX_FIELDS.has(f.name) ? (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={fieldValues[f.name] === "X"}
                      onChange={(e) =>
                        setFieldValues((prev) => {
                          const next = { ...prev, [f.name]: e.target.checked ? "X" : "" };
                          if (e.target.checked && f.name === "Emergency Claim") next["Non-Emergency Claim"] = "";
                          if (e.target.checked && f.name === "Non-Emergency Claim") next["Emergency Claim"] = "";
                          return next;
                        })
                      }
                    />
                    {f.name}
                  </label>
                ) : (
                  <>
                    <label>{f.name}{f.required ? " *" : ""}</label>
                    <input
                      type={f.type === "date" ? "date" : "text"}
                      value={fieldValues[f.name] || ""}
                      onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
                      required={f.required}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </fieldset>
    );
  }

  function renderStep3() {
    return (
      <fieldset ref={stepRef}>
        <legend>Public Adjuster Information</legend>
        <p className="step-description">Enter the adjuster assigned to this claim.</p>
        <div className="field-row">
          <NameField label="First Name" value={adjFirstName} onChange={setAdjFirstName} required showError={showFieldErrors} />
          <NameField label="Last Name" value={adjLastName} onChange={setAdjLastName} required showError={showFieldErrors} />
        </div>
        <ContactFields phone={adjPhone} email={adjEmail} onPhoneChange={setAdjPhone} onEmailChange={setAdjEmail} showErrors={showFieldErrors} />
        <div className="field-row">
          <div className="field">
            <label>License # *</label>
            <input value={adjLicense} onChange={(e) => setAdjLicense(e.target.value)} required />
          </div>
        </div>
        <AddressInput label="Public Adjuster Mailing Address" value={adjMailingAddress} onChange={setAdjMailingAddress} />
      </fieldset>
    );
  }

  function renderStep4() {
    const namedInsuredLabel = (ni: NamedInsured): string => {
      if (ni.type === "individual") {
        return [ni.salutation, ni.firstName, ni.middleName, ni.lastName, ni.suffix].filter(Boolean).join(" ") || "Unnamed insured";
      }
      return ni.companyName || "Unnamed company";
    };

    return (
      <fieldset ref={stepRef}>
        <legend>Review &amp; Submit</legend>
        <p className="step-description">Please review all information before submitting.</p>
        <div className="review-section">
          <h4>Loss Address</h4>
          <p>{propertyAddress.formatted || [propertyAddress.street, propertyAddress.street2, `${propertyAddress.city}, ${propertyAddress.state} ${propertyAddress.zip}`].filter(Boolean).join(", ")}</p>
        </div>
        <div className="review-section">
          <h4>Insured Parties ({namedInsureds.length})</h4>
          {namedInsureds.map((ni, i) => (
            <div key={i} className="review-item">
              <strong>{i === 0 ? "First" : `Additional ${i + 1}`}:</strong> {namedInsuredLabel(ni)} &lt;{ni.email}&gt; {ni.phone}
              {ni.differentMailingAddress && (
                <div className="review-sub">Mailing: {ni.mailingAddress.formatted || [ni.mailingAddress.street, ni.mailingAddress.street2, `${ni.mailingAddress.city}, ${ni.mailingAddress.state} ${ni.mailingAddress.zip}`].filter(Boolean).join(", ")}</div>
              )}
            </div>
          ))}
        </div>
        <div className="review-section">
          <h4>Loss Details</h4>
          {Object.keys(fieldValues).filter((k) => fieldValues[k]).length > 0 && (
            <div className="review-sub">
              {Object.entries(fieldValues).filter(([, v]) => v).map(([k, v]) => (
                <p key={k}><strong>{k}:</strong> {v}</p>
              ))}
            </div>
          )}
        </div>
        <div className="review-section">
          <h4>Public Adjuster</h4>
          <p>{adjFirstName} {adjLastName} &lt;{adjEmail}&gt; {adjPhone} Lic: {adjLicense}</p>
          {adjMailingAddress.formatted && <p>Mailing: {adjMailingAddress.formatted}</p>}
        </div>
      </fieldset>
    );
  }
}
