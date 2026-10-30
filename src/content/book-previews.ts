/**
 * "Look inside" pages for a book: real page images from the book itself, shown on its page as a flip-through viewer.
 * Keyed by product slug. Images live in /public/books/<book>/ (1200 × 1800 WebP). Captions describe only what the page shows.
 */
export type PreviewGroup = "Start" | "Learn" | "Practice" | "Author";
export type PreviewPage = { src: string; title: string; note: string; group: PreviewGroup };

const pageIn = (dir: string) => (n: string, group: PreviewGroup, title: string, note: string): PreviewPage => ({ src: `/books/${dir}/page-${n}.webp`, group, title, note });
const page = pageIn("before-you-open-blender");
const cube = pageIn("from-cube-to-creation");

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

const FROM_CUBE_TO_CREATION: PreviewPage[] = [
  cube("01", "Start", "The cover", "From Cube to Creation: a beginner's guide to 3D modelling in Blender. Field Guide 02."),
  cube("02", "Start", "Contents", "Five parts and 13 chapters, from \"What modelling really is\" to fixing problems and finishing well."),
  cube("03", "Start", "Author's note", "Every model began as something simple. Very often, it began as a cube."),
  cube("04", "Start", "The learning cards", "Nine kinds of card in the chapters: where to click, the shortcut, a short exercise, a common mistake and more."),
  cube("05", "Learn", "Vertex, edge and face", "The three elements of every mesh, drawn so you can see what you are selecting."),
  cube("06", "Learn", "Big, medium and small forms", "The same mug at three levels of form. Work from the big silhouette to the small details."),
  cube("07", "Learn", "Blockout and the silhouette test", "Build a rough version from simple shapes first, then check that the silhouette reads."),
  cube("08", "Learn", "The origin", "Why an object rotates around the wrong point, and how to move the origin."),
  cube("09", "Learn", "Loops and rings", "Select a whole edge loop or edge ring in one click."),
  cube("10", "Learn", "Extrude", "The tool that grows a shape, shown before and after."),
  cube("11", "Learn", "Loop cut", "Hover, scroll, click: add detail exactly where you need it."),
  cube("12", "Learn", "Mirror and Subdivision Surface", "Model one half and let Blender mirror it, then smooth it with subdivision levels."),
  cube("13", "Learn", "Support loops", "Edge loops placed close to an edge keep it crisp when the model is smoothed."),
  cube("14", "Practice", "Project 1: a coffee mug", "A project brief and the mug in four milestones, from plain cylinder to smoothed mug."),
  cube("15", "Practice", "Building the handle", "Numbered steps with the figure beside them, so you always know what you should see."),
  cube("16", "Practice", "Project 3: a low-poly island", "Fewer faces on purpose: an island diorama built from simple shapes."),
  cube("17", "Practice", "The troubleshooting guide", "Problem, likely cause and fix, in a table for when something goes wrong."),
  cube("18", "Practice", "Shortcut reference", "The keys used in the book, gathered in one place to keep beside Blender."),
  cube("19", "Author", "Fola's story", "How the author came to 3D, and why this book exists."),
  cube("20", "Author", "About Fola Academy", "Learn the craft. Understand the tools. Build with purpose."),
];

export const BOOK_PREVIEWS: Record<string, PreviewPage[]> = {
  "from-cube-to-creation": FROM_CUBE_TO_CREATION,
  beforeyouopenblender: BEFORE_YOU_OPEN_BLENDER,
  "before-you-open-blender": BEFORE_YOU_OPEN_BLENDER,
};

export const previewPages = (slug: string): PreviewPage[] => BOOK_PREVIEWS[slug] ?? [];
