import { ListCard } from "@/components/list-card";
import { SharedListTab } from "@/components/shared-list-tab";
import { VisitLogList } from "@/components/visit-log-list";
import { requireUser } from "@/lib/auth/current-user";
import { listSummariesOf, sharedListSummariesOf, visitLogOf } from "@/lib/lists/queries";
import { createServerClient } from "@/lib/supabase/server";
import { AccountPanel } from "./account-panel";
import { MeTabs } from "./me-tabs";
import { NewListButton } from "./new-list-button";
import { parseMeTab } from "./tabs";

export default async function MePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const { tab } = await searchParams;
  const supabase = await createServerClient();
  const [lists, shared, visits] = await Promise.all([
    listSummariesOf(supabase, user.id),
    sharedListSummariesOf(supabase, user.id),
    visitLogOf(supabase, user.id),
  ]);

  return (
    <main className="flex flex-1 flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h1 className="m-0 flex-1 text-base font-bold">マイページ</h1>
        <span className="text-xs text-muted">{user.loginId}</span>
      </header>
      <div className="flex flex-col gap-3 p-4">
        <MeTabs
          initial={parseMeTab(tab)}
          panels={{
            lists: (
              <>
                <NewListButton />
                {lists.map((l) => (
                  <ListCard key={l.id} list={l} />
                ))}
              </>
            ),
            shared: <SharedListTab lists={shared} />,
            logs: <VisitLogList entries={visits} />,
            account: <AccountPanel nickname={user.nickname} isAdmin={user.isAdmin} />,
          }}
        />
      </div>
    </main>
  );
}
