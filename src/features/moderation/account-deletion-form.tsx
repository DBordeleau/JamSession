"use client";

import { useActionState, useState } from "react";
import { requestAccountDeletionAction, type FormState } from "./actions";

export function AccountDeletionForm({ username }: { username: string }) {
  const [requestId] = useState(() => crypto.randomUUID());
  const [confirmation, setConfirmation] = useState("");
  const [state, action, pending] = useActionState<FormState, FormData>(
    requestAccountDeletionAction,
    {},
  );
  return (
    <form action={action} className="mt-5 max-w-xl">
      <input type="hidden" name="requestId" value={requestId} />
      <label
        className="text-sm font-semibold"
        htmlFor="account-delete-confirmation"
      >
        Type {username} to confirm
      </label>
      <input
        id="account-delete-confirmation"
        name="username"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        autoComplete="off"
        className="settings-field border-strong bg-surface-soft/75 hover:border-danger/65 focus-visible:border-danger rounded-control mt-2 min-h-11 w-full border px-4 transition-[border-color,box-shadow,background-color]"
      />
      {state.message && (
        <p
          role="alert"
          className="text-danger rounded-control border-danger/40 bg-danger/8 mt-3 border p-3 text-sm"
        >
          {state.message}
        </p>
      )}
      <button
        className="border-danger text-danger hover:bg-danger/10 mt-4 inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        disabled={pending || confirmation !== username}
      >
        {pending ? "Starting deletion…" : "Delete account"}
      </button>
    </form>
  );
}
