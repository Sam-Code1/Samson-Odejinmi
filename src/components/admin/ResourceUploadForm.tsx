"use client";

import { useState } from "react";
import { uploadResource } from "@/app/admin/actions/resources";
import { AdminForm } from "./AdminForm";
import { CheckboxInput, FileInput, SelectInput, TextAreaInput, TextInput } from "./FormFields";

type Opt = { id: string; title: string };

export function ResourceUploadForm({ courseId, courses, modules = [], lessons = [], quizzes = [] }: { courseId?: string; courses?: Opt[]; modules?: Opt[]; lessons?: Opt[]; quizzes?: Opt[] }) {
  const [mode, setMode] = useState<"file" | "link">("file");
  return (
    <AdminForm action={uploadResource} submitLabel="Upload resource" stickyBar={false}>
      {courseId ? <input type="hidden" name="courseId" value={courseId} /> : (
        <SelectInput label="Course" name="courseId" required options={[{ value: "", label: "Choose a course…" }, ...(courses ?? []).map((c) => ({ value: c.id, label: c.title }))]} />
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput label="Title" name="title" required placeholder="Blender shortcut cheat sheet" />
        <SelectInput label="Type" name="mode" value={mode} onChange={(e) => setMode(e.target.value as "file" | "link")} options={[{ value: "file", label: "File upload" }, { value: "link", label: "External link" }]} />
        <TextAreaInput label="Description" name="description" rows={2} className="sm:col-span-2" />
        {mode === "file" ? <FileInput label="File" name="file" hint="PDF, ZIP, Word, Excel, CSV, PowerPoint, .blend or image. Up to 25 MB." className="sm:col-span-2" /> : <TextInput label="Link" name="url" type="url" placeholder="https://" className="sm:col-span-2" />}
        <SelectInput label="Attach to lesson" name="lesson_id" options={[{ value: "", label: "None" }, ...lessons.map((l) => ({ value: l.id, label: l.title }))]} />
        <SelectInput label="…or to module" name="module_id" options={[{ value: "", label: "None" }, ...modules.map((m) => ({ value: m.id, label: m.title }))]} />
        {quizzes.length > 0 && <SelectInput label="…or to quiz" name="quiz_id" options={[{ value: "", label: "None" }, ...quizzes.map((q) => ({ value: q.id, label: q.title }))]} />}
        <CheckboxInput label="Students can download this" name="download_enabled" defaultChecked hint="This is separate from the lesson video, which is always view-only." className="sm:col-span-2" />
      </div>
      <p className="text-caption text-ink-3">Leave lesson, module and quiz empty to attach it to the whole course.</p>
    </AdminForm>
  );
}
