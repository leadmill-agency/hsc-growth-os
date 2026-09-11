import { resolveApprovalAction, findEmailForApprovalAction } from "@/app/actions";
import type { approvals } from "@/lib/db/schema";

// One pending email draft, fully editable, with the guarded send. Lives on the
// Researched tab (per Rameel 2026-09-10: drafts belong with their research, not
// in a separate approvals inbox).

export interface EmailDraft {
  subject?: string;
  body?: string;
  alternate_subject?: string;
  alternate_body?: string;
  target_contact?: string;
  rationale?: string;
  suggested_email?: string;
  suggested_email_confidence?: number;
  suggested_email_source?: string;
  suggested_email_note?: string;
}

const rejectionCodes: [string, string][] = [
  ["too_far", "Too far away"],
  ["no_sign_scope", "No sign/canopy scope"],
  ["too_small", "Job too small"],
  ["low_margin", "Margin too thin"],
  ["no_capacity", "No bandwidth right now"],
  ["wrong_fit", "Not our kind of work/GC"],
  ["draft_wrong", "Draft is wrong — needs redo"],
  ["other", "Other"],
];

export function EmailApprovalCard({ approval }: { approval: typeof approvals.$inferSelect }) {
  const draft = ((approval.payload ?? {}) as { draft?: EmailDraft }).draft ?? {};
  const formId = `approve-${approval.id}`;
  const hasAlternate = !!draft.alternate_body;
  return (
    <div className="rounded-lg border border-amber-200 bg-white p-4">
      <div className="text-sm font-semibold">{approval.title}</div>
      {draft.target_contact && (
        <p className="mt-1 text-sm">
          <span className="font-medium">To:</span> {draft.target_contact}{" "}
          {draft.suggested_email ? (
            <span className="text-xs">
              — found <span className="font-medium">{draft.suggested_email}</span>{" "}
              <span
                className={
                  draft.suggested_email_confidence != null && draft.suggested_email_confidence >= 80
                    ? "text-emerald-700"
                    : "text-amber-700"
                }
              >
                ({draft.suggested_email_confidence ?? "?"}% confidence
                {draft.suggested_email_confidence != null && draft.suggested_email_confidence < 80
                  ? " — double-check before sending"
                  : ""}
                )
              </span>{" "}
              <span className="text-steel">— pre-filled below</span>
            </span>
          ) : draft.suggested_email_note ? (
            <span className="text-xs font-medium text-amber-700">— {draft.suggested_email_note}</span>
          ) : (
            <span className="text-xs text-steel">
              — no email found automatically; paste their verified email below to send
            </span>
          )}
        </p>
      )}
      <div className="mt-2 space-y-2">
        <div className="rounded-lg border border-fog bg-cloud/40 p-3 has-[:checked]:border-signal">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink-700">
            {hasAlternate && (
              <input type="radio" name="draftVersion" value="primary" defaultChecked form={formId} />
            )}
            {hasAlternate ? "Version A" : "The email"}
            <span className="font-normal text-steel">— edit freely; your edits are what send</span>
          </label>
          <input
            name="subject_primary"
            form={formId}
            defaultValue={draft.subject ?? ""}
            className="mt-1.5 w-full rounded border border-fog bg-white px-2 py-1 text-sm font-medium"
          />
          <textarea
            name="body_primary"
            form={formId}
            defaultValue={draft.body ?? ""}
            rows={Math.min(12, Math.max(5, (draft.body ?? "").split("\n").length + 2))}
            className="mt-1.5 w-full rounded border border-fog bg-white px-2 py-1.5 text-sm leading-relaxed"
          />
        </div>
        {hasAlternate && (
          <div className="rounded-lg border border-fog bg-cloud/40 p-3 has-[:checked]:border-signal">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink-700">
              <input type="radio" name="draftVersion" value="alternate" form={formId} />
              Version B — the selected version is what sends
            </label>
            <input
              name="subject_alternate"
              form={formId}
              defaultValue={draft.alternate_subject ?? draft.subject ?? ""}
              className="mt-1.5 w-full rounded border border-fog bg-white px-2 py-1 text-sm font-medium"
            />
            <textarea
              name="body_alternate"
              form={formId}
              defaultValue={draft.alternate_body ?? ""}
              rows={Math.min(12, Math.max(5, (draft.alternate_body ?? "").split("\n").length + 2))}
              className="mt-1.5 w-full rounded border border-fog bg-white px-2 py-1.5 text-sm leading-relaxed"
            />
          </div>
        )}
        {draft.rationale && <p className="text-xs text-steel">Why written this way: {draft.rationale}</p>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={resolveApprovalAction} id={formId} className="flex items-center gap-2">
          <input type="hidden" name="approvalId" value={approval.id} />
          <input type="hidden" name="decision" value="approved" />
          <input
            name="recipientEmail"
            type="email"
            defaultValue={draft.suggested_email ?? ""}
            placeholder="Recipient email (verified) — sends on approve"
            className="w-72 rounded border border-fog px-2 py-1 text-xs"
          />
          <button className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white">
            Approve (+ send if email given)
          </button>
        </form>
        <form action={resolveApprovalAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="approvalId" value={approval.id} />
          <input type="hidden" name="decision" value="rejected" />
          <select name="rejectionCode" defaultValue="" className="rounded border border-fog px-2 py-1 text-xs text-ink-700">
            <option value="">Why reject? (optional)</option>
            {rejectionCodes.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
          <button className="rounded bg-fog px-3 py-1.5 text-xs font-medium">Discard draft</button>
        </form>
        {!draft.suggested_email && (
          <form action={findEmailForApprovalAction}>
            <input type="hidden" name="approvalId" value={approval.id} />
            <button
              className="rounded border border-fog bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:border-signal"
              title="Look up this contact's work email with Hunter"
            >
              Find email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
