import { createLesson, saveLesson } from "@/app/admin/actions/curriculum";
import { AdminForm } from "./AdminForm";
import { CheckboxInput, FormSection, SelectInput, TextAreaInput, TextInput } from "./FormFields";
import type { LessonRow } from "@/lib/admin/types";
import { ImageField, type LibraryImage } from "./ImageField";

export function LessonForm({ courseId, modules, lesson, defaultModuleId, sources, library = [] }: { courseId: string; modules: { id: string; title: string }[]; lesson?: LessonRow; defaultModuleId?: string; sources?: { transcript: string | null; notes: string | null } | null; library?: LibraryImage[] }) {
  const published = lesson?.status === "published";
  const secs = lesson?.duration_seconds ?? 0;
  return (
    <AdminForm
      action={lesson ? saveLesson : createLesson}
      submitLabel={lesson ? (published ? "Save changes" : "Save draft") : "Save as draft"}
      saveIntent="save"
      extra={
        published
          ? lesson && <button type="submit" name="intent" value="unpublish" className="h-10 rounded border border-line-strong px-4 text-label hover:border-ink">Unpublish</button>
          : <button type="submit" name="intent" value="publish" className="h-10 rounded border border-blue/50 px-4 text-label text-blue hover:bg-blue/10">{lesson ? "Publish" : "Save and publish"}</button>
      }
    >
      {lesson ? <input type="hidden" name="lessonId" value={lesson.id} /> : <input type="hidden" name="courseId" value={courseId} />}

      <FormSection title="Lesson">
        <TextInput label="Title" name="title" required defaultValue={lesson?.title ?? ""} className="sm:col-span-2" />
        <TextInput label="Slug" name="slug" defaultValue={lesson?.slug ?? ""} hint="Used in the lesson URL. Generated from the title if empty." />
        <SelectInput label="Lesson type" name="lesson_type" defaultValue={lesson?.lesson_type ?? "video"} options={[{ value: "video", label: "Video" }, { value: "text", label: "Text only" }, { value: "mixed", label: "Video and text" }]} />
        {!lesson && <SelectInput label="Module" name="module_id" required defaultValue={defaultModuleId ?? ""} options={[{ value: "", label: modules.length ? "Choose a module…" : "Create a module first" }, ...modules.map((m) => ({ value: m.id, label: m.title }))]} />}
        <TextAreaInput label="Description" name="summary" rows={2} defaultValue={lesson?.summary ?? ""} className="sm:col-span-2" hint="A line or two shown under the lesson title." />
      </FormSection>

      <FormSection title="Video" description="YouTube is the current video host. Students watch inside Fola Academy: no download, share or YouTube link is ever shown to them.">
        <TextInput label="YouTube link or video ID" name="video_input" defaultValue={lesson?.video_id ?? ""} className="sm:col-span-2" hint="Paste a YouTube link or the 11-character ID. Only the ID is stored. Only admins ever see it. Ignored for text-only lessons." />
        <div className="grid grid-cols-2 gap-3 sm:col-span-1">
          <TextInput label="Minutes" name="duration_min" type="number" min={0} defaultValue={secs ? String(Math.floor(secs / 60)) : ""} />
          <TextInput label="Seconds" name="duration_sec" type="number" min={0} max={59} defaultValue={secs ? String(secs % 60) : ""} />
        </div>
        <ImageField name="video_thumbnail" label="Video thumbnail (optional)" current={lesson?.video_thumbnail ?? null} library={library} hint="Shown as a click-to-play poster. The video only loads when the student presses play." />
        <CheckboxInput label="Show the video to students" name="video_enabled" defaultChecked={lesson?.video_enabled ?? true} hint="Untick to hide the video without removing it." className="self-end pb-2" />
      </FormSection>

      <FormSection title="Lesson content">
        <TextAreaInput label="Lesson text" name="content_md" rows={14} defaultValue={lesson?.content_md ?? ""} className="sm:col-span-2" hint="Plain text. A blank line starts a new paragraph. “## ” makes a heading and “- ” makes a bullet list. HTML isn't rendered." />
      </FormSection>

      {lesson && <FormSection title="Transcript and teaching notes" description="Admin-only source material. Never shown to students. The AI quiz generator can build questions from it.">
        <TextAreaInput label="Video transcript" name="transcript" rows={8} defaultValue={sources?.transcript ?? ""} className="sm:col-span-2" hint="Paste the transcript of the lesson video (YouTube Studio → Subtitles can export one)." />
        <TextAreaInput label="Lesson notes" name="notes" rows={6} defaultValue={sources?.notes ?? ""} className="sm:col-span-2" hint="Key points, definitions and examples you want quizzes to focus on." />
      </FormSection>}

      <FormSection title="Access">
        <CheckboxInput label="Mark as free preview" name="is_preview" defaultChecked={lesson?.is_preview ?? false} hint="Saved for the future. Public previews aren't switched on yet, so every lesson still requires enrolment." />
      </FormSection>
    </AdminForm>
  );
}
