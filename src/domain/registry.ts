import type { DomainProfile } from "./validator.js";
import { createDomainProfile } from "./validator.js";

const OFF_TOPIC_OUTPUT_PATTERNS: RegExp[] = [
  /^as an ai/i,
  /^i'?m not able to (?:help|assist) with that/i,
  /^(?:sorry|i apologize).*(?:outside|beyond) (?:my|the) (?:scope|domain)/i,
];

export const DOMAIN_PROFILES: Record<string, DomainProfile> = {
  ecommerce: createDomainProfile({
    id: "ecommerce",
    name: "E-commerce Support",
    description:
      "Product catalog, orders, shipping, returns, refunds, and store policies",
    systemPrompt:
      "You are an e-commerce customer support assistant. Answer ONLY using the provided context about products, orders, shipping, returns, refunds, payments, and store policies. Never invent order details or policies not in the context.",
    allowedKeywords: [
      "order",
      "product",
      "shipping",
      "delivery",
      "return",
      "refund",
      "track",
      "payment",
      "cart",
      "item",
      "package",
      "exchange",
      "warranty",
      "invoice",
      "store",
    ],
    forbiddenKeywords: [
      "weather",
      "politics",
      "recipe",
      "medical",
      "diagnosis",
      "legal advice",
      "stock market",
      "cryptocurrency",
    ],
    forbiddenOutputPatterns: OFF_TOPIC_OUTPUT_PATTERNS,
    refuseMessage:
      "I can only help with orders, products, shipping, and returns. Please ask a store-related question.",
    strictKeywordCheck: false,
  }),
  healthcare: createDomainProfile({
    id: "healthcare",
    name: "Healthcare Admin",
    description:
      "Appointments, billing, insurance claims, and clinic policies — not medical diagnosis",
    systemPrompt:
      "You are a healthcare administration assistant. Help ONLY with appointments, billing, insurance, claims, and clinic policies from the provided context. NEVER provide medical diagnosis, treatment advice, or medication recommendations.",
    allowedKeywords: [
      "appointment",
      "billing",
      "insurance",
      "claim",
      "copay",
      "invoice",
      "schedule",
      "clinic",
      "patient portal",
      "coverage",
      "deductible",
    ],
    forbiddenKeywords: [
      "diagnose",
      "prescribe",
      "dosage",
      "symptom treatment",
      "weather",
      "recipe",
      "investment",
    ],
    forbiddenOutputPatterns: [
      ...OFF_TOPIC_OUTPUT_PATTERNS,
      /\b(?:you should take|i recommend (?:taking|using))\b/i,
      /\b(?:diagnos(?:is|e)|prescri(?:be|ption))\b/i,
    ],
    refuseMessage:
      "I can only help with appointments, billing, and insurance questions. I cannot provide medical advice.",
    strictKeywordCheck: false,
  }),
};

export function getDomainProfile(domainId: string): DomainProfile | undefined {
  return DOMAIN_PROFILES[domainId];
}

export function registerDomainProfile(profile: DomainProfile): void {
  DOMAIN_PROFILES[profile.id] = profile;
}
