/** What the AI marketing assistant can draft. Shared by the server action and the editor UI. */
export const MARKETING_TASKS = {
  campaign_ideas: "Campaign ideas",
  social_captions: "Social captions",
  email_campaign: "Email campaign",
  launch_sequence: "Launch email sequence",
  product_description: "Product description",
  cta_variations: "Call-to-action variations",
  whatsapp_copy: "WhatsApp message",
  audience_suggestions: "Audience suggestions",
  utm_names: "UTM campaign names",
} as const;
export type MarketingTask = keyof typeof MARKETING_TASKS;
