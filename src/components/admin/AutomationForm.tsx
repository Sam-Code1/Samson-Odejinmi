"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { saveAutomation } from "@/app/admin/actions/marketing";
import { CONDITIONS, MAX_STEPS, TRIGGERS, describeStep, type Step } from "@/lib/marketing/steps";
import { AdminForm } from "./AdminForm";
import { FormSection, SelectInput, TextInput } from "./FormFields";
import { useFieldError } from "./FormContext";

type Opt = { id: string; name: string };
const field = "w-full min-w-0 rounded border border-line-strong bg-transparent px-3 text-body-sm focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30";

const blank = (type: Step["type"]): Step =>
  type === "send_email" ? { type, subject: "", body: "Hi {{first_name}},\n\n" }
  : type === "wait" ? { type, hours: 48 }
  : type === "condition" ? { type, check: "consented", skip: 0 }
  : { type, tag: "" };

function StepsError() {
  const e = useFieldError("steps");
  return e ? <p role="alert" className="border-l-2 border-warm pl-3 text-body-sm sm:col-span-2">{e}</p> : null;
}

/** Steps run top to bottom. A condition can only skip forward, so an automation can never loop. */
export function AutomationForm({ a, products, courses }: { a?: { id: string; name: string; trigger_event: string; steps: Step[] }; products: Opt[]; courses: Opt[] }) {
  const [steps, setSteps] = useState<Step[]>(a?.steps?.length ? a.steps : [{ type: "add_tag", tag: "" }]);
  const set = (i: number, s: Step) => setSteps((all) => all.map((x, j) => (j === i ? s : x)));
  const move = (i: number, d: -1 | 1) => setSteps((all) => { const n = [...all]; const j = i + d; if (j < 0 || j >= n.length) return all; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const names = Object.fromEntries([...products, ...courses].map((o) => [o.id, o.name]));

  return (
    <AdminForm action={saveAutomation} submitLabel={a ? "Save automation" : "Create automation"}>
      {a && <input type="hidden" name="automationId" value={a.id} />}
      <input type="hidden" name="steps" value={JSON.stringify(steps)} />
      <FormSection title="Automation">
        <TextInput label="Name" name="name" required defaultValue={a?.name ?? ""} maxLength={120} />
        <SelectInput label="Starts when" name="trigger_event" defaultValue={a?.trigger_event ?? "ebook_purchased"} options={Object.entries(TRIGGERS).map(([value, label]) => ({ value, label }))} />
      </FormSection>
      <FormSection title="Steps" description={`Up to ${MAX_STEPS}. Emails only go to people who opted in to marketing (others skip that step). A person goes through an automation once per triggering event.`}>
        <StepsError />
        <ol className="space-y-4 sm:col-span-2">
          {steps.map((s, i) => (
            <li key={i} className="rounded-lg border border-line bg-canvas p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-caption tabular-nums text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                <select aria-label={`Step ${i + 1} type`} value={s.type} onChange={(e) => set(i, blank(e.target.value as Step["type"]))} className={`${field} h-9 w-auto`}>
                  <option value="send_email">Send email</option><option value="add_tag">Add tag</option><option value="remove_tag">Remove tag</option>
                  <option value="wait">Wait</option><option value="condition">Condition</option>
                </select>
                <span className="ml-auto flex gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move step ${i + 1} up`} className="grid h-9 w-9 place-items-center rounded hover:bg-surface disabled:opacity-30"><ArrowUp aria-hidden className="h-4 w-4" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label={`Move step ${i + 1} down`} className="grid h-9 w-9 place-items-center rounded hover:bg-surface disabled:opacity-30"><ArrowDown aria-hidden className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setSteps((all) => all.filter((_, j) => j !== i))} disabled={steps.length === 1} aria-label={`Remove step ${i + 1}`} className="grid h-9 w-9 place-items-center rounded text-warm hover:bg-warm/10 disabled:opacity-30"><Trash2 aria-hidden className="h-4 w-4" /></button>
                </span>
              </div>
              <div className="mt-3 grid gap-3">
                {s.type === "send_email" && (<>
                  <input aria-label="Subject" placeholder="Subject" value={s.subject} maxLength={160} onChange={(e) => set(i, { ...s, subject: e.target.value })} className={`${field} h-10`} />
                  <textarea aria-label="Message" rows={6} value={s.body} maxLength={10000} onChange={(e) => set(i, { ...s, body: e.target.value })} className={`${field} py-2`} />
                </>)}
                {(s.type === "add_tag" || s.type === "remove_tag") && (
                  <input aria-label="Tag" placeholder="e.g. ebook-buyer" value={s.tag} maxLength={40} onChange={(e) => set(i, { ...s, tag: e.target.value.toLowerCase() })} className={`${field} h-10`} />
                )}
                {s.type === "wait" && (
                  <div className="flex flex-wrap items-center gap-2 text-body-sm">
                    <input aria-label="Wait in days" type="number" min={0} max={90} value={Math.floor(s.hours / 24)} onChange={(e) => set(i, { ...s, hours: Math.max(1, Number(e.target.value) * 24 + (s.hours % 24)) })} className={`${field} h-10 w-24`} />days
                    <input aria-label="and hours" type="number" min={0} max={23} value={s.hours % 24} onChange={(e) => set(i, { ...s, hours: Math.max(1, Math.floor(s.hours / 24) * 24 + Number(e.target.value)) })} className={`${field} h-10 w-24`} />hours
                  </div>
                )}
                {s.type === "condition" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select aria-label="Check" value={s.check} onChange={(e) => set(i, { ...s, check: e.target.value as typeof s.check, value: undefined })} className={`${field} h-10`}>
                      {Object.entries(CONDITIONS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    {s.check === "has_tag" && <input aria-label="Tag" placeholder="tag" value={s.value ?? ""} onChange={(e) => set(i, { ...s, value: e.target.value.toLowerCase() })} className={`${field} h-10`} />}
                    {s.check === "owns_product" && <select aria-label="Product" value={s.value ?? ""} onChange={(e) => set(i, { ...s, value: e.target.value })} className={`${field} h-10`}><option value="">Choose a product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
                    {s.check === "enrolled_course" && <select aria-label="Course" value={s.value ?? ""} onChange={(e) => set(i, { ...s, value: e.target.value })} className={`${field} h-10`}><option value="">Choose a course</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
                    <label className="flex min-h-[40px] items-center gap-2 text-body-sm"><input type="checkbox" checked={!!s.negate} onChange={(e) => set(i, { ...s, negate: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--blue))]" />Reverse (if NOT)</label>
                    <label className="flex flex-wrap items-center gap-2 text-body-sm">If not:
                      <select aria-label="If not" value={s.skip} onChange={(e) => set(i, { ...s, skip: Number(e.target.value) })} className={`${field} h-10 w-auto`}>
                        <option value={0}>stop here</option>
                        {Array.from({ length: Math.max(0, steps.length - i - 1) }, (_, k) => k + 1).map((k) => <option key={k} value={k}>skip the next {k} step{k === 1 ? "" : "s"}</option>)}
                      </select>
                    </label>
                  </div>
                )}
                <p className="text-caption text-ink-3">{describeStep(s, names)}</p>
              </div>
            </li>
          ))}
        </ol>
        {steps.length < MAX_STEPS && (
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            {(["send_email", "wait", "add_tag", "remove_tag", "condition"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setSteps((all) => [...all, blank(t)])} className="inline-flex h-9 items-center gap-1.5 rounded border border-line-strong px-3 text-label hover:border-ink">
                <Plus aria-hidden className="h-3.5 w-3.5" />{t === "send_email" ? "Email" : t === "add_tag" ? "Add tag" : t === "remove_tag" ? "Remove tag" : t === "wait" ? "Wait" : "Condition"}
              </button>
            ))}
          </div>
        )}
      </FormSection>
    </AdminForm>
  );
}
