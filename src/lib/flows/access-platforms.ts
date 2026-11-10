import type { AccessPlatform } from "./schema";

/**
 * Platform-specific instructions for granting an agency access WITHOUT sharing
 * passwords. `{{email}}` is replaced with the agency's access email.
 * Menu names change over time; each guide links to the platform's own help page.
 */
export type PlatformGuide = {
  name: string;
  short: string;
  steps: string[];
  helpUrl: string;
};

export const ACCESS_PLATFORM_GUIDES: Record<AccessPlatform, PlatformGuide> = {
  meta_business: {
    name: "Meta Business Manager",
    short: "Add us as a partner in Business Settings",
    steps: [
      "Go to business.facebook.com and open Business Settings.",
      "Under Users, select Partners and click Add → Give a partner access to your assets.",
      "Enter our Business ID (we'll share it with you) or invite {{email}}.",
      "Choose the assets (Pages, ad accounts, pixels) and grant the access level we requested.",
      "Click Save, then confirm below.",
    ],
    helpUrl: "https://www.facebook.com/business/help/1717412048538897",
  },
  facebook_page: {
    name: "Facebook Page",
    short: "Give us task access to your Page",
    steps: [
      "Open your Facebook Page and switch into it.",
      "Go to Settings → New Pages Experience (or Page access).",
      "Click Add New next to 'People with Facebook access'.",
      "Search for {{email}} and allow the requested permissions.",
      "Confirm with your password if prompted, then confirm below.",
    ],
    helpUrl: "https://www.facebook.com/help/187316341316631",
  },
  google_analytics: {
    name: "Google Analytics",
    short: "Add a user in Admin → Access management",
    steps: [
      "Sign in at analytics.google.com and click Admin (gear icon).",
      "Under Account or Property, open Access management.",
      "Click + → Add users and enter {{email}}.",
      "Select the Editor role (or the role we asked for) and click Add.",
    ],
    helpUrl: "https://support.google.com/analytics/answer/9305788",
  },
  google_ads: {
    name: "Google Ads",
    short: "Invite us under Admin → Access and security",
    steps: [
      "Sign in at ads.google.com.",
      "Click Admin → Access and security.",
      "Click + and enter {{email}}, choosing Standard access.",
      "Send the invitation, or accept our manager-account link request if we sent one.",
    ],
    helpUrl: "https://support.google.com/google-ads/answer/6372672",
  },
  google_search_console: {
    name: "Google Search Console",
    short: "Add a user under Settings → Users and permissions",
    steps: [
      "Open search.google.com/search-console and select your property.",
      "Go to Settings → Users and permissions.",
      "Click Add user, enter {{email}} and choose Full permission.",
    ],
    helpUrl: "https://support.google.com/webmasters/answer/7687615",
  },
  wordpress: {
    name: "WordPress",
    short: "Create an Administrator user for us",
    steps: [
      "Log in to your WordPress dashboard (yoursite.com/wp-admin).",
      "Go to Users → Add New User.",
      "Use {{email}} as the email address and choose the Administrator role.",
      "Tick 'Send the new user an email' so we set our own password. Never send us yours.",
    ],
    helpUrl: "https://wordpress.org/documentation/article/users-add-new-screen/",
  },
  shopify: {
    name: "Shopify",
    short: "Accept our collaborator request",
    steps: [
      "We'll send a collaborator request from our Shopify Partner account.",
      "In Shopify admin, go to Settings → Users and permissions.",
      "Under Collaborators, review the pending request and click Accept.",
      "If you prefer, add {{email}} as a staff member with the permissions we need.",
    ],
    helpUrl: "https://help.shopify.com/en/manual/your-account/users/security/collaborator-accounts",
  },
  hosting_domain: {
    name: "Hosting & domain",
    short: "Add us as a delegate/team member at your provider",
    steps: [
      "Log in to your hosting or domain provider (e.g. GoDaddy, Namecheap, Cloudflare, SiteGround).",
      "Find Team, Delegate access, or Users in your account settings.",
      "Invite {{email}} with access to the relevant domain or hosting plan.",
      "If your provider has no delegate access, tell us in the comments and we'll arrange a secure handover. Do not paste passwords here.",
    ],
    helpUrl: "https://www.cloudflare.com/learning/",
  },
  other: {
    name: "Other platform",
    short: "Follow the instructions from your project lead",
    steps: ["Follow the instructions below, then confirm once access has been granted."],
    helpUrl: "",
  },
};

export function renderGuideSteps(platform: AccessPlatform, email?: string) {
  const who = email?.trim() || "our team email";
  return ACCESS_PLATFORM_GUIDES[platform].steps.map((s) => s.replaceAll("{{email}}", who));
}
