import { Container, Section } from "@/components/ui/Container";
import { MixTitle, Paragraphs } from "@/components/cms/RichText";
import type { Section as CmsSection } from "@/lib/cms/types";
import { GameLoader } from "./GameLoader";

/** Homepage "playground": a small block-breaking game whose bricks spell the CMS text. The game code loads only near view. */
export function Playground({ section: s, lines }: { section: CmsSection; lines: string[] }) {
  return (
    <Section tone="night" id="playground">
      <Container>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            {s.eyebrow && <p className="text-label text-ink-3">{s.eyebrow}</p>}
            {s.title && <h2 className="mt-3 text-h1"><MixTitle text={s.title} /></h2>}
          </div>
          <Paragraphs text={s.body} className="max-w-sm text-body-sm text-ink-2" />
        </div>
        <div className="mt-10"><GameLoader lines={lines} /></div>
      </Container>
    </Section>
  );
}
