/**
 * Shared electronic-signature constants. Kept free of server-only imports so
 * both the signing UI and the server-side signing record use the exact same
 * consent language — the wording a signer agreed to must match what we store.
 */

export const SIGNING_CONSENT =
  "I have read and agree to this document. By typing my full legal name and clicking Sign, I am creating a legally binding electronic signature under the U.S. ESIGN Act and applicable state law (UETA). I consent to sign and receive this record electronically, and I agree it has the same legal effect as a handwritten signature on paper.";
