"use client";

import { createProjectFromWebsite, importWebsiteIntoProject } from "@/app/admin/actions/site-projects";
import { AdminForm } from "./AdminForm";
import { CheckboxInput, TextInput } from "./FormFields";

const WAIT = "Capturing takes about 20–60 seconds: a real browser opens the site, reads its details and takes HD screenshots.";

/** Portfolio list: paste a link, get a draft case study with the site's details and screenshots. */
export function NewWebsiteProjectForm() {
  return (
    <AdminForm action={createProjectFromWebsite} submitLabel="Create project from website" stickyBar={false}>
      <TextInput label="Website address" name="site_url" type="url" inputMode="url" required placeholder="https://example.com" maxLength={500} hint={WAIT} />
    </AdminForm>
  );
}

/** Project editor: fetch or refresh the live site behind this project. */
export function WebsiteCaptureForm({ projectId, url, captured, autoRefresh = true }: { projectId: string; url: string | null; captured: boolean; autoRefresh?: boolean }) {
  return (
    <AdminForm action={importWebsiteIntoProject} submitLabel={captured ? "Refresh screenshots" : "Fetch details & screenshots"} stickyBar={false}>
      <input type="hidden" name="projectId" value={projectId} />
      <TextInput label="Website address" name="site_url" type="url" inputMode="url" required defaultValue={url ?? ""} placeholder="https://example.com" maxLength={500} hint={WAIT} />
      <CheckboxInput label="Replace the title, short description and cover with the site's" name="replace" hint="Off: only empty fields are filled, so your own words stay." />
      <CheckboxInput label="Keep in sync with the live site" name="auto_refresh" defaultChecked={autoRefresh}
        hint="Checked daily. When the site changes, the HD screenshots are replaced automatically (old ones removed, no duplicates)." />
    </AdminForm>
  );
}
