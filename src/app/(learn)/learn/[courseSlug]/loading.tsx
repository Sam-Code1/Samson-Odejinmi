import { LoadingBlock } from "@/components/ui/States";

export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6" role="status" aria-label="Loading lesson">
      <LoadingBlock className="h-10 w-2/3" />
      <LoadingBlock className="aspect-video w-full" />
      <LoadingBlock className="h-5 w-full" />
      <LoadingBlock className="h-5 w-4/5" />
    </div>
  );
}
