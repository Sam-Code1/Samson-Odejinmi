"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { attachProductFile } from "@/app/admin/actions/products";
import { initialResult } from "@/lib/admin/result";
import { browserSupabase } from "@/lib/supabase/browser";
import { useResultToast } from "./useResultToast";
import { FormSection } from "./FormFields";

const ACCEPT = ".pdf,.epub,.zip,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.blend,.psd,.csv,.txt";
const EXTS = ACCEPT.split(",").map((e) => e.slice(1));
const MAX = 25 * 1024 * 1024;
const mb = (n: number) => `${(n / 1_048_576).toFixed(1)} MB`;

/**
 * Deliverable file upload that works for big ebooks: the browser sends the file straight to the private product-files
 * bucket (Storage policy: admins with the Products permission), then the server checks the stored object and attaches
 * it. Nothing large passes through a Vercel function, whose requests are capped at 4.5 MB.
 */
export function ProductFileUpload({ productId, current }: { productId: string; current: { file_name: string; file_size: number | null; updated_at: string } | null }) {
  const [state, dispatch, attaching] = useActionState(attachProductFile, initialResult);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useResultToast(state, () => { if (input.current) input.current.value = ""; });
  const busy = !!uploading || attaching;
  const fieldError = error ?? state.fieldErrors?.file ?? null;

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const file = input.current?.files?.[0];
    if (!file) return setError("Choose a file to upload.");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!EXTS.includes(ext)) return setError("Use PDF, EPUB, ZIP, Word, Excel, PowerPoint, PNG/JPG, .blend, .psd, CSV or text.");
    if (file.size > MAX) return setError(`This file is ${mb(file.size)}. Files must be 25 MB or smaller; for bigger files, upload a ZIP of the essentials.`);
    const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || `file.${ext}`;
    const path = `products/${productId}/${crypto.randomUUID()}-${safe}`;
    setUploading(`Uploading ${file.name} (${mb(file.size)})…`);
    try {
      const { error: ue } = await browserSupabase().storage.from("product-files").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (ue) {
        setError(/row-level|unauthori|403/i.test(ue.message) ? "You don't have permission to upload product files." : `The upload didn't finish: ${ue.message}. Check your connection and try again.`);
        return;
      }
    } catch {
      setError("The upload didn't finish. Check your connection and try again.");
      return;
    } finally {
      setUploading(null);
    }
    const fd = new FormData();
    fd.set("productId", productId);
    fd.set("path", path);
    fd.set("file_name", file.name);
    startTransition(() => dispatch(fd));
  }

  return (
    <form onSubmit={upload} noValidate className="space-y-4">
      <FormSection title="Deliverable file" description="Stored privately. Buyers download it from their library through a link that expires after 60 seconds; there is never a public URL.">
        {current && <p className="text-body-sm sm:col-span-2">Current file: <strong className="break-all">{current.file_name}</strong>{current.file_size ? ` · ${mb(current.file_size)}` : ""}</p>}
        <div className="sm:col-span-2">
          <label htmlFor="product-file" className="mb-1.5 block text-caption font-semibold text-ink">{current ? "New file" : "File"}</label>
          <input id="product-file" ref={input} type="file" accept={ACCEPT} disabled={busy} aria-invalid={!!fieldError} aria-describedby="product-file-hint"
            className="w-full min-w-0 rounded-lg border border-line-strong bg-elevated px-3 py-2 text-body-sm text-ink file:mr-3 file:rounded file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-caption file:font-semibold file:text-ink disabled:opacity-60" />
          {fieldError
            ? <p role="alert" className="mt-1.5 text-caption text-warm">{fieldError}</p>
            : <p id="product-file-hint" className="mt-1.5 text-caption text-ink-3">Up to 25 MB. PDF, EPUB, ZIP, Office files, images, .blend, .psd, CSV or text. Large files upload straight to secure storage.</p>}
          {busy && (
            <div className="mt-3" role="status">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface"><div className="h-full w-1/3 animate-[ad-indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-action" /></div>
              <p className="mt-1.5 text-caption text-ink-2">{uploading ?? "Checking and attaching the file…"}</p>
            </div>
          )}
        </div>
      </FormSection>
      <button type="submit" disabled={busy} className="h-10 rounded-lg bg-action px-5 text-label text-on-action transition-colors hover:bg-action-hover disabled:opacity-60">
        {busy ? "Uploading…" : current ? "Replace file" : "Upload file"}
      </button>
    </form>
  );
}
