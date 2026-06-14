import { TopBar } from "@/components/shell/TopBar";
import { CoachChat } from "./_components/CoachChat";

export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return (
    <>
      <TopBar title="Coach" />
      <CoachChat initialQuery={q} />
    </>
  );
}
