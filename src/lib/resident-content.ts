/**
 * Catalog of resident-facing policy documents.
 *
 * Each entry has starting text modeled on the NARR Standard 3.0 domains
 * (rights, operations, recovery support, good neighbor). These are STARTING
 * POINTS, not legal advice — an operator is expected to edit them at
 * /app/content and have them reviewed before publishing.
 */

export type ContentDefinition = {
  slug: string;
  /** Resident-facing heading. */
  title: string;
  /** Staff-facing explanation of why this document exists. */
  purpose: string;
  defaultBody: string;
};

export const RESIDENT_CONTENT: ContentDefinition[] = [
  {
    slug: "house_rules",
    title: "House Rules",
    purpose:
      "The day-to-day expectations every resident agrees to. NARR requires these to be written, provided at intake, and applied consistently.",
    defaultBody: `These rules exist to keep this home safe and supportive for everyone living here. They are applied the same way to every resident.

SUBSTANCE USE
- No alcohol or illicit drugs on the property or in your system.
- No drug paraphernalia.
- Prescription medication must be current, in the original labeled container, and prescribed to you.
- Drug and alcohol testing may be requested at any time, including randomly and for cause.

RESPECT AND SAFETY
- No violence, threats, intimidation, or harassment of any kind.
- No weapons of any kind on the property.
- No stealing or borrowing without permission.
- Respect other residents' privacy, property, and recovery.
- Discrimination or harassment based on race, sex, gender identity, sexual orientation, religion, disability, or recovery pathway is not tolerated.

RECOVERY PARTICIPATION
- Attend the required number of recovery support meetings each week and keep documentation.
- Participate in scheduled house meetings.
- Work with your recovery plan and update it with staff as things change.

HOUSEHOLD LIFE
- Complete your assigned chores on time.
- Keep your room and shared areas clean.
- Quiet hours and curfew are posted in the House Information section of this app.
- Guests must be approved in advance and are not permitted in bedrooms.
- Overnight absences must be approved in advance.

FINANCIAL
- Program fees are due on the schedule described in the Fees & Refunds policy.
- Talk to staff BEFORE you fall behind. We would much rather make a plan with you.

If you break a rule, you will be told what happened, what the consequence is, and what you can do about it. Serious safety violations may result in immediate discharge. See the Grievances & Complaints policy if you disagree with a decision.`,
  },
  {
    slug: "resident_rights",
    title: "Your Rights",
    purpose:
      "A written statement of resident rights. This is a core NARR requirement and should be given to every resident at intake.",
    defaultBody: `Living here does not mean giving up your rights. As a resident of this recovery residence, you have the right to:

- Be treated with dignity and respect at all times.
- A safe, clean, and healthy living environment.
- Be free from discrimination based on race, color, national origin, sex, gender identity, sexual orientation, religion, age, disability, source of income, or recovery pathway.
- Choose your own path of recovery, including the use of FDA-approved medication for addiction treatment.
- Privacy in your personal information, and to know who your information is shared with and why.
- Know the rules, the fees, and the possible consequences before you agree to live here.
- Reasonable accommodation for a disability.
- Have visitors and communicate with family and supports, within the posted house rules.
- Keep and control your own money, identification, and personal property.
- Voice a complaint or grievance without fear of retaliation, and to have it taken seriously.
- Receive written notice of the reason for a discharge and information about how to appeal it.
- Access community resources, medical care, legal help, and outside recovery support.
- Refuse to participate in research, fundraising, publicity, or photographs.

If you believe any of these rights have been violated, use the Grievances & Complaints process. You will not be punished for raising a concern.`,
  },
  {
    slug: "grievance_procedure",
    title: "Grievances & Complaints",
    purpose:
      "How a resident raises a concern and escalates it, including a path that bypasses the person being complained about. Required by NARR.",
    defaultBody: `If something is wrong, we want to hear it. Raising a concern is never a rule violation, and retaliation against anyone who files a grievance is itself a serious violation.

STEP 1 - TALK TO STAFF
Bring the concern to your house manager, in person or in writing. Most issues are resolved here. You should get a response within 3 business days.

STEP 2 - PUT IT IN WRITING
If it is not resolved, or if your concern is ABOUT your house manager, submit it in writing directly to the program director or owner. You may skip Step 1 entirely in that situation. Contact information is in the Support section of this app.
You should receive a written response within 10 business days describing the decision and the reason for it.

STEP 3 - OUTSIDE REVIEW
If you are still not satisfied, you may contact our state recovery residence affiliate or certifying body, or any regulatory agency you choose. We will not interfere with or discourage this.

[EDIT THIS: add the name, phone, and email of your state NARR affiliate here.]

DISCHARGE APPEALS
If you are discharged, you have the right to a written reason and to appeal it using Step 2 above. Filing an appeal does not, by itself, delay a discharge required for the immediate safety of the house.

CONFIDENTIALITY
Grievances are shared only with the people who need to be involved in resolving them. Anonymous complaints are accepted, though they can be harder to act on.`,
  },
  {
    slug: "relapse_policy",
    title: "Relapse & Return to Use",
    purpose:
      "What actually happens after a return to use. Being explicit here reduces the fear that keeps people from asking for help early.",
    defaultBody: `Recovery is not always a straight line. A return to use is treated as a health event, not a moral failure — but it does affect everyone living here, so it has to be addressed honestly.

IF YOU ARE STRUGGLING, TELL US FIRST
If you come to staff before a positive test or an incident, we will work with you on a plan. Asking for help is always treated more favorably than being found out.

WHAT HAPPENS AFTER A RETURN TO USE
1. Safety first. If you may be at risk of overdose or withdrawal, we address that before anything else.
2. A conversation, not an interrogation. We talk about what happened and what you need.
3. A written plan. This may include increased meeting attendance, a clinical assessment, a higher level of care, more frequent testing, or a change in privileges.
4. A decision about continued residency, based on your safety, your willingness to engage, and the safety of the other residents.

WHEN SOMEONE CANNOT STAY
Sometimes the right answer is a higher level of care. If you cannot remain here, we will:
- Give you the reason in writing.
- Help connect you to detox, treatment, or another safe option.
- Not leave you on the street without a documented attempt at a safe transition.
- Tell you whether and when you may reapply.

OVERDOSE
Call 911 first. Always. Iowa's Good Samaritan protections and this house's policy both protect a resident who seeks emergency help for themselves or someone else. You will not be discharged for calling 911 to save a life.

Naloxone locations are listed in the House Information section.`,
  },
  {
    slug: "medication_policy",
    title: "Medication Policy",
    purpose:
      "Storage, self-administration, and — critically — non-discrimination against residents using medication for addiction treatment.",
    defaultBody: `MEDICATION-ASSISTED RECOVERY IS WELCOME HERE
Residents using FDA-approved medication for opioid or alcohol use disorder — including methadone, buprenorphine (Suboxone), and naltrexone (Vivitrol) — are welcome. Taking prescribed medication is not a relapse and does not make you "not sober." No resident or staff member may pressure you to reduce or stop a prescribed medication. That decision belongs to you and your prescriber.

YOUR RESPONSIBILITIES
- Medication must be prescribed to you and stay in its original labeled container.
- Tell staff what you are prescribed so we can respond correctly in an emergency.
- Store controlled medication in the locked storage provided. Ask staff if you need access.
- Take your own medication yourself. Staff here do not administer or dispense medication.
- Never share, sell, or accept medication from another person. This is a serious safety violation.
- Keep your own appointments and refills.

OVER-THE-COUNTER PRODUCTS
Avoid products containing alcohol (some cough syrups and mouthwashes) and anything intended to produce intoxication. Ask staff if you are unsure.

DISPOSAL
Expired or discontinued medication should be disposed of properly. Ask staff for the nearest take-back location.

This residence does not provide clinical or medical services. Nothing here replaces advice from your prescriber.`,
  },
  {
    slug: "privacy_confidentiality",
    title: "Privacy & Confidentiality",
    purpose:
      "What we collect, who sees it, and the rules residents must follow about each other's privacy.",
    defaultBody: `YOUR INFORMATION
We collect only what we need to operate the residence safely: contact details, emergency contacts, funding information, and records related to your stay.

WHO SEES IT
- Staff who need it to do their job.
- Anyone you give us written permission to share with.
- A referral source, court, or funder only where you have signed a release or where the law requires it.
- Emergency responders, if your life or someone else's is at risk.

We do not sell your information. We do not share it with landlords, employers, or family without your written permission.

YOUR RESPONSIBILITIES TO OTHERS
What you see and hear here stays here. Specifically:
- Do not share another resident's name, photo, story, or status with anyone outside the house.
- No photos or video inside the residence without the consent of everyone in them.
- Do not post about the house, its location, or its residents on social media.
- Do not confirm or deny to an outside caller that a specific person lives here.

This protects people whose jobs, custody arrangements, or safety could be affected by being identified.

YOUR RIGHTS
You may ask to see your own records, ask us to correct something inaccurate, and withdraw a release you previously signed.`,
  },
  {
    slug: "good_neighbor",
    title: "Good Neighbor Policy",
    purpose:
      "How the house behaves within the neighborhood. NARR expects an active good-neighbor commitment.",
    defaultBody: `This is a home in a residential neighborhood, and we intend to be a good neighbor. How we act in public shapes whether recovery housing is welcome in this community at all.

WHAT WE ASK OF YOU
- Keep noise down outside, especially at night and early morning.
- No loitering, gathering, or smoking in the front yard, on sidewalks, or in the street.
- Smoke only in the designated area listed in House Information. Use the receptacle provided.
- Park only where residents are permitted to park. Never block a neighbor's driveway or mailbox.
- Keep the yard, porch, and trash area clean. Bring bins in the same day.
- Be courteous to neighbors. A greeting costs nothing and does a great deal of good.
- No loud music or vehicle noise. Close car doors quietly late at night.

VISITORS
Approved guests follow these same expectations. You are responsible for your guest's behavior.

NEIGHBOR CONCERNS
Neighbors may contact the house directly using the phone number in the Support section. Concerns are documented and addressed promptly, and we will tell a neighbor what we did about it.`,
  },
  {
    slug: "fees_policy",
    title: "Fees & Refunds",
    purpose:
      "What residents pay, when, and what happens if they cannot. Fee transparency is a NARR requirement.",
    defaultBody: `[EDIT THIS DOCUMENT — the amounts below are placeholders.]

WHAT YOU PAY
- Program fee: $[amount] per [week/month], due on [day].
- Move-in deposit: $[amount], refundable as described below.
- There are no other required fees. Any optional charge will be explained and agreed to in writing first.

HOW TO PAY
[Describe accepted payment methods and where to pay.] You will receive a receipt for every payment. Ask for one if you do not.

IF YOU CANNOT PAY
Talk to staff BEFORE the due date. We would rather build a written payment plan with you than lose you over money. Hardship arrangements are available and are decided consistently, not case by case based on who asks.

Falling behind is not, by itself, an immediate discharge. You will receive written notice and a reasonable opportunity to make an arrangement.

REFUNDS
- Deposit: returned within [X] days of move-out, minus documented damage beyond normal wear and any unpaid fees. You get an itemized list of anything withheld.
- Prepaid fees: unused full [weeks/months] paid in advance are refunded on a pro-rated basis, including when a resident is discharged.
- Nonrefundable amounts, if any, are listed here: [list them or write "none"].

DISPUTES
If you believe a charge is wrong, use the Grievances & Complaints process. Bring your receipts.`,
  },
];

export function contentDefinition(slug: string) {
  return RESIDENT_CONTENT.find((c) => c.slug === slug) ?? null;
}
