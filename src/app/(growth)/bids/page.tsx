import { redirect } from "next/navigation";

// The bid desk lives in Researched → Bids Interested In (per Rameel 2026-09-10).
export default function BidsRedirect() {
  redirect("/researched?tab=bids");
}
