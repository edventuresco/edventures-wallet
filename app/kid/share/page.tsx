import { ShareScreenLive } from "@/components/kid/ShareScreenLive";
import { NotPaired } from "../not-paired";
import { getKidShareContext, requestShare } from "../share-actions";

export const metadata = { title: "Share jar" };

/** Wraps the server action so the client gets the { ok, message } shape the screen expects. */
async function ask(contactId: string, dollars: string) {
  "use server";
  return requestShare({ contactId, dollars });
}

export default async function KidSharePage() {
  const share = await getKidShareContext();
  if (!share.ok) return <NotPaired />;
  return (
    <ShareScreenLive
      contacts={share.contacts}
      shareDisplay={share.shareDisplay}
      shareUnits={share.shareUnits}
      parentName={share.parentName}
      approvedShare={share.approvedShare ? { requestId: share.approvedShare.requestId, contactId: share.approvedShare.contactId, dollars: share.approvedShare.dollars } : undefined}
      pendingShare={share.pendingShare ? { contactId: share.pendingShare.contactId, dollars: share.pendingShare.dollars } : undefined}
      onRequest={ask}
    />
  );
}
