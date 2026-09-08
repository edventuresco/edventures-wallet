import { JoinScreen } from "@/components/join/JoinScreen";

export const metadata = { title: "Join your family" };

export default function JoinPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <JoinScreen />
    </main>
  );
}
