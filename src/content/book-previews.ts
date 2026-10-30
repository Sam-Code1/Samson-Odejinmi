/**
 * "Look inside" pages for a book: real page images from the book itself, shown on its page as a flip-through viewer.
 * Keyed by product slug. Images live in /public/books/<book>/ (1200 × 1800 WebP). Captions describe only what the page shows.
 */
export type PreviewGroup = "Start" | "Learn" | "Practice" | "Author";
export type PreviewPage = { src: string; title: string; note: string; group: PreviewGroup };

const D = "/books/before-you-open-blender";
const page = (n: string, group: PreviewGroup, title: string, note: string): PreviewPage => ({ src: `${D}/page-${n}.webp`, group, title, note });

const BEFORE_YOU_OPEN_BLENDER: PreviewPage[] = [
  page("01", "Start", "The cover", "Before You Open Blender: a beginner's map of the 3D world. Second edition."),
  page("02", "Start", "Contents", "Seven parts and 18 chapters, from \"What exactly is 3D?\" to your first project."),
  page("03", "Start", "Author's note", "Why this book exists, and why it starts with understanding, not buttons."),
  page("04", "Learn", "Chapter 1: What exactly is 3D?", "Every chapter opens with the questions it answers and a map of where you are in the book."),
  page("05", "Learn", "The miniature set", "Perspective and depth: how a flat screen can hold a whole 3D world."),
  page("06", "Learn", "Chapter 1 in one picture", "Build it once, see it from anywhere. One object, every view."),
  page("07", "Learn", "The production pipeline", "From idea to final output, on a single page."),
  page("08", "Learn", "Roughness", "Materials explained with spheres you can compare, not sliders to memorise."),
  page("09", "Learn", "Three-point lighting", "Key, fill and rim drawn from above, with a table of light types."),
  page("10", "Learn", "Squash and stretch", "An animation principle shown with a bouncing ball."),
  page("11", "Learn", "3D careers and creative paths", "The roles in 3D, in plain language."),
  page("12", "Learn", "The Blender screen, mapped", "Know every panel by name before you open the software."),
  page("13", "Practice", "Your first project", "A real client brief: a mug by the window."),
  page("14", "Practice", "The checklist", "Tick each line honestly. If one is unclear, the book tells you which chapter to revisit."),
  page("15", "Author", "About the author", "Samson Afolabi Odejinmi, known as Fola, a 3D artist and creative technologist in Lagos."),
  page("16", "Author", "About Fola Academy", "Learn the craft. Understand the tools. Build with purpose."),
  page("17", "Author", "The back cover", "3D is creative. 3D is technical. 3D is learnable. And it is bigger than Blender."),
];

export const BOOK_PREVIEWS: Record<string, PreviewPage[]> = {
  beforeyouopenblender: BEFORE_YOU_OPEN_BLENDER,
  "before-you-open-blender": BEFORE_YOU_OPEN_BLENDER,
};

export const previewPages = (slug: string): PreviewPage[] => BOOK_PREVIEWS[slug] ?? [];
