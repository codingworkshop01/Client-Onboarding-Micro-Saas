import type { Database } from "@/lib/supabase/types";

export type PlanTier = Database["public"]["Enums"]["plan_tier"];

export const PLANS: Record<PlanTier, {
  name: string;
  priceMonthly: number;
  tagline: string;
  activeRequests: number; // Infinity = unlimited
  aiGenerationsPerMonth: number;
  members: number;
  removeBranding: boolean;
  features: string[];
}> = {
  free: {
    name: "Free",
    priceMonthly: 0,
    tagline: "Try it with your next client",
    activeRequests: 3,
    aiGenerationsPerMonth: 5,
    members: 1,
    removeBranding: false,
    features: ["3 active onboardings", "All step types", "5 AI generations / month"],
  },
  solo: {
    name: "Solo",
    priceMonthly: 19,
    tagline: "For freelancers",
    activeRequests: 20,
    aiGenerationsPerMonth: 50,
    members: 1,
    removeBranding: false,
    features: ["20 active onboardings", "Custom branding", "Automatic reminders", "50 AI generations / month"],
  },
  agency: {
    name: "Agency",
    priceMonthly: 49,
    tagline: "For growing teams",
    activeRequests: Infinity,
    aiGenerationsPerMonth: 300,
    members: 5,
    removeBranding: true,
    features: ["Unlimited onboardings", "5 team members", "Remove our branding", "300 AI generations / month"],
  },
  scale: {
    name: "Scale",
    priceMonthly: 149,
    tagline: "White-label at scale",
    activeRequests: Infinity,
    aiGenerationsPerMonth: 2000,
    members: 25,
    removeBranding: true,
    features: ["Everything in Agency", "25 team members", "White-label portal", "Priority support"],
  },
};
