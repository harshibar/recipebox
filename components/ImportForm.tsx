"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { SourceType } from "@/lib/domain/types";

/**
 * Import screen.
 *
 * Takes photos and text together in one submission. That matters for the
 * Instagram path: a share usually delivers only a permalink, and the recipe
 * itself lives in the caption or the video — so the honest flow is "here's the
 * link, and here are screenshots of the caption", parsed as one recipe.
 */
export function ImportForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const sharedFromAndroid = params.get("source") === "instagram";

  // Populated when Android's share sheet posts to /api/share.
  useEffect(() => {
    const shared = params.get("shared");
    if (shared) setText((current) => current || shared);
  }, [params]);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    setFiles((current) => [...current, ...Array.from(incoming)].slice(0, 6));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    if (files.length === 0 && !text.trim()) {
      setError("Add a photo or paste some recipe text.");
      return;
    }

    setBusy(true);
    setError(null);

    const body = new FormData();
    for (const file of files) body.append("images", file);
    if (text.trim()) body.append("text", text.trim());

    const sourceType: SourceType = sharedFromAndroid
      ? "instagram"
      : files.length > 0
        ? "photo"
        : "manual";
    body.append("sourceType", sourceType);

    const link = text.match(/https?:\/\/\S+/)?.[0];
    if (link) body.append("sourceRef", link);

    try {
      const res = await fetch("/api/import", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      router.push(`/recipes/${data.recipe.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Add a recipe</h1>
        <p className="mt-1 text-sm text-black/60">
          Handwritten card, cookbook page, screenshot, or plain text. Claude
          transcribes it and works out the weights.
        </p>
      </div>

      <section className="rounded-xl border border-black/10 bg-white p-4">
        <label className="text-sm font-medium">Photos</label>
        <p className="mt-0.5 text-xs text-black/50">
          Up to 6. Multiple photos of one recipe are read together.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {files.map((file, i) => (
            <span
              key={`${file.name}-${i}`}
              className="flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 text-xs"
            >
              {file.name.slice(0, 28)}
              <button
                type="button"
                onClick={() => setFiles((f) => f.filter((_, j) => j !== i))}
                className="text-black/40 hover:text-crust"
                aria-label={`Remove ${file.name}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => addFiles(e.target.files)}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="mt-3 rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:border-crust/50"
        >
          Choose photos
        </button>
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-4">
        <label htmlFor="text" className="text-sm font-medium">
          Text or link
        </label>
        <p className="mt-0.5 text-xs text-black/50">
          Paste an Instagram caption, a URL, or type the recipe out.
        </p>
        <textarea
          id="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={"2 cups flour\n1 tsp salt\n..."}
          className="mt-3 w-full rounded-lg border border-black/15 bg-paper p-3 text-sm outline-none focus:border-crust/50"
        />
        {sharedFromAndroid && (
          <p className="mt-2 rounded-lg bg-herb/10 p-2 text-xs text-herb">
            Shared from another app. If this is only a link, add a screenshot of
            the caption too — a link alone rarely contains the recipe.
          </p>
        )}
      </section>

      {error && (
        <p className="rounded-lg bg-crust/10 p-3 text-sm text-crust">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-crust px-4 py-2.5 text-sm font-medium text-white hover:bg-crust/90 disabled:opacity-50"
      >
        {busy ? "Reading the recipe…" : "Import recipe"}
      </button>
    </form>
  );
}
