import { getWhoopClient } from "@/lib/whoop/client";
import { TopBar } from "@/components/shell/TopBar";
import { Card, CardLabel } from "@/components/ui/Card";
import { BehaviorList } from "./_components/BehaviorList";

export default async function JournalPage() {
  const client = await getWhoopClient();
  const journal = await client.getJournal();

  const categories = Array.from(
    new Set(journal.behaviors.map((b) => b.category)),
  );

  const byCategory = categories.map((cat) => ({
    category: cat,
    behaviors: journal.behaviors.filter((b) => b.category === cat),
  }));

  return (
    <>
      <TopBar title="Journal" back />
      <div className="px-4 pb-12 pt-6">
        <p className="text-sm leading-relaxed text-muted">
          How your behaviors affected recovery on{" "}
          <span className="font-semibold text-fg">{journal.date}</span>.
        </p>

        <div className="mt-5 space-y-3">
          {byCategory.map(({ category, behaviors }) => (
            <Card key={category}>
              <CardLabel>{category}</CardLabel>
              <BehaviorList behaviors={behaviors} />
            </Card>
          ))}
        </div>

        {journal.notes && (
          <Card className="mt-3">
            <CardLabel>Notes</CardLabel>
            <p className="mt-2 text-sm leading-relaxed text-muted">{journal.notes}</p>
          </Card>
        )}
      </div>
    </>
  );
}
