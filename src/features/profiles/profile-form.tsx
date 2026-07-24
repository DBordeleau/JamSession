"use client";

import { useActionState } from "react";
import { FiLock } from "react-icons/fi";
import { saveProfileAction, type ProfileFormState } from "./actions";

const onboardingFieldClass =
  "rounded-control border-strong bg-surface focus:border-accent mt-2 min-h-11 w-full border px-3 py-2 text-ink transition-colors";
const settingsFieldClass =
  "settings-field rounded-control border-strong bg-surface-soft/75 hover:border-accent-2/50 focus-visible:border-accent mt-2 min-h-11 w-full border px-3 py-2 text-ink transition-[border-color,box-shadow,background-color] disabled:cursor-not-allowed disabled:opacity-55";

function FieldErrors({
  id,
  errors,
}: {
  id: string;
  errors: string[] | undefined;
}) {
  if (!errors?.length) return null;
  return (
    <span id={id} className="text-danger mt-1.5 block text-sm">
      {errors.join(" ")}
    </span>
  );
}

export function ProfileForm({
  profile,
  returnTo,
  variant = "onboarding",
}: {
  profile: {
    username: string | null;
    displayName: string | null;
    creditName: string | null;
    bio: string | null;
  };
  returnTo?: "/dashboard";
  variant?: "onboarding" | "settings";
}) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(
    saveProfileAction,
    {},
  );
  const settings = variant === "settings";
  const fieldClass = settings ? settingsFieldClass : onboardingFieldClass;

  return (
    <form
      action={action}
      className={settings ? "mt-5 space-y-5" : "mt-8 space-y-6"}
      aria-describedby={state.message ? "form-error" : undefined}
    >
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      {state.message && (
        <p
          id="form-error"
          role="alert"
          className="text-danger rounded-control bg-danger/8 border border-current p-3 text-sm"
        >
          {state.message}
        </p>
      )}

      {settings && profile.username ? (
        <div>
          <span
            id="profile-username-label"
            className="block text-sm font-semibold"
          >
            Username
          </span>
          <input type="hidden" name="username" value={profile.username} />
          <p
            aria-labelledby="profile-username-label"
            className="border-subtle bg-surface-soft/45 text-muted rounded-control mt-2 flex min-h-11 items-center gap-2 border px-3"
          >
            <FiLock aria-hidden="true" className="shrink-0" />
            <span className="text-ink font-semibold">@{profile.username}</span>
            <span className="ml-auto font-mono text-[9.5px] tracking-[0.12em] uppercase">
              Permanent
            </span>
          </p>
          <p className="text-muted mt-1.5 text-sm">
            Your public profile address is locked after onboarding.
          </p>
        </div>
      ) : (
        <label className="block">
          <span className="font-semibold">Username</span>
          <span className="text-muted ml-2 text-sm">
            Public handle; permanent after saving
          </span>
          <div className="flex items-center">
            <span aria-hidden="true" className="text-muted mt-2 mr-2">
              @
            </span>
            <input
              className={fieldClass}
              name="username"
              defaultValue={profile.username ?? ""}
              readOnly={Boolean(profile.username)}
              autoComplete="username"
              aria-invalid={Boolean(state.fields?.username)}
              aria-describedby={
                state.fields?.username ? "profile-username-error" : undefined
              }
            />
          </div>
          <FieldErrors
            id="profile-username-error"
            errors={state.fields?.username}
          />
        </label>
      )}

      <label className="block">
        <span className="font-semibold">Display name</span>
        {settings && (
          <span className="text-muted ml-2 text-sm">Shown across OpenMIDI</span>
        )}
        <input
          aria-label="Display name"
          className={fieldClass}
          name="displayName"
          defaultValue={profile.displayName ?? ""}
          maxLength={80}
          autoComplete="name"
          aria-invalid={Boolean(state.fields?.displayName)}
          aria-describedby={
            state.fields?.displayName ? "profile-display-name-error" : undefined
          }
        />
        <FieldErrors
          id="profile-display-name-error"
          errors={state.fields?.displayName}
        />
      </label>

      <label className="block">
        <span className="font-semibold">Credit name</span>
        <span className="text-muted ml-2 text-sm">
          How music credits should identify you
        </span>
        <input
          aria-label="Credit name"
          className={fieldClass}
          name="creditName"
          defaultValue={profile.creditName ?? ""}
          maxLength={120}
          aria-invalid={Boolean(state.fields?.creditName)}
          aria-describedby={
            state.fields?.creditName ? "profile-credit-name-error" : undefined
          }
        />
        <FieldErrors
          id="profile-credit-name-error"
          errors={state.fields?.creditName}
        />
      </label>

      <label className="block">
        <span className="font-semibold">Bio</span>
        {settings && (
          <span className="text-muted ml-2 text-sm">
            A short note for listeners
          </span>
        )}
        <textarea
          aria-label="Bio"
          className={`${fieldClass} min-h-32 resize-y`}
          name="bio"
          defaultValue={profile.bio ?? ""}
          maxLength={500}
          aria-invalid={Boolean(state.fields?.bio)}
          aria-describedby={state.fields?.bio ? "profile-bio-error" : undefined}
        />
        <FieldErrors id="profile-bio-error" errors={state.fields?.bio} />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="cta-gradient inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-semibold transition-transform duration-200 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 motion-reduce:translate-y-0 motion-reduce:transition-none"
      >
        {pending
          ? "Saving…"
          : profile.username
            ? "Save profile"
            : "Complete profile"}
      </button>
    </form>
  );
}
