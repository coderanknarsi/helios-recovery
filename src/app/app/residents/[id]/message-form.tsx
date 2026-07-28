"use client";

import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { sendResidentMessage } from "./actions";

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

export function MessageForm({
  residentId,
  firstName,
  hasDevices,
}: {
  residentId: string;
  firstName: string;
  hasDevices: boolean;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
      >
        <Send className="h-4 w-4" />
        Send a message
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await sendResidentMessage(formData);
        formRef.current?.reset();
        setOpen(false);
      }}
      className="rounded-xl border border-border bg-surface-muted/40 p-4"
    >
      <input type="hidden" name="residentId" value={residentId} />

      <label className="block text-sm font-medium">
        Subject
        <input
          name="title"
          placeholder="Message from your house team"
          maxLength={80}
          className={fieldClass}
        />
      </label>

      <label className="mt-3 block text-sm font-medium">
        Message
        <textarea
          name="body"
          required
          rows={3}
          maxLength={500}
          placeholder={`Something ${firstName} needs to know.`}
          className={fieldClass}
        />
      </label>

      <p className="mt-2 text-xs text-muted-foreground">
        {hasDevices
          ? "This appears in their portal and pushes a notification to their phone."
          : "They have not turned on notifications, so this will wait in their portal until they open it. Call or text if it is urgent."}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover"
        >
          Send
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
