import { LoadingBlock } from "@/components/ui/States";

export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <LoadingBlock className="h-12 w-2/3 max-w-lg" />
      <LoadingBlock className="h-5 w-1/2 max-w-md" />
      <LoadingBlock className="mt-10 h-40 w-full" />
    </div>
  );
}
