export type CourseStatus = "draft" | "published" | "archived";

export type CourseRow = {
  id: string; slug: string; title: string; subtitle: string | null; description: string | null; level: string | null;
  status: CourseStatus; image_url: string | null; thumbnail_url: string | null; instructor: string | null; category: string | null;
  estimated_duration: string | null; objectives: string[]; learning_outcomes: string[]; requirements: string[]; target_audience: string[];
  seo_title: string | null; seo_description: string | null; certificate_enabled: boolean; published_at: string | null; created_at: string; updated_at: string;
};

export type ModuleRow = { id: string; course_id: string; position: number; title: string; description: string | null; status?: "draft" | "published" };

export type LessonRow = {
  id: string; module_id: string; course_id: string; slug: string; position: number; title: string; summary: string | null;
  content_md: string | null; lesson_type: "video" | "text" | "mixed"; video_provider: string; video_id: string | null;
  video_thumbnail: string | null; video_enabled: boolean; duration_seconds: number | null; is_preview: boolean; status: "draft" | "published";
};

export type QuizRow = {
  id: string; course_id: string; lesson_id: string | null; title: string; description: string | null; pass_mark: number;
  allow_retry: boolean; max_attempts: number | null; show_explanations: boolean; status: "draft" | "published"; created_at: string;
};

export type QuestionRow = {
  id: string; quiz_id: string; question_text: string; question_type: "multiple_choice" | "true_false" | "multiple_select";
  explanation: string | null; points: number; difficulty: "easy" | "medium" | "hard" | null; position: number;
  source: "manual" | "ai"; review_status: "draft" | "ai_generated" | "approved" | "rejected"; published: boolean;
  course_id?: string | null; module_id?: string | null; lesson_id?: string | null; source_reference?: string | null; archived?: boolean;
};

export type OptionRow = { id: string; question_id: string; option_text: string; is_correct: boolean; position: number };

export type ResourceRow = {
  id: string; course_id: string; lesson_id: string | null; module_id: string | null; quiz_id: string | null; title: string;
  description: string | null; kind: string; url: string | null; file_path: string | null; size_bytes: number | null;
  download_enabled: boolean; created_at: string;
};
