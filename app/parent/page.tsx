import { FamilyOverview } from "@/components/parent/FamilyOverview";
import { getMockFamily } from "@/lib/mock/family";

export default function ParentHomePage() {
  // TODO(backend): replace the fixture with the signed-in guardian's family.
  const family = getMockFamily();
  return <FamilyOverview {...family} />;
}
