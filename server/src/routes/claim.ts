import { Router, Request, Response } from "express";
import {
  resolveTemplateId,
  createClaimSubmission,
} from "../services/docuseal";

export const claimRouter = Router();

interface AddressValue {
  formatted: string;
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface NamedInsuredInput {
  type: "individual" | "company";
  salutation?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  companyName?: string;
  phone: string;
  email: string;
  mailingAddress?: AddressValue;
}

interface ClaimRequestBody {
  state: string;
  namedInsureds: NamedInsuredInput[];
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

claimRouter.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body as ClaimRequestBody;

    if (!body.state || !body.namedInsureds?.length || !body.adjuster?.email) {
      res.status(400).json({
        success: false,
        error: "Missing required fields: state, namedInsureds, adjuster.email",
      });
      return;
    }

    const templateId = resolveTemplateId(
      body.state,
      body.namedInsureds.length
    );

    const submitters = body.namedInsureds.map((ni, i) => ({
      email: ni.email,
      role: i === 0 ? "First Named Insured" : `Additional Named Insured ${i}`,
    }));

    submitters.push({
      email: body.adjuster.email,
      role: "Public Adjuster",
    });

    const variables: Record<string, string> = {};

    body.namedInsureds.forEach((ni, i) => {
      const s = i === 0 ? "" : `_${i + 1}`;
      if (ni.type === "individual") {
        variables[`insured_first_name${s}`] = ni.firstName || "";
        variables[`insured_last_name${s}`] = ni.lastName || "";
        variables[`insured_middle_name${s}`] = ni.middleName || "";
        variables[`insured_email${s}`] = ni.email;
        variables[`insured_phone${s}`] = ni.phone;
        if (ni.salutation) variables[`insured_salutation${s}`] = ni.salutation;
        if (ni.suffix) variables[`insured_suffix${s}`] = ni.suffix;
      } else {
        variables[`insured_company_name${s}`] = ni.companyName || "";
        variables[`insured_email${s}`] = ni.email;
        variables[`insured_phone${s}`] = ni.phone;
      }
      if (ni.mailingAddress) {
        variables[`insured_mailing_address${s}`] = ni.mailingAddress.formatted;
        variables[`insured_mailing_city${s}`] = ni.mailingAddress.city;
        variables[`insured_mailing_state${s}`] = ni.mailingAddress.state;
        variables[`insured_mailing_zip${s}`] = ni.mailingAddress.zip;
      }
    });

    variables.property_address = body.propertyAddress.formatted;
    variables.property_street = body.propertyAddress.street;
    variables.property_city = body.propertyAddress.city;
    variables.property_state = body.propertyAddress.state;
    variables.property_zip = body.propertyAddress.zip;
    variables.date_of_loss = body.dateOfLoss;
    variables.loss_type = body.lossType;
    variables.insurance_company = body.insuranceCompany;
    variables.policy_number = body.policyNumber;
    variables.claim_number = body.claimNumber;
    variables.adjuster_first_name = body.adjuster.firstName;
    variables.adjuster_last_name = body.adjuster.lastName;
    variables.adjuster_email = body.adjuster.email;
    variables.adjuster_phone = body.adjuster.phone;
    variables.adjuster_license_number = body.adjuster.licenseNumber;

    if (body.additionalDetails) {
      variables.additional_details = body.additionalDetails;
    }

    const submission = await createClaimSubmission({
      templateId,
      submitters,
      variables,
      sendEmail: true,
    });

    res.json({ success: true, submission });
  } catch (error) {
    console.error("Error creating claim submission:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
