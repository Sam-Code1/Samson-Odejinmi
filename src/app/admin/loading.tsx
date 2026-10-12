import { Skeleton } from "@/components/admin/AdminStates";

export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-8">
      <div className="space-y-3"><Skeleton className="h-3 w-24" /><Skeleton className="h-11 w-64" /><Skeleton className="h-4 w-96 max-w-full" /></div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      <div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-72 lg:col-span-2" /><Skeleton className="h-72" /></div>
    </div>
  );
}
