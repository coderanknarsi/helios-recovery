import type { IntakeDocument } from "@/db/schema";

export type IntakeDocTypeValue = IntakeDocument["type"];

export type DocContext = {
  orgName: string;
  residentName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  emergencyContact: string;
  houseName: string;
  houseAddress: string;
  bedLabel: string;
  roomName: string;
  rent: string;
  moveInDate: string;
  today: string;
};

export type DocTemplate = {
  type: IntakeDocTypeValue;
  title: string;
  body: string;
};

const DASH = "—";

function or(value: string | null | undefined) {
  return value && value.trim().length ? value : DASH;
}

/**
 * Builds a resident's intake packet: pre-filled document snapshots ready to be
 * reviewed and e-signed. These are starter templates — operators should review
 * the wording with their own counsel before relying on them.
 */
export function buildIntakePacket(ctx: DocContext): DocTemplate[] {
  return [leaseAgreement(ctx), feeSchedule(ctx), houseRules(ctx), consent(ctx)];
}

/**
 * NARR Standard 3a requires every fee a resident could face to be disclosed in
 * writing and signed BEFORE any money is accepted — hence a standalone document
 * rather than a clause buried in the occupancy agreement.
 */
function feeSchedule(ctx: DocContext): DocTemplate {
  return {
    type: "fee_schedule",
    title: "Schedule of Fees & Refund Policy",
    body: [
      `${ctx.orgName.toUpperCase()}`,
      `SCHEDULE OF FEES & REFUND POLICY`,
      ``,
      `Provided to ${or(ctx.residentName)} on ${or(ctx.today)}, before any payment is accepted.`,
      ``,
      `1. RECURRING PROGRAM FEE`,
      `   • Amount: ${or(ctx.rent)}`,
      `   • Covers: bed, utilities, and access to the recovery program.`,
      `   • Due before the period it covers. A period is not considered paid until funds are received.`,
      ``,
      `2. ONE-TIME AND SITUATIONAL CHARGES`,
      `The Resident may also become responsible for the following. Any amount left blank is not charged by this Residence.`,
      `   • Security or damage deposit: ____________`,
      `   • Admission or intake fee: ____________`,
      `   • Late fee, and the number of days before it applies: ____________`,
      `   • Replacement of lost keys or fobs: ____________`,
      `   • Damage beyond ordinary wear: charged at documented cost of repair.`,
      `   • Drug testing beyond the routine schedule: ____________`,
      ``,
      `No fee may be charged to the Resident unless it appears above.`,
      ``,
      `3. WHAT IS NOT CHARGED`,
      `There is no fee for filing a grievance, for requesting a reasonable accommodation, or for receiving a copy of the Resident's own records.`,
      ``,
      `4. REFUND POLICY`,
      `   • Unused portion of a prepaid period: ____________`,
      `   • Deposit return, and the conditions for withholding it: ____________`,
      `   • Timeframe for any refund to be issued: ____________`,
      `Refunds are calculated from the date the Resident's belongings are removed.`,
      ``,
      `5. THIRD-PARTY PAYERS`,
      `Where a third party pays any amount on the Resident's behalf, the Resident will be told the amount and the payer. The Resident may request a written statement of their account at any time, at no charge.`,
      ``,
      `6. NON-PAYMENT`,
      `The Residence will discuss any missed payment with the Resident before taking action. Consequences of continued non-payment are set out in the Residency & Occupancy Agreement.`,
      ``,
      `By signing below, the Resident acknowledges they were told about every fee above before paying anything, and that they understand the refund policy.`,
    ].join("\n"),
  };
}

