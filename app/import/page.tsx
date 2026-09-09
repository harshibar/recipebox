import { Suspense } from "react";
import { ImportForm } from "@/components/ImportForm";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <Suspense fallback={<p className="text-sm text-black/50">Loading…</p>}>
      <ImportForm />
    </Suspense>
  );
}
