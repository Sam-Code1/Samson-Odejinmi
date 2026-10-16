import { createServiceClient } from "@/lib/supabase/admin";
import { getEmailProvider, type OutgoingEmail } from "@/lib/email/providers";
import { buildMarketingEmail } from "@/lib/email/marketing";
import { validateSteps, type Step } from "./steps";

/**
 * Marketing jobs. SERVER ONLY, service role. Run by the cron route (/api/cron/marketing) and by "Send now" /
 * "Run queue now" in Admin. Every job is safe to run concurrently and repeatedly:
 *   - queued emails and due automation runs are CLAIMED in the database (skip locked), so nothing is sent twice
 *   - consent is checked again right before each send (someone may have unsubscribed since queueing)
 *   - provider failures are recorded honestly (status failed + reason); nothing is reported as sent unless it was
 */
type Service = NonNullable<ReturnType<typeof createServiceClient>>;
type Row = Record<string, unknown>;

export type JobSummary = {
  ok: boolean; reason?: string;
  scheduledStarted: number; abandonedQueued: number; automationRuns: number; emailsSent: number; emailsFailed: number; emailsSkipped: number; campaignsFinished: number;
};

const empty = (): JobSummary => ({ ok: true, scheduledStarted: 0, abandonedQueued: 0, automationRuns: 0, emailsSent: 0, emailsFailed: 0, emailsSkipped: 0, campaignsFinished: 0 });

const marketable = (c: Row | null | undefined) => !!c && c.marketing_consent === true && !c.unsubscribed_at && c.email_status === "ok";

// ───────────── email queue ─────────────
export async function processEmailQueue(service: Service, limit = 300, deadlineMs = Date.now() + 40_000): Promise<Pick<JobSummary, "emailsSent" | "emailsFailed" | "emailsSkipped">> {
  const out = { emailsSent: 0, emailsFailed: 0, emailsSkipped: 0 };
  const provider = getEmailProvider();
  if (!provider.configured()) return out; // leave everything queued: nothing is sent, nothing is marked sent
  const campaigns = new Map<string, Row | null>();

  while (out.emailsSent + out.emailsFailed + out.emailsSkipped < limit && Date.now() < deadlineMs) {
    const { data: claimed, error } = await service.rpc("claim_email_messages", { p_limit: Math.min(100, limit) });
    if (error) { console.error("[marketing] claim_email_messages:", error.code, error.message); break; }
    const batch = (claimed ?? []) as Row[];
    if (!batch.length) break;

    const contactIds = [...new Set(batch.map((m) => m.contact_id as string).filter(Boolean))];
    const { data: contacts } = await service.from("contacts").select("id, email, first_name, marketing_consent, unsubscribed_at, email_status, unsubscribe_token").in("id", contactIds);
    const byId = new Map(((contacts ?? []) as Row[]).map((c) => [c.id as string, c]));

    const toSend: { m: Row; email: OutgoingEmail }[] = [];
    for (const m of batch) {
      const c = byId.get(m.contact_id as string);
      if (m.kind !== "test" && !marketable(c)) {
        await service.from("email_messages").update({ status: "skipped", error: "no consent or unsubscribed" }).eq("id", m.id as string);
        out.emailsSkipped++;
        continue;
      }
      let subject = m.subject as string, body = (m.body as string) ?? "", preview: string | null = null, fromName: string | null = null;
      if (m.kind === "campaign" && m.campaign_id) {
        if (!campaigns.has(m.campaign_id as string)) {
          const { data: camp } = await service.from("email_campaigns").select("subject, preview_text, from_name, body, status").eq("id", m.campaign_id as string).maybeSingle();
          campaigns.set(m.campaign_id as string, (camp as Row) ?? null);
        }
        const camp = campaigns.get(m.campaign_id as string);
        if (!camp || camp.status === "cancelled") {
          await service.from("email_messages").update({ status: "skipped", error: "campaign cancelled" }).eq("id", m.id as string);
          out.emailsSkipped++;
          continue;
        }
        subject = camp.subject as string; body = camp.body as string; preview = (camp.preview_text as string) ?? null; fromName = (camp.from_name as string) ?? null;
      }
      const built = buildMarketingEmail({ firstName: (c?.first_name as string) ?? null, subject, previewText: preview, body, unsubscribeToken: (c?.unsubscribe_token as string) ?? "", messageId: m.id as string });
      const fromAddr = process.env.MARKETING_EMAIL_FROM ?? process.env.EMAIL_FROM;
      const from = fromAddr && fromName ? `${fromName.replace(/[<>"\r\n]/g, "")} <${fromAddr.replace(/^.*<([^>]+)>.*$/, "$1")}>` : fromAddr;
      toSend.push({ m, email: { to: m.to_email as string, from, subject: built.subject, text: built.text, html: built.html, headers: built.headers, tags: [{ name: "category", value: String(m.kind) }] } });
    }

    const results = provider.sendBatch ? await provider.sendBatch(toSend.map((x) => x.email)) : await Promise.all(toSend.map((x) => provider.send(x.email)));
    await Promise.all(toSend.map(async ({ m }, i) => {
      const r = results[i];
      if (r?.sent) {
        out.emailsSent++;
        await service.from("email_messages").update({ status: "sent", sent_at: new Date().toISOString(), provider: provider.name, provider_message_id: r.id, error: null }).eq("id", m.id as string);
      } else {
        out.emailsFailed++;
        const retry = r?.reason === "failed" && Number(m.attempts) < 3;
        await service.from("email_messages").update({ status: retry ? "queued" : "failed", error: `${r?.reason ?? "failed"}${r && !r.sent && r.detail ? `: ${r.detail}` : ""}`.slice(0, 300), send_after: retry ? new Date(Date.now() + 10 * 60_000).toISOString() : null }).eq("id", m.id as string);
      }
    }));
  }
  return out;
}

