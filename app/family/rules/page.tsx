import { redirect } from "next/navigation";

/** Rules moved under Settings. */
export default function RulesMoved() {
  redirect("/settings/rules");
}
