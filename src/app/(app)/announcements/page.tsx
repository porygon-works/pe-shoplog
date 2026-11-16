import { BackButton } from "@/components/back-link";
import { LinkifiedText } from "@/components/linkified-text";
import { announcementDate, listAnnouncements } from "@/lib/announcements";
import { requireUser } from "@/lib/auth/current-user";
import { createServerClient } from "@/lib/supabase/server";
import { MarkAnnouncementsRead } from "./mark-read";

export const metadata = { title: "お知らせ" };

export default async function AnnouncementsPage() {
  const user = await requireUser();
  const items = await listAnnouncements(await createServerClient(), { userId: user.id });

  return (
    <main className="flex flex-1 flex-col bg-surface">
      <MarkAnnouncementsRead />
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <BackButton />
        <h1 className="m-0 text-base font-bold">お知らせ</h1>
      </header>
      {items.length === 0 ? (
        <p className="m-0 p-4 text-[13px] text-muted">お知らせはまだありません</p>
      ) : (
        <ul data-testid="announcements" className="m-0 flex list-none flex-col p-0">
          {items.map((a) => (
            <li key={a.id} className="flex flex-col gap-1.5 border-b border-line px-4 py-3">
              <span className="text-xs text-muted">{announcementDate(a.publishedAt)}</span>
              <h2 className="m-0 text-[15px] font-bold">{a.title}</h2>
              {a.body && <LinkifiedText text={a.body} className="text-sm" />}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
