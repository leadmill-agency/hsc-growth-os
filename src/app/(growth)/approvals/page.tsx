import { redirect } from "next/navigation";

// Approvals dissolved into the Researched hub (per Rameel 2026-09-10): email
// drafts render on their researched cards; bid decisions are Pursue/Dismiss in
// Opportunities; anything else pends at the bottom of Researched.
export default function ApprovalsRedirect() {
  redirect("/researched");
}
