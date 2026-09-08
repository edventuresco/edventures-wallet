import { KidHomeLive } from "@/components/kid/KidHomeLive";
import { getKidSendContext } from "./actions";
import { requestContact } from "./contact-actions";
import { getKidHome } from "./data";
import { NotPaired } from "./not-paired";
import { nameOwl } from "./owl-actions";
import { getKidShareContext } from "./share-actions";

export default async function KidHomePage() {
  const view = await getKidHome();
  if (!view) return <NotPaired />;
  const [send, share] = await Promise.all([getKidSendContext(), getKidShareContext()]);
  const approvedSend = send.ok && send.approvedSend ? { requestId: send.approvedSend.requestId, contactId: send.approvedSend.contactId, dollars: send.approvedSend.dollars } : undefined;
  const approvedShare = share.ok && share.approvedShare ? { requestId: share.approvedShare.requestId, contactId: share.approvedShare.contactId, dollars: share.approvedShare.dollars } : undefined;
  return <KidHomeLive view={view} approvedSend={approvedSend} approvedShare={approvedShare} onNameOwl={nameOwl} onAskToAdd={requestContact} />;
}
