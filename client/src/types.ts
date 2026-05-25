export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
] as const;

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
  city: string;
  state: string;
  zip: string;
}

export function emptyAddress(): AddressValue {
  return { formatted: "", street: "", city: "", state: "", zip: "" };
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
  };
}

export interface ClaimFormData {
  state: string;
  namedInsureds: NamedInsured[];
  propertyAddress: AddressValue;
  dateOfLoss: string;
  lossType: string;
  insuranceCompany: string;
  policyNumber: string;
  claimNumber: string;
  adjuster: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    licenseNumber: string;
  };
  additionalDetails?: string;
}

export interface TemplateField {
  name: string;
  type: string;
  required: boolean;
}

export interface TemplateFieldsResponse {
  success: boolean;
  templateId: number;
  fields: TemplateField[];
}