// ───────────── automations ─────────────
async function checkCondition(service: Service, step: Extract<Step, { type: "condition" }>, contact: Row): Promise<boolean> {
  const uid = contact.user_id as string | null;
  let result = false;
  switch (step.check) {
    case "consented": result = marketable(contact); break;
    case "has_tag": {
      const { count } = await service.from("contact_tags").select("tag", { count: "exact", head: true }).eq("contact_id", contact.id as string).eq("tag", step.value ?? "");
      result = (count ?? 0) > 0; break;
    }
    case "purchased_any": {
      if (!uid) break;
      const { count } = await service.from("payments").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "successful");
      result = (count ?? 0) > 0; break;
    }
    case "owns_product": {
      if (!uid) break;
      const { data } = await service.rpc("user_owns_product", { p_user: uid, p_product: step.value });
      result = data === true; break;
    }
    case "enrolled_course": {
      if (!uid) break;
      const { count } = await service.from("enrolments").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("course_id", step.value ?? "").in("status", ["active", "completed"]);
      result = (count ?? 0) > 0; break;
    }
  }
  return step.negate ? !result : result;
}

const MAX_STEPS_PER_PASS = 25;

export async function processAutomations(service: Service, limit = 50): Promise<number> {
  const { data: runs, error } = await service.rpc("claim_automation_runs", { p_limit: limit });
  if (error) { console.error("[marketing] claim_automation_runs:", error.code, error.message); return 0; }
  const list = (runs ?? []) as Row[];
  const automations = new Map<string, Row | null>();

  for (const run of list) {
    const log = (step: number, action: string, outcome: string, detail?: string) =>
      service.from("automation_logs").insert({ run_id: run.id, step_index: step, action, outcome, detail: detail?.slice(0, 300) ?? null });
    const finish = (patch: Row) => service.from("automation_runs").update(patch).eq("id", run.id as string);
    try {
      if (!automations.has(run.automation_id as string)) {
        const { data } = await service.from("automations").select("id, status, steps").eq("id", run.automation_id as string).maybeSingle();
        automations.set(run.automation_id as string, (data as Row) ?? null);
      }
      const auto = automations.get(run.automation_id as string);
      if (!auto || auto.status !== "active") { await finish({ status: "cancelled", last_error: "automation not active" }); continue; }
      const parsed = validateSteps(auto.steps);
      if (!parsed.ok) { await finish({ status: "failed", last_error: parsed.error }); await log(Number(run.step_index), "validate", "failed", parsed.error); continue; }
      const { data: contact } = await service.from("contacts").select("id, email, first_name, user_id, marketing_consent, unsubscribed_at, email_status").eq("id", run.contact_id as string).maybeSingle();
      if (!contact) { await finish({ status: "cancelled", last_error: "contact removed" }); continue; }

      let idx = Number(run.step_index), executed = Number(run.steps_executed), done = false;
      for (let n = 0; n < MAX_STEPS_PER_PASS; n++) {
        const step = parsed.steps[idx];
        if (!step) { await log(idx, "end", "completed"); await finish({ status: "completed", step_index: idx, steps_executed: executed }); done = true; break; }
        executed++;
        if (step.type === "wait") {
          await log(idx, "wait", "waiting", `${step.hours}h`);
          await finish({ status: "waiting", step_index: idx + 1, steps_executed: executed, next_run_at: new Date(Date.now() + step.hours * 3_600_000).toISOString() });
          done = true; break;
        }
        if (step.type === "send_email") {
          if (marketable(contact as Row)) {
            const { error: qe } = await service.from("email_messages").insert({ kind: "automation", automation_run_id: run.id, contact_id: contact.id, to_email: contact.email, subject: step.subject, body: step.body, status: "queued" });
            await log(idx, "send_email", qe ? "failed" : "done", qe ? "could not queue" : step.subject);
          } else {
            await log(idx, "send_email", "skipped", "no marketing consent");
          }
        } else if (step.type === "add_tag") {
          await service.from("contact_tags").upsert({ contact_id: contact.id, tag: step.tag }, { onConflict: "contact_id,tag", ignoreDuplicates: true });
          await log(idx, "add_tag", "done", step.tag);
        } else if (step.type === "remove_tag") {
          await service.from("contact_tags").delete().eq("contact_id", contact.id as string).eq("tag", step.tag);
          await log(idx, "remove_tag", "done", step.tag);
        } else if (step.type === "condition") {
          const pass = await checkCondition(service, step, contact as Row);
          await log(idx, "condition", "done", pass ? "true" : step.skip === 0 ? "false: stop" : `false: skip ${step.skip}`);
          if (!pass) {
            if (step.skip === 0) { await finish({ status: "completed", step_index: idx + 1, steps_executed: executed }); done = true; break; }
            idx += step.skip; // forward only
          }
        }
        idx++;
      }
      if (!done) await finish({ status: "active", step_index: idx, steps_executed: executed, next_run_at: new Date().toISOString() });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      await finish({ status: "failed", last_error: msg.slice(0, 300) });
      await log(Number(run.step_index), "error", "failed", msg);
    }
  }
  return list.length;
}

