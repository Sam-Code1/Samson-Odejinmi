import type { SupabaseClient } from "@supabase/supabase-js";
import type { CertificateDesign } from "@/components/admin/CertificateDesignForm";

const DEFAULT: CertificateDesign = { certificate_signatory_name: "Samson Afolabi Odejinmi", certificate_signatory_title: "Founder, Fola Academy", certificate_signature_url: null };

/** The certificate signatory from Academy settings (admins only, RLS). Defaults until migration 0017 runs. */
export async function getCertificateDesign(supabase: SupabaseClient): Promise<CertificateDesign> {
  const { data, error } = await supabase.from("academy_settings").select("certificate_signatory_name, certificate_signatory_title, certificate_signature_url").eq("id", true).maybeSingle();
  if (error || !data) return DEFAULT;
  return { ...DEFAULT, ...(data as Partial<CertificateDesign>) };
}
