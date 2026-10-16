import { PageHeader } from "@/components/admin/PageHeader";
import { MarketingAssistant } from "@/components/admin/ai/MarketingAssistant";
import { requirePermission } from "@/lib/admin/guard";
import { aiStatus } from "@/lib/ai/provider";

export const metadata = { title: "AI marketing assistant" };

export default async function AssistantPage() {
  const ctx = await requirePermission("marketing");
  if (!ctx) return null;
  const { data } = await ctx.supabase.from("products").select("id, name").neq("status", "archived").order("name");
  return (
    <>
      <PageHeader eyebrow="Sales & marketing" title="AI marketing assistant"
        subtitle="Drafts captions, emails, launch sequences, product descriptions, CTAs, WhatsApp messages, audience ideas and UTM names. It writes from your real product details only, and never sends or publishes: generate → review → edit → save as a draft → you send or post it." />
      <MarketingAssistant products={(data ?? []) as { id: string; name: string }[]} available={aiStatus().configured && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)} />
    </>
  );
}