// ───────────── all jobs ─────────────
export async function runMarketingJobs(opts: { emailLimit?: number } = {}): Promise<JobSummary> {
  const service = createServiceClient();
  if (!service) return { ...empty(), ok: false, reason: "SUPABASE_SERVICE_ROLE_KEY is not set" };
  const out = empty();
  const deadline = Date.now() + 45_000;

  // 1. Scheduled campaigns whose time has come.
  const { data: due } = await service.from("email_campaigns").select("id").eq("status", "scheduled").lte("scheduled_at", new Date().toISOString()).limit(10);
  for (const c of (due ?? []) as Row[]) {
    const { error } = await service.rpc("start_email_campaign", { p_campaign: c.id });
    if (!error) out.scheduledStarted++; else console.error("[marketing] start_email_campaign:", error.code, error.message);
  }
  // 2. Abandoned checkouts → automation trigger.
  const { data: ab } = await service.rpc("flag_abandoned_checkouts", { p_after: "2 hours" });
  out.abandonedQueued = typeof ab === "number" ? ab : 0;
  // 3. Automations (may queue emails).
  out.automationRuns = await processAutomations(service);
  // 4. Send queued email.
  Object.assign(out, await processEmailQueue(service, opts.emailLimit ?? 500, deadline));
  // 5. Close campaigns whose queue is empty.
  const { data: fin } = await service.rpc("finish_email_campaigns");
  out.campaignsFinished = typeof fin === "number" ? fin : 0;
  return out;
}
