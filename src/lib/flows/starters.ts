import type { AccessPlatform, Field, FileCategory, Step } from "./schema";

/**
 * Starter templates. IDs here are stable placeholders; every step/field gets a
 * fresh id when a starter is copied into a workspace (see cloneStep).
 */
export type StarterTemplate = {
  key: string;
  name: string;
  category: string;
  description: string;
  steps: Step[];
};

let n = 0;
const id = (p: string) => `${p}${(++n).toString(36)}`;

function q(type: Field["type"], label: string, extra: Partial<Field> = {}): Field {
  return { id: id("f_"), type, label, required: false, ...extra };
}
function req(type: Field["type"], label: string, extra: Partial<Field> = {}): Field {
  return q(type, label, { required: true, ...extra });
}
function choice(type: "select" | "radio" | "checkbox", label: string, options: string[], extra: Partial<Field> = {}): Field {
  return q(type, label, { options: options.map((o) => ({ id: id("o_"), label: o })), ...extra });
}
function form(title: string, fields: Field[], description?: string): Step {
  return { id: id("s_"), type: "form", title, description, required: true, config: { fields } };
}
function files(title: string, items: [label: string, accept: FileCategory[], required?: boolean, description?: string][], description?: string): Step {
  return {
    id: id("s_"),
    type: "files",
    title,
    description,
    required: true,
    config: {
      items: items.map(([label, accept, required = true, desc]) => ({
        id: id("d_"),
        label,
        description: desc,
        accept,
        required,
        maxSizeMb: 25,
        multiple: true,
      })),
    },
  };
}
function access(platforms: AccessPlatform[], title = "Grant account access"): Step {
  return {
    id: id("s_"),
    type: "access",
    title,
    description: "We never ask for your passwords. Follow each guide to add us as a user, then confirm.",
    required: true,
    config: { items: platforms.map((platform) => ({ id: id("a_"), platform, required: true })) },
  };
}
function agreement(title: string, body: string): Step {
  return { id: id("s_"), type: "agreement", title: "Review & sign the agreement", required: true, config: { agreementTitle: title, body } };
}
function payment(amount: number, description: string, kind: "deposit" | "full" | "initial" = "deposit"): Step {
  return {
    id: id("s_"),
    type: "payment",
    title: kind === "deposit" ? "Pay your deposit" : "Complete your payment",
    required: true,
    config: { amountCents: amount * 100, currency: "usd", kind, description },
  };
}

const standardAgreement = (service: string) => `This ${service} Agreement ("Agreement") is entered into on {{date}} between {{workspace.name}} ("Provider") and {{client.company}} ("Client"), represented by {{client.name}} ({{client.email}}).

1. SCOPE OF SERVICES
Provider will perform the services described in the proposal or statement of work shared with Client. Changes to scope must be agreed in writing.

2. FEES AND PAYMENT
Client agrees to pay the fees set out in the proposal. Invoices are due within 14 days. A deposit may be required before work begins.

3. CLIENT RESPONSIBILITIES
Client will provide timely feedback, content, access and approvals. Delays in providing these may affect timelines.

4. INTELLECTUAL PROPERTY
On full payment, Client owns the final deliverables created specifically for Client. Provider keeps ownership of its pre-existing tools, know-how and materials, and may show the work in its portfolio unless Client objects in writing.

5. CONFIDENTIALITY
Each party will keep the other party's confidential information private and use it only to perform this Agreement.

6. TERM AND TERMINATION
Either party may end this Agreement with 14 days' written notice. Client will pay for work completed up to the termination date.

7. LIMITATION OF LIABILITY
Provider's total liability under this Agreement is limited to the fees paid by Client in the three months before the claim.

8. GENERAL
This Agreement is the entire agreement between the parties about its subject. It is governed by the laws of the Provider's place of business.`;

