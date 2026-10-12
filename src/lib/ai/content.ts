/** Content assistant tasks. Output is always a draft for the admin to review; it is never written to the site. */
export const CONTENT_TASKS = {
  lesson_summary: { label: "Lesson summary", instruction: "Write a 2–3 sentence lesson summary for students, in plain, encouraging language." },
  learning_objectives: { label: "Learning objectives", instruction: "Write 3–6 learning objectives, one per line, each starting with a verb (for example “Explain…”, “Use…”)." },
  course_description: { label: "Course description", instruction: "Write a course description of 2–3 short paragraphs: who it's for, what they'll be able to do, how it's taught." },
  glossary: { label: "Glossary terms", instruction: "List the key terms from the material, one per line as “Term: short beginner-friendly definition”. Only terms the material explains." },
  quiz_explanation: { label: "Quiz answer explanation", instruction: "Write a one or two sentence explanation of why the given answer is correct, based on the material." },
  seo_description: { label: "SEO description", instruction: "Write a meta description under 155 characters. Specific, plain, no hype words." },
} as const;
export type ContentTask = keyof typeof CONTENT_TASKS;
