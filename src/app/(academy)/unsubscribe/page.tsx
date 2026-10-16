import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { StateForm } from "@/components/forms/StateForm";
import { confirmUnsubscribe } from "@/app/marketing-actions";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Unsubscribe confirmation. A button (not the link itself) does the unsubscribing, so email scanners that open links
 * can't unsubscribe people by accident. Mail apps use the one-click POST endpoint instead (/api/unsubscribe).
 */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const t = typeof sp.t === "string" ? sp.t : "";
  const m = typeof sp.m === "string" ? sp.m : "";
  return (
    <Container className="max-w-xl pb-24 pt-16 sm:pt-24">
      <h1 className="text-h1">Unsubscribe</h1>
      {t ? (
        <>
          <p className="mt-5 text-body-lg text-ink-2">Stop receiving marketing emails from Fola Academy? Emails about your purchases and account will still arrive.</p>
          <div className="mt-8">
            <StateForm action={confirmUnsubscribe} submitLabel="Unsubscribe me" hideOnSuccess>
              <input type="hidden" name="t" value={t} />
              <input type="hidden" name="m" value={m} />
            </StateForm>
          </div>
        </>
      ) : (
        <p className="mt-5 text-body-lg text-ink-2">Open the unsubscribe link at the bottom of one of our emails, or reply to the email and we&apos;ll remove you. If you have an account, you can also turn off marketing emails in <a href="/settings" className="underline underline-offset-4">Settings</a>.</p>
      )}
    </Container>
  );
}
