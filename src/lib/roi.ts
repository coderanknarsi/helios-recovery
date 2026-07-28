import type { ResidentRoi, RoiScope } from "@/db/schema";

export type ScopeDefinition = {
  value: RoiScope;
  label: string;
  /** Plain-language description a resident can actually evaluate. */
  detail: string;
};

/**
 * What a resident can authorize us to share. Deliberately narrow and concrete
 * — "everything about me" is not an option, because a consent that broad is
 * neither informed nor defensible.
 */
export const ROI_SCOPES: ScopeDefinition[] = [
  {
    value: "attendance",
    label: "Residency & attendance",
    detail:
      "Whether you live here, your move-in date, and whether you are present and in good standing.",
  },
  {
    value: "drug_tests",
    label: "Drug & alcohol screen results",
    detail: "The date, type, and result of tests taken here.",
  },
  {
    value: "program_status",
    label: "Program participation",
    detail:
      "Meeting attendance, chores, curfew compliance, and progress toward your goals.",
  },
  {
    value: "financial",
    label: "Fees & payments",
    detail: "Your balance, payment history, and any payment arrangement.",
  },
  {
    value: "incidents",
    label: "Incidents & rule violations",
    detail: "Written warnings, infractions, and incident reports.",
  },
  {
    value: "discharge_summary",
    label: "Move-out summary",
    detail: "Your discharge date and the reason you left.",
  },
];

export function scopeLabel(value: string) {
  return ROI_SCOPES.find((s) => s.value === value)?.label ?? value;
}

export const CONSENT_TYPE_LABELS: Record<string, string> = {
  granular: "Specific release",
  tpo: "Care coordination",
  legal_proceeding: "Legal proceeding",
};

/**
 * Required by 42 CFR §2.32. Must accompany every disclosure, so it is stamped
 * into the signed release itself and shown to staff when they log a disclosure.
 */
export const REDISCLOSURE_NOTICE = `NOTICE TO RECIPIENT: This information has been disclosed to you from records protected by federal confidentiality rules (42 CFR Part 2). The federal rules prohibit you from making any further disclosure of information in this record that identifies a patient as having or having had a substance use disorder either directly, by reference to publicly available information, or through verification of such identification by another person unless further disclosure is expressly permitted by the written consent of the individual whose information is being disclosed or as otherwise permitted by 42 CFR Part 2. A general authorization for the release of medical or other information is NOT sufficient for this purpose (see 42 CFR 2.31). The federal rules restrict any use of the information to investigate or prosecute with regard to a crime any patient with a substance use disorder, except as provided at 42 CFR 2.12(c)(5) and 2.65.`;

/** A release is active only while unrevoked and unexpired. */
export function roiIsActive(roi: Pick<ResidentRoi, "revokedAt" | "expiresAt">) {
  return roi.revokedAt === null && roi.expiresAt.getTime() > Date.now();
}

export type RoiState = "active" | "revoked" | "expired";

export function roiState(
  roi: Pick<ResidentRoi, "revokedAt" | "expiresAt">,
): RoiState {
  if (roi.revokedAt) return "revoked";
  if (roi.expiresAt.getTime() <= Date.now()) return "expired";
  return "active";
}

function fmt(dt: Date) {
  return dt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Builds the signable release text. Kept as a text snapshot so the exact
 * wording the resident agreed to is frozen at signing time, even if the
 * template later changes.
 */
export function buildRoiBody(opts: {
  orgName: string;
  orgAddress: string;
  residentName: string;
  dateOfBirth: string;
  recipientName: string;
  recipientRole: string;
  recipientOrganization: string | null;
  scopes: RoiScope[];
  purpose: string;
  expiresAt: Date;
  today: Date;
}): string {
  const {
    orgName,
    orgAddress,
    residentName,
    dateOfBirth,
    recipientName,
    recipientRole,
    recipientOrganization,
    scopes,
    purpose,
    expiresAt,
    today,
  } = opts;

  const recipientLine = recipientOrganization
    ? `${recipientName}, ${recipientRole}, ${recipientOrganization}`
    : `${recipientName}, ${recipientRole}`;

  const scopeLines = scopes
    .map((s) => {
      const def = ROI_SCOPES.find((d) => d.value === s);
      return def ? `  - ${def.label}: ${def.detail}` : `  - ${s}`;
    })
    .join("\n");

  return [
    `AUTHORIZATION FOR RELEASE OF INFORMATION`,
    ``,
    `Resident: ${residentName}`,
    `Date of birth: ${dateOfBirth}`,
    `Date: ${fmt(today)}`,
    ``,
    `1. WHO IS RELEASING THE INFORMATION`,
    `${orgName}`,
    `${orgAddress}`,
    ``,
    `2. WHO MAY RECEIVE IT`,
    `I authorize the release of the information described below to:`,
    ``,
    `  ${recipientLine}`,
    ``,
    `This authorization names one recipient. It does not permit disclosure to`,
    `anyone else, including that person's colleagues, family, or employer,`,
    `unless I sign a separate authorization.`,
    ``,
    `3. EXACTLY WHAT MAY BE SHARED`,
    `Only the categories checked below may be disclosed. Nothing else may be`,
    `shared under this authorization.`,
    ``,
    scopeLines,
    ``,
    `4. WHY IT IS BEING SHARED`,
    purpose,
    ``,
    `5. WHEN THIS EXPIRES`,
    `This authorization expires on ${fmt(expiresAt)} unless I revoke it sooner.`,
    `After that date no further information may be released to the person named`,
    `above without a new signed authorization.`,
    ``,
    `6. MY RIGHT TO REVOKE`,
    `I may revoke this authorization at any time, verbally or in writing, or`,
    `from my resident portal. Revocation takes effect immediately. It does not`,
    `apply to information that was already released while this authorization`,
    `was in effect, because that disclosure cannot be undone.`,
    ``,
    `7. NO CONDITIONING`,
    `My housing, services, and treatment here do not depend on whether I sign`,
    `this. I may refuse, and I may authorize some categories and not others.`,
    ``,
    `8. RECORD OF DISCLOSURES`,
    `${orgName} keeps a log of what is actually disclosed under this`,
    `authorization, to whom, and when. I may ask to see that log at any time.`,
    ``,
    `9. NOTICE TO THE PERSON RECEIVING THIS INFORMATION`,
    REDISCLOSURE_NOTICE,
    ``,
    `I have read this authorization, or had it read to me, and I understand it.`,
    `I am signing it freely.`,
  ].join("\n");
}
