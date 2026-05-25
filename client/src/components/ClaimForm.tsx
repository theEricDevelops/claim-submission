import { useState, useCallback, type FormEvent } from "react";
import {
  type AddressValue,
  type NamedInsured,
  type TemplateField,
  type ClaimFormData,
  emptyAddress,
  emptyInsured,
  LOSS_TYPES,
  SALUTATIONS,
  NAME_SUFFIXES,
} from "../types";
import {
  submitClaim,
  fetchTemplateFields,
  type ClaimResponse,
} from "../api/claim";
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
  | { type: "success"; data: ClaimResponse }
  | { type: "error"; message: string };

export default function ClaimForm() {
  const [currentStep, setCurrentStep] = useState(0);
  const [propertyAddress, setPropertyAddress] = useState<AddressValue>(emptyAddress());
  const [namedInsureds, setNamedInsureds] = useState<NamedInsured[]>([
    emptyInsured(),
  ]);
  const [dateOfLoss, setDateOfLoss] = useState("");
  const [lossType, setLossType] = useState("");
  const [insuranceCompany, setInsuranceCompany] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [claimNumber, setClaimNumber] = useState("");
  const [adjFirstName, setAdjFirstName] = useState("");
  const [adjLastName, setAdjLastName] = useState("");
  const [adjEmail, setAdjEmail] = useState("");
  const [adjPhone, setAdjPhone] = useState("");
  const [adjLicense, setAdjLicense] = useState("");
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [status, setStatus] = useState<SubmissionStatus>({ type: "idle" });

  const state =
    propertyAddress.state ||
    (propertyAddress.formatted ? "CA" : "");

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
        if (!propertyAddress.formatted && !propertyAddress.street) return false;
        return true;
      case 1:
        for (const ni of namedInsureds) {
          if (ni.type === "individual" && (!ni.firstName || !ni.lastName)) return false;
          if (ni.type === "company" && !ni.companyName) return false;
          if (!ni.phone || !ni.email) return false;
        }
        return true;
      case 2:
        return !!(dateOfLoss && lossType && insuranceCompany && policyNumber && claimNumber);
      case 3:
        return !!(adjFirstName && adjLastName && adjEmail && adjPhone && adjLicense);
      default:
        return true;
    }
  }

  async function handleNext() {
    if (!validateStep(currentStep)) return;
    if (currentStep === 1) {
      setLoadingTemplates(true);
      try {
        const res = await fetchTemplateFields(state, namedInsureds.length);
        if (res.success) {
          setTemplateFields(res.fields);
        }
      } catch (err) {
        console.warn("Failed to fetch template fields, using defaults:", err);
      } finally {
        setLoadingTemplates(false);
      }
    }
    setCurrentStep((s) => Math.min(s + 1, 4));
  }

  function handleBack() {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateStep(4)) return;

    setStatus({ type: "submitting" });

    const payload: ClaimFormData = {
      state,
      namedInsureds,
      propertyAddress,
      dateOfLoss,
      lossType,
      insuranceCompany,
      policyNumber,
      claimNumber,
      adjuster: {
        firstName: adjFirstName,
        lastName: adjLastName,
        email: adjEmail,
        phone: adjPhone,
        licenseNumber: adjLicense,
      },
      additionalDetails: additionalDetails || undefined,
    };

    try {
      const result = await submitClaim(payload);
      setStatus({ type: "success", data: result });
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
        <pre>{JSON.stringify(status.data.submission, null, 2)}</pre>
        <button onClick={() => setStatus({ type: "idle" })}>
          Submit Another Claim
        </button>
      </div>
    );
  }

  function renderStep() {
    switch (currentStep) {
      case 0:
        return renderStep0();
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return null;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="claim-form multi-step">
      <h1>Public Adjuster Claim Submission</h1>
      <StepIndicator
        currentStep={currentStep}
        totalSteps={5}
        labels={STEP_LABELS}
      />
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
            disabled={
              !validateStep(currentStep) || loadingTemplates
            }
          >
            {loadingTemplates
              ? "Loading..."
              : currentStep === 3
                ? "Review"
                : "Next"}
          </button>
        )}
        {currentStep === 4 && (
          <button
            type="submit"
            className="btn btn-primary"
            disabled={status.type === "submitting"}
          >
            {status.type === "submitting"
              ? "Submitting..."
              : "Submit & Generate Agreement"}
          </button>
        )}
      </div>
    );
  }

  function renderStep0() {
    return (
      <fieldset>
        <legend>Loss Address</legend>
        <p className="step-description">
          Enter the property address where the loss occurred.
        </p>
        <AddressInput
          label="Property Address"
          value={propertyAddress}
          onChange={setPropertyAddress}
          required
        />
      </fieldset>
    );
  }

  function renderStep1() {
    return (
      <fieldset>
        <legend>Insured Parties</legend>
        <p className="step-description">
          Add the person(s) or company(ies) filing the claim.
        </p>
        {namedInsureds.map((ni, i) => (
          <div key={i} className="insured-entry">
            <div className="insured-header">
              <h3>{i === 0 ? "First Named Insured" : `Additional Named Insured ${i + 1}`}</h3>
              {namedInsureds.length > 1 && (
                <button
                  type="button"
                  className="btn-remove"
                  onClick={() => removeInsured(i)}
                  aria-label="Remove insured"
                >
                  &minus;
                </button>
              )}
            </div>
            <div className="field-row">
              <div className="field field-narrow">
                <label>Type *</label>
                <select
                  value={ni.type}
                  onChange={(e) =>
                    updateInsured(i, {
                      type: e.target.value as "individual" | "company",
                    })
                  }
                >
                  <option value="individual">Individual</option>
                  <option value="company">Company</option>
                </select>
              </div>
            </div>
            {ni.type === "individual" ? (
              <>
                <div className="field-row">
                  <div className="field field-narrow">
                    <label>Salutation</label>
                    <select
                      value={ni.salutation}
                      onChange={(e) =>
                        updateInsured(i, { salutation: e.target.value })
                      }
                    >
                      <option value="">--</option>
                      {SALUTATIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <NameField
                    label="First Name"
                    value={ni.firstName}
                    onChange={(v) => updateInsured(i, { firstName: v })}
                    required
                  />
                  <NameField
                    label="Middle Name"
                    value={ni.middleName}
                    onChange={(v) => updateInsured(i, { middleName: v })}
                  />
                  <NameField
                    label="Last Name"
                    value={ni.lastName}
                    onChange={(v) => updateInsured(i, { lastName: v })}
                    required
                  />
                  <div className="field field-narrow">
                    <label>Suffix</label>
                    <select
                      value={ni.suffix}
                      onChange={(e) =>
                        updateInsured(i, { suffix: e.target.value })
                      }
                    >
                      <option value="">--</option>
                      {NAME_SUFFIXES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <NameField
                label="Company Name"
                value={ni.companyName}
                onChange={(v) => updateInsured(i, { companyName: v })}
                required
              />
            )}
            <ContactFields
              phone={ni.phone}
              email={ni.email}
              onPhoneChange={(v) => updateInsured(i, { phone: v })}
              onEmailChange={(v) => updateInsured(i, { email: v })}
            />
            <div className="field-checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={ni.differentMailingAddress}
                  onChange={(e) =>
                    updateInsured(i, {
                      differentMailingAddress: e.target.checked,
                    })
                  }
                />
                Different mailing address
              </label>
            </div>
            {ni.differentMailingAddress && (
              <AddressInput
                label="Mailing Address"
                value={ni.mailingAddress}
                onChange={(v) => updateInsured(i, { mailingAddress: v })}
              />
            )}
          </div>
        ))}
        {namedInsureds.length < 2 && (
          <button
            type="button"
            className="btn-add"
            onClick={addInsured}
            aria-label="Add insured"
          >
            +
          </button>
        )}
      </fieldset>
    );
  }

  function renderStep2() {
    return (
      <fieldset>
        <legend>Loss Details</legend>
        <p className="step-description">
          Provide information about the loss and insurance policy.
        </p>
        {templateFields.length > 0 && (
          <div className="template-fields-hint">
            <small>{templateFields.length} template field(s) available</small>
          </div>
        )}
        <div className="field-row">
          <div className="field">
            <label>Date of Loss *</label>
            <input
              type="date"
              value={dateOfLoss}
              onChange={(e) => setDateOfLoss(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Type of Loss *</label>
            <select
              value={lossType}
              onChange={(e) => setLossType(e.target.value)}
              required
            >
              <option value="">-- Select --</option>
              {LOSS_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Insurance Company *</label>
            <input
              value={insuranceCompany}
              onChange={(e) => setInsuranceCompany(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Policy # *</label>
            <input
              value={policyNumber}
              onChange={(e) => setPolicyNumber(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Claim # *</label>
            <input
              value={claimNumber}
              onChange={(e) => setClaimNumber(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="field">
          <label>Notes (optional)</label>
          <textarea
            value={additionalDetails}
            onChange={(e) => setAdditionalDetails(e.target.value)}
            rows={3}
          />
        </div>
      </fieldset>
    );
  }

  function renderStep3() {
    return (
      <fieldset>
        <legend>Public Adjuster Information</legend>
        <p className="step-description">
          Enter the adjuster assigned to this claim.
        </p>
        <div className="field-row">
          <NameField
            label="First Name"
            value={adjFirstName}
            onChange={setAdjFirstName}
            required
          />
          <NameField
            label="Last Name"
            value={adjLastName}
            onChange={setAdjLastName}
            required
          />
        </div>
        <ContactFields
          phone={adjPhone}
          email={adjEmail}
          onPhoneChange={setAdjPhone}
          onEmailChange={setAdjEmail}
        />
        <div className="field-row">
          <div className="field">
            <label>License # *</label>
            <input
              value={adjLicense}
              onChange={(e) => setAdjLicense(e.target.value)}
              required
            />
          </div>
        </div>
      </fieldset>
    );
  }

  function renderStep4() {
    const namedInsuredLabel = (ni: NamedInsured): string => {
      if (ni.type === "individual") {
        return [ni.salutation, ni.firstName, ni.middleName, ni.lastName, ni.suffix]
          .filter(Boolean)
          .join(" ") || "Unnamed insured";
      }
      return ni.companyName || "Unnamed company";
    };

    return (
      <fieldset>
        <legend>Review &amp; Submit</legend>
        <p className="step-description">
          Please review all information before submitting.
        </p>
        <div className="review-section">
          <h4>Loss Address</h4>
          <p>{propertyAddress.formatted || `${propertyAddress.street}, ${propertyAddress.city}, ${propertyAddress.state} ${propertyAddress.zip}`}</p>
        </div>
        <div className="review-section">
          <h4>Insured Parties ({namedInsureds.length})</h4>
          {namedInsureds.map((ni, i) => (
            <div key={i} className="review-item">
              <strong>{i === 0 ? "First" : `Additional ${i + 1}`}:</strong>{" "}
              {namedInsuredLabel(ni)} &lt;{ni.email}&gt; {ni.phone}
              {ni.differentMailingAddress && (
                <div className="review-sub">
                  Mailing: {ni.mailingAddress.formatted || `${ni.mailingAddress.street}, ${ni.mailingAddress.city}, ${ni.mailingAddress.state} ${ni.mailingAddress.zip}`}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="review-section">
          <h4>Loss Details</h4>
          <p>Date: {dateOfLoss} &mdash; Type: {lossType}</p>
          <p>{insuranceCompany} &mdash; Policy: {policyNumber} &mdash; Claim: {claimNumber}</p>
          {additionalDetails && <p>Notes: {additionalDetails}</p>}
        </div>
        <div className="review-section">
          <h4>Public Adjuster</h4>
          <p>{adjFirstName} {adjLastName} &lt;{adjEmail}&gt; {adjPhone} Lic: {adjLicense}</p>
        </div>
      </fieldset>
    );
  }
}
