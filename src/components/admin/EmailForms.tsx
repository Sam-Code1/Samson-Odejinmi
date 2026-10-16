"use client";

import { useRef, useState, useTransition } from "react";
import { countAudience, saveEmailCampaign, saveSegment } from "@/app/admin/actions/marketing";
import { LIFECYCLES, PRESETS, type SegmentDefinition } from "@/lib/marketing/segments";
import { AdminForm } from "./AdminForm";
import { FormSection, SelectInput, TextAreaInput, TextInput } from "./FormFields";

/** Audience rules + a live count (numbers only). Used by saved audiences and by email campaigns. */
export function AudienceFields({ def, allowSegment, segments, segmentId }: { def?: Partial<SegmentDefinition>; allowSegment?: boolean; segments?: { id: string; name: string }[]; segmentId?: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [useSaved, setUseSaved] = useState(Boolean(segmentId));
  const [count, setCount] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const check = () => start(async () => {
    const box = ref.current;
    if (!box) return;
    const fd = new FormData();
    box.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-aud]").forEach((el) => fd.set(el.name, el.value));
    const r = await countAudience(fd);
    setCount(r.ok ? `${r.total} ${r.total === 1 ? "person" : "people"} match · ${r.marketable} can receive marketing email` : r.error);
  });
  return (
    <div ref={ref} className="space-y-5 sm:col-span-2">
      {allowSegment && segments && segments.length > 0 && (
        <SelectInput label="Audience" name="segment_id" defaultValue={segmentId ?? ""} onChange={(e) => setUseSaved(Boolean(e.target.value))}
          options={[{ value: "", label: "Custom rules (below)" }, ...segments.map((s) => ({ value: s.id, label: `Saved: ${s.name}` }))]} />
      )}
      {!useSaved && (
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectInput label="Who" name="preset" data-aud="1" defaultValue={def?.preset ?? "all_subscribers"} options={Object.entries(PRESETS).map(([value, label]) => ({ value, label }))} />
          <SelectInput label="Lifecycle (optional)" name="lifecycle" data-aud="1" defaultValue={def?.lifecycle ?? ""} options={[{ value: "", label: "Any" }, ...Object.entries(LIFECYCLES).map(([value, label]) => ({ value, label }))]} />
          <TextInput label="With any of these tags (optional)" name="tags_any" data-aud="1" defaultValue={def?.tags_any?.join(", ") ?? ""} placeholder="ebook-buyer, vip" />
          <TextInput label="Without these tags (optional)" name="tags_none" data-aud="1" defaultValue={def?.tags_none?.join(", ") ?? ""} placeholder="abandoned" />
        </div>
      )}
      {!useSaved && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={check} disabled={pending} className="h-9 rounded border border-line-strong px-3 text-label hover:border-ink disabled:opacity-60">{pending ? "Counting…" : "Count audience"}</button>
          {count && <span role="status" className="text-body-sm text-ink-2">{count}</span>}
        </div>
      )}
      <p className="text-caption text-ink-3">Emails only ever go to people who opted in, haven&apos;t unsubscribed and whose address isn&apos;t bouncing.</p>
    </div>
  );
}

export function SegmentForm() {
  return (
    <AdminForm action={saveSegment} submitLabel="Save audience" stickyBar={false}>
      <FormSection title="New audience" description="Saved rules, evaluated live each time (nobody is copied into a list).">
        <TextInput label="Name" name="name" required maxLength={80} />
        <TextInput label="Description (optional)" name="description" maxLength={300} />
        <AudienceFields />
      </FormSection>
    </AdminForm>
  );
}

export type EmailRow = {
  id: string; name: string; subject: string; preview_text: string | null; from_name: string | null; body: string; segment_id: string | null;
  audience: Partial<SegmentDefinition>; campaign_id: string | null; status: string;
};

export function EmailCampaignForm({ e, segments, campaigns, prefill }: {
  e?: EmailRow; segments: { id: string; name: string }[]; campaigns: { id: string; name: string }[]; prefill?: { name?: string; subject?: string; body?: string };
}) {
  const locked = e && !["draft", "scheduled"].includes(e.status);
  return (
    <AdminForm action={saveEmailCampaign} submitLabel={e ? "Save draft" : "Create draft"}>
      {e && <input type="hidden" name="emailId" value={e.id} />}
      {prefill && <input type="hidden" name="ai_assisted" value="1" />}
      <fieldset disabled={locked} className="space-y-6 disabled:opacity-70">
        <FormSection title="Message" description="Plain text: a blank line starts a paragraph, **bold**, [label](https://link), lines starting with “- ” become a list, {{first_name}} is the person's first name. An unsubscribe link is added automatically.">
          <TextInput label="Internal name" name="name" required defaultValue={e?.name ?? prefill?.name ?? ""} maxLength={120} />
          <TextInput label="From name (optional)" name="from_name" defaultValue={e?.from_name ?? ""} maxLength={60} placeholder="Fola from Fola Academy" />
          <TextInput label="Subject" name="subject" required defaultValue={e?.subject ?? prefill?.subject ?? ""} maxLength={160} className="sm:col-span-2" />
          <TextInput label="Preview text (optional)" name="preview_text" defaultValue={e?.preview_text ?? ""} maxLength={200} className="sm:col-span-2" hint="The grey line inboxes show after the subject." />
          <TextAreaInput label="Body" name="body" rows={14} required defaultValue={e?.body ?? prefill?.body ?? "Hi {{first_name}},\n\n"} maxLength={30000} className="sm:col-span-2" />
        </FormSection>
        <FormSection title="Audience">
          <AudienceFields allowSegment segments={segments} segmentId={e?.segment_id} def={e?.audience} />
          <SelectInput label="Marketing campaign (optional)" name="campaign_id" defaultValue={e?.campaign_id ?? ""} options={[{ value: "", label: "None" }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))]} />
        </FormSection>
      </fieldset>
    </AdminForm>
  );
}
