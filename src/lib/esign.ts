/**
 * Electronic signature disclosure shown before signing and stored verbatim
 * with every signature. Deliberately does not claim universal legal validity:
 * enforceability depends on jurisdiction and document type.
 */
export function esignConsentText(agencyName: string) {
  return `I agree to use an electronic signature for this agreement and intend it to have the same effect as my handwritten signature, to the extent permitted by applicable law. I confirm I have read the agreement above and am authorised to sign it. I understand I can download a copy after signing and may request a paper copy from ${agencyName}.`;
}

export const ESIGN_DISCLOSURE =
  "Electronic signatures are recognised in many countries (for example under the US ESIGN Act and the EU eIDAS regulation), but some documents and jurisdictions have additional requirements. If you're unsure, ask your own legal adviser before signing.";