function leaseAgreement(ctx: DocContext): DocTemplate {
  return {
    type: "lease_agreement",
    title: "Residency & Occupancy Agreement",
    body: [
      `${ctx.orgName.toUpperCase()}`,
      `RESIDENCY & OCCUPANCY AGREEMENT`,
      ``,
      `This agreement is made on ${or(ctx.today)} between ${ctx.orgName} ("the Residence") and ${or(ctx.residentName)} ("the Resident").`,
      ``,
      `1. OCCUPANCY`,
      `The Resident is granted a bed in the Residence's sober-living program at the following location:`,
      `   • House: ${or(ctx.houseName)}`,
      `   • Address: ${or(ctx.houseAddress)}`,
      `   • Room: ${or(ctx.roomName)}`,
      `   • Bed: ${or(ctx.bedLabel)}`,
      `The Resident's requested move-in date is ${or(ctx.moveInDate)}.`,
      ``,
      `2. PROGRAM FEES`,
      `The Resident agrees to pay program fees of ${or(ctx.rent)}. Fees are due on the schedule communicated by the Residence. Non-payment may result in discharge.`,
      ``,
      `3. NATURE OF OCCUPANCY`,
      `The Resident understands this is a shared, supportive recovery environment and not a tenancy. Occupancy is contingent on continued sobriety and adherence to the House Rules, which are incorporated into this agreement by reference.`,
      ``,
      `4. TERMINATION`,
      `Either party may end this arrangement. The Residence may require the Resident to leave for relapse, violation of House Rules, non-payment, or behavior that endangers the community.`,
      ``,
      `5. PERSONAL PROPERTY`,
      `The Residence is not responsible for lost, stolen, or damaged personal property. Residents are encouraged to safeguard their belongings.`,
      ``,
      `By signing below, the Resident acknowledges they have read, understood, and agree to the terms of this agreement.`,
    ].join("\n"),
  };
}

function houseRules(ctx: DocContext): DocTemplate {
  return {
    type: "house_rules",
    title: "House Rules & Code of Conduct",
    body: [
      `${ctx.orgName.toUpperCase()}`,
      `HOUSE RULES & CODE OF CONDUCT`,
      ``,
      `Resident: ${or(ctx.residentName)}`,
      `House: ${or(ctx.houseName)}`,
      ``,
      `As a member of this recovery community, I agree to the following:`,
      ``,
      `1. SOBRIETY. I will remain free of alcohol and non-prescribed drugs. I consent to random drug and alcohol testing at any time.`,
      ``,
      `2. RESPECT. I will treat staff and fellow residents with dignity. Violence, threats, theft, and harassment are grounds for immediate discharge.`,
      ``,
      `3. CURFEW & PASSES. I will observe house curfew and request overnight passes in advance through the proper process.`,
      ``,
      `4. CHORES & PARTICIPATION. I will complete assigned chores and participate in house meetings and recovery activities.`,
      ``,
      `5. GUESTS. I will follow the guest policy and will not allow unauthorized visitors into the house.`,
      ``,
      `6. HONESTY. I will be honest with staff about my recovery, my whereabouts, and any struggles I am facing.`,
      ``,
      `7. MEDICATION. I will store and take medications only as prescribed and disclose all medications to staff.`,
      ``,
      `I understand that violating these rules may result in consequences up to and including discharge from the program.`,
    ].join("\n"),
  };
}

function consent(ctx: DocContext): DocTemplate {
  return {
    type: "consent",
    title: "Consent & Acknowledgment",
    body: [
      `${ctx.orgName.toUpperCase()}`,
      `CONSENT & ACKNOWLEDGMENT`,
      ``,
      `Resident: ${or(ctx.residentName)}`,
      `Date of birth: ${or(ctx.dateOfBirth)}`,
      `Email: ${or(ctx.email)}`,
      `Phone: ${or(ctx.phone)}`,
      `Emergency contact: ${or(ctx.emergencyContact)}`,
      ``,
      `1. CONSENT TO SERVICES. I voluntarily agree to participate in the recovery-housing program offered by ${ctx.orgName}.`,
      ``,
      `2. EMERGENCY CARE. In the event of a medical emergency, I authorize staff to seek appropriate medical assistance on my behalf.`,
      ``,
      `3. TESTING CONSENT. I consent to drug and alcohol testing as a condition of residency.`,
      ``,
      `4. RELEASE OF INFORMATION. I authorize ${ctx.orgName} to communicate with my listed emergency contact regarding my safety and status as needed.`,
      ``,
      `5. ACCURACY. I certify that the information I have provided is true and complete to the best of my knowledge.`,
      ``,
      `By signing below, I acknowledge that I have read and understood this consent form and sign it freely.`,
    ].join("\n"),
  };
}
