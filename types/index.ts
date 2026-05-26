export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
] as const;

export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

export const LOSS_TYPES = [
  "Fire",
  "Water",
  "Wind",
  "Hail",
  "Theft",
  "Vandalism",
  "Smoke",
  "Mold",
  "Lightning",
  "Explosion",
  "Vehicle",
  "Other",
] as const;

export const SALUTATIONS = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Rev."] as const;

export const NAME_SUFFIXES = ["Jr.", "Sr.", "II", "III", "IV", "V"] as const;

export interface AddressValue {
  formatted: string;
  street: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
}

export function emptyAddress(): AddressValue {
  return { formatted: "", street: "", street2: "", city: "", state: "", zip: "" };
}

export interface NamedInsured {
  type: "individual" | "company";
  salutation: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  companyName: string;
  phone: string;
  email: string;
  differentMailingAddress: boolean;
  mailingAddress: AddressValue;
  typeChosen: boolean;
}

export function emptyInsured(): NamedInsured {
  return {
    type: "individual",
    salutation: "",
    firstName: "",
    middleName: "",
    lastName: "",
    suffix: "",
    companyName: "",
    phone: "",
    email: "",
    differentMailingAddress: false,
    mailingAddress: emptyAddress(),
    typeChosen: false,
  };
}

export interface ClaimFormData {
  state: string;
  propertyAddress: AddressValue;
  namedInsureds: NamedInsured[];
  adjuster: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    licenseNumber: string;
    mailingAddress: AddressValue;
  };
  fieldValues?: Record<string, string>;
}

export const AUTO_POPULATED_FIELDS = new Set([
  "Loss Address",
  "First Insured Name", "First Insured Phone", "First Insured Email",
  "Insured Mailing Address",
  "Second Insured Name", "Second Insured Phone", "Second Insured Email",
  "Public Adjuster Name", "Public Adjuster License Number",
  "Public Adjuster Email", "Public Adjuster Phone",
  "Public Adjuster Mailing Address",
  "First Insured Signing Date", "Public Adjuster Date Signed",
]);

export const SKIP_FIELD_TYPES = new Set(["signature", "initials"]);

export const CHECKBOX_FIELDS = new Set([
  "Non-Emergency Claim",
  "Emergency Claim",
  "Supplemental Claim",
]);

export interface TemplateField {
  name: string;
  type: string;
  required: boolean;
  submitter_uuid: string;
}

export interface TemplateSubmitter {
  name: string;
  uuid: string;
}

export interface TemplateFieldsResponse {
  success: boolean;
  templateId: number;
  fields: TemplateField[];
  submitters: TemplateSubmitter[];
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("1") ? digits.slice(1) : digits;
  return normalized.length === 10;
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("1") ? digits.slice(1) : digits;
  if (normalized.length !== 10) return phone;
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
