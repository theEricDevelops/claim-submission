import { z } from "zod";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
  "DC",
] as const;

export const addressSchema = z.object({
  formatted: z.string().max(500).default(""),
  street: z.string().max(200).default(""),
  street2: z.string().max(200).default(""),
  city: z.string().max(100).default(""),
  state: z.string().max(2).default(""),
  zip: z.string().max(10).default(""),
});

const namedInsuredSchema = z.object({
  type: z.enum(["individual", "company"]),
  salutation: z.string().max(20).default(""),
  firstName: z.string().max(100).default(""),
  middleName: z.string().max(100).default(""),
  lastName: z.string().max(100).default(""),
  suffix: z.string().max(10).default(""),
  companyName: z.string().max(200).default(""),
  phone: z.string().max(30),
  email: z.string().max(254),
  differentMailingAddress: z.boolean().default(false),
  mailingAddress: addressSchema.default({
    formatted: "", street: "", street2: "", city: "", state: "", zip: "",
  }),
  typeChosen: z.boolean().default(false),
});

const adjusterSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().min(1).max(254),
  phone: z.string().min(1).max(30),
  licenseNumber: z.string().min(1).max(50),
  mailingAddress: addressSchema.optional(),
});

export const templatesFieldsSchema = z.object({
  state: z
    .string()
    .min(2)
    .max(2)
    .transform((s) => s.toUpperCase())
    .refine((s) => (US_STATES as readonly string[]).includes(s), {
      message: "Invalid US state code",
    }),
  insuredCount: z.number().int().min(1).max(10),
});

export const claimSchema = z.object({
  state: z
    .string()
    .min(2)
    .max(2)
    .transform((s) => s.toUpperCase())
    .refine((s) => (US_STATES as readonly string[]).includes(s), {
      message: "Invalid US state code",
    }),
  namedInsureds: z.array(namedInsuredSchema).min(1).max(10),
  propertyAddress: addressSchema,
  adjuster: adjusterSchema,
  fieldValues: z.record(z.string().max(5000), z.string().max(5000)).optional(),
});
