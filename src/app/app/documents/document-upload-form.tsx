"use client";

import { useActionState, useEffect, useRef } from "react";
import { Upload, Check } from "lucide-react";
import { uploadTemplate, type UploadState } from "./actions";

const initialState: UploadState = { status: "idle" };

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

const DOC_TYPE_OPTIONS = [
  { value: "lease_agreement", label: "Lease agreement" },
  { value: "house_rules", label: "House rules" },
  { value: "consent", label: "Consent form" },
  { value: "other", label: "Other" },
];

export function DocumentUploadForm() {
  const [state, action, pending] = useActionState(uploadTemplate, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="rounded-xl border border-border bg-surface p-6 shadow-sm"
    >
      <h2 className="text-sm font-semibold">Upload a document</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Add your own Lease, House Rules, Consent, or any custom form as a PDF.
        It&apos;s reused for every resident you send it to.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="text-sm font-medium">
            Document name
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="e.g. Resident Lease Agreement"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="type" className="text-sm font-medium">
            Category
          </label>
          <select id="type" name="type" defaultValue="other" className={fieldClass}>
            {DOC_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="file" className="text-sm font-medium">
          PDF file
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept="application/pdf"
          required
          className="mt-1.5 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary-hover"
        />
        <p className="mt-1 text-xs text-muted-foreground">PDF only, up to 20MB.</p>
      </div>

      {state.status === "success" && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent">
          <Check className="h-4 w-4" />
          {state.message}
        </p>
      )}
      {state.status === "error" && (
        <p className="mt-4 text-sm text-red-600">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Upload className="h-4 w-4" />
        {pending ? "Uploading…" : "Upload document"}
      </button>
    </form>
  );
}