const kickoff = () =>
  form("Project kickoff", [
    req("text", "Primary contact name"),
    req("email", "Best email for project updates"),
    q("phone", "Phone number"),
    choice("radio", "Preferred communication channel", ["Email", "Slack", "Phone / video calls", "WhatsApp"], { required: true }),
    q("date", "Ideal launch or go-live date"),
  ]);

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    key: "web-design",
    name: "Web Design Agency",
    category: "Web design",
    description: "Brand assets, content, sitemap, hosting access, agreement and deposit for a new website.",
    steps: [
      (() => {
        const hasSite = choice("radio", "Do you have an existing website?", ["Yes", "No"], { required: true });
        return form("About your business & website", [
          req("text", "Business name"),
          hasSite,
          q("url", "Current website URL", { required: true, condition: { fieldId: hasSite.id, operator: "equals", value: "Yes" } }),
          q("textarea", "What do you dislike about your current website?", { condition: { fieldId: hasSite.id, operator: "equals", value: "Yes" } }),
          req("textarea", "Describe your ideal customer"),
          choice("checkbox", "Which pages do you need?", ["Home", "About", "Services", "Portfolio", "Blog", "Contact", "Shop", "Booking"]),
          req("textarea", "List 3 websites you like and why"),
          choice("select", "Estimated budget", ["Under $2,500", "$2,500–$5,000", "$5,000–$10,000", "$10,000+"]),
        ]);
      })(),
      files("Brand assets & content", [
        ["Logo files (vector preferred)", ["images", "design", "pdf"]],
        ["Brand guidelines", ["pdf", "documents"], false],
        ["Photos and imagery", ["images", "archives"], false],
        ["Website copy / content", ["documents", "pdf"], false],
      ]),
      access(["hosting_domain", "wordpress", "google_analytics"]),
      agreement("Website Design Agreement", standardAgreement("Website Design")),
      payment(1500, "50% project deposit"),
    ],
  },
  {
    key: "seo",
    name: "SEO Agency",
    category: "SEO",
    description: "Goals, competitors, keyword focus and access to Search Console, Analytics and the CMS.",
    steps: [
      form("SEO goals", [
        req("url", "Website URL"),
        req("textarea", "What are your main business goals for SEO?"),
        req("textarea", "Who are your top 3 competitors?"),
        q("textarea", "Keywords or topics you want to rank for"),
        choice("checkbox", "Target markets", ["Local", "National", "International"], { required: true }),
        q("text", "Target cities or regions", { description: "If you serve local customers" }),
        choice("radio", "Have you done SEO work before?", ["Yes", "No"]),
      ]),
      access(["google_search_console", "google_analytics", "wordpress"]),
      files("Previous reports", [["Past SEO or analytics reports", ["pdf", "spreadsheets"], false]]),
      agreement("SEO Services Agreement", standardAgreement("SEO Services")),
      payment(750, "First month retainer", "initial"),
    ],
  },
  {
    key: "ppc",
    name: "PPC Agency",
    category: "Paid ads",
    description: "Ad goals, budget, conversion tracking and access to Google Ads, Meta and Analytics.",
    steps: [
      form("Advertising goals", [
        req("url", "Website or landing page URL"),
        choice("checkbox", "Which platforms should we manage?", ["Google Ads", "Meta (Facebook/Instagram)", "LinkedIn", "TikTok", "Microsoft Ads"], { required: true }),
        req("number", "Monthly ad spend budget (USD)", { min: 0 }),
        req("textarea", "What counts as a conversion for you?"),
        q("text", "Target cost per lead / ROAS"),
        q("textarea", "Locations and audiences to target"),
      ]),
      access(["google_ads", "meta_business", "google_analytics"]),
      files("Creative assets", [["Existing ad creatives", ["images", "video", "archives"], false], ["Brand guidelines", ["pdf"], false]]),
      agreement("PPC Management Agreement", standardAgreement("PPC Management")),
      payment(1000, "Setup fee", "initial"),
    ],
  },
  {
    key: "social-media",
    name: "Social Media Agency",
    category: "Social media",
    description: "Brand voice, content pillars, posting preferences and Meta access.",
    steps: [
      form("Brand voice & goals", [
        req("text", "Brand name"),
        choice("checkbox", "Which channels do you want us to manage?", ["Instagram", "Facebook", "LinkedIn", "TikTok", "X / Twitter", "YouTube", "Pinterest"], { required: true }),
        req("textarea", "Describe your brand voice in a few words"),
        q("textarea", "Topics we should never post about"),
        choice("select", "Posting frequency", ["3× per week", "5× per week", "Daily", "Not sure yet"]),
        q("textarea", "Accounts you admire and why"),
      ]),
      files("Brand assets", [["Logo", ["images", "design"]], ["Product / team photos", ["images", "archives"], false], ["Brand guidelines", ["pdf"], false]]),
      access(["meta_business", "facebook_page"]),
      agreement("Social Media Management Agreement", standardAgreement("Social Media Management")),
      payment(900, "First month", "initial"),
    ],
  },
  {
    key: "branding",
    name: "Branding & Design",
    category: "Branding",
    description: "Discovery questionnaire, mood references and design agreement for brand identity work.",
    steps: [
      form("Brand discovery", [
        req("text", "Company name"),
        q("text", "Tagline (if any)"),
        req("textarea", "What does your company do, in one or two sentences?"),
        req("textarea", "Who is your audience?"),
        choice("checkbox", "Which words describe the personality you want?", ["Bold", "Friendly", "Premium", "Playful", "Minimal", "Trustworthy", "Innovative", "Traditional"]),
        q("textarea", "Colours you love or want to avoid"),
        req("textarea", "Competitor brands and how you want to stand apart"),
      ]),
      files("References", [["Existing logo or brand materials", ["images", "pdf", "design"], false], ["Mood board / inspiration", ["images", "pdf", "archives"], false]]),
      agreement("Brand Design Agreement", standardAgreement("Brand Design")),
      payment(1200, "Project deposit"),
    ],
  },
  {
    key: "video",
    name: "Video Production",
    category: "Video",
    description: "Production brief, shoot logistics, footage handover and agreement.",
    steps: [
      (() => {
        const shoot = choice("radio", "Will this require an on-site shoot?", ["Yes", "No"], { required: true });
        return form("Production brief", [
          choice("select", "Type of video", ["Brand film", "Product video", "Testimonial", "Social clips", "Event", "Explainer / animation"], { required: true }),
          req("textarea", "What is the key message?"),
          req("text", "Desired length"),
          shoot,
          q("text", "Shoot location address", { required: true, condition: { fieldId: shoot.id, operator: "equals", value: "Yes" } }),
          q("date", "Preferred shoot date", { condition: { fieldId: shoot.id, operator: "equals", value: "Yes" } }),
          q("date", "Final delivery deadline"),
        ]);
      })(),
      files("Assets", [["Logo & brand assets", ["images", "design", "pdf"]], ["Existing footage or music", ["video", "audio", "archives"], false], ["Script or storyboard", ["documents", "pdf"], false]]),
      agreement("Video Production Agreement", standardAgreement("Video Production")),
      payment(2000, "Pre-production deposit"),
    ],
  },
  {
    key: "software",
    name: "Software Development",
    category: "Development",
    description: "Requirements, tech stack, repository access and a development agreement.",
    steps: [
      form("Project requirements", [
        req("text", "Project name"),
        req("textarea", "What problem should the software solve?"),
        req("textarea", "Must-have features for the first release"),
        choice("checkbox", "Platforms", ["Web app", "iOS", "Android", "Desktop", "API / backend"], { required: true }),
        q("textarea", "Existing systems we must integrate with"),
        q("text", "Preferred tech stack (if any)"),
        q("date", "Target launch date"),
      ]),
      files("Specifications", [["Specs, wireframes or designs", ["pdf", "images", "design", "documents"], false]]),
      access(["hosting_domain", "other"], "Grant repository & hosting access"),
      agreement("Software Development Agreement", standardAgreement("Software Development")),
      payment(2500, "Milestone 1 deposit"),
    ],
  },
  {
    key: "freelancer",
    name: "Freelancer Essentials",
    category: "Freelance",
    description: "A lean flow: short brief, files, contract and deposit.",
    steps: [
      form("Project brief", [
        req("text", "Your name"),
        q("text", "Company"),
        req("textarea", "What do you need help with?"),
        q("date", "Deadline"),
        q("textarea", "Anything else I should know?"),
      ]),
      files("Files", [["Any files I'll need", ["any"], false]]),
      agreement("Freelance Services Agreement", standardAgreement("Freelance Services")),
      payment(300, "Deposit"),
    ],
  },
  {
    key: "consulting",
    name: "Consulting",
    category: "Consulting",
    description: "Discovery questionnaire, background documents, engagement letter and retainer.",
    steps: [
      form("Discovery", [
        req("text", "Organisation"),
        req("text", "Your role"),
        req("textarea", "What challenge would you like help with?"),
        req("textarea", "What does success look like in 90 days?"),
        choice("select", "Team size", ["1–10", "11–50", "51–200", "200+"]),
        q("textarea", "Stakeholders who should be involved"),
      ]),
      files("Background documents", [["Strategy decks, reports or data", ["pdf", "presentations", "spreadsheets", "documents"], false]]),
      agreement("Consulting Engagement Letter", standardAgreement("Consulting Engagement")),
      payment(1500, "Retainer", "initial"),
    ],
  },
  {
    key: "general",
    name: "General Business",
    category: "General",
    description: "A flexible starting point: contact details, files and agreement.",
    steps: [
      kickoff(),
      files("Documents", [["Relevant documents", ["any"], false]]),
      agreement("Services Agreement", standardAgreement("Services")),
    ],
  },
];

export function getStarter(key: string) {
  return STARTER_TEMPLATES.find((t) => t.key === key);
}
