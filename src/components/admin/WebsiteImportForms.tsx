"use client";

import { createProjectFromWebsite, importWebsiteIntoProject } from "@/app/admin/actions/site-projects";
import { AdminForm } from "./AdminForm";
import { CheckboxInput, TextInput } from "./FormFields";

const WAIT = "Capturing takes about 20–40 seconds: a real browser opens the site, reads its details and takes the screenshots.";

/** Portfolio list: paste a link, get a draft case study with the site's details and screenshots. */
export function NewWebsiteProjectForm() {
  return (
    <AdminForm action={createProjectFromWebsite} submitLabel="Create project from website" stickyBar={false}>
      <TextInput label="Website address" name="site_url" type="url" inputMode="url" required placeholder="https://example.com" maxLength={500} hint={WAIT} />
    </AdminForm>
  );
}

/** Project editor: fetch or refresh the live site behind this project. */
export function WebsiteCaptureForm({ projectId, url, captured }: { projectId: string; url: string | null; captured: boolean }) {
  return (
    <AdminForm action={importWebsiteIntoProject} submitLabel={captured ? "Refresh screenshots" : "Fetch details & screenshots"} stickyBar={false}>
      <input type="hidden" name="projectId" value={projectId} />
      <TextInput label="Website address" name="site_url" type="url" inputMode="url" required defaultValue={url ?? ""} placeholder="https://example.com" maxLength={500} hint={WAIT} />
      <CheckboxInput label="Replace the title, short description and cover with the site's" name="replace" hint="Off: only empty fields are filled, so your own words stay." />
      {captured && <CheckboxInput label="Add the new section screenshots to the gallery" name="add_screens_on" defaultChecked={false} hint="Off: only the cover, scrolling and phone previews are refreshed." />}
    </AdminForm>
  );
}
