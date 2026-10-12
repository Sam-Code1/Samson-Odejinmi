"use client";

import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main">
      <Container>
        <div className="py-24 sm:py-32">
          <div className="thread-v mb-6 h-10 w-px" aria-hidden />
          <h1 className="text-h3 max-w-xl">Something went wrong on our side</h1>
          <p className="mt-4 max-w-prose text-ink-2">The page didn&apos;t load properly. Try again. If it keeps happening, check your connection or come back in a few minutes.</p>
          <div className="mt-8 flex gap-5">
            <Button onClick={() => reset()}>Try again</Button>
            <Button href="/" variant="text">Back to home</Button>
          </div>
        </div>
      </Container>
    </main>
  );
}
