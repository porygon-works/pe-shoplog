import { BackButton } from "@/components/back-link";
import { announcementDate, listAnnouncements } from "@/lib/announcements";
import { requireAdmin } from "@/lib/auth/current-user";
import { createServerClient } from "@/lib/supabase/server";
import { AnnouncementAdminItem, NewAnnouncementForm } from "./announcement-form";

export const metadata = { title: "お知らせの管理" };

export default async function AdminAnnouncementsPage() {
  await requireAdmin();
  const items = await listAnnouncements(await createServerClient());
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 pb-24">
      <BackButton />
      <h1 className="m-0 text-lg font-bold">お知らせの管理</h1>
      <NewAnnouncementForm />
      <section className="flex flex-col gap-2">
        <h2 className="m-0 flex justify-between text-[13px] font-bold text-muted">
          <span>出したお知らせ</span>
          <span>{items.length}件</span>
        </h2>
        {items.length === 0 ? (
          <p className="m-0 text-[13px] text-muted">まだありません</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {items.map((a) => (
              <AnnouncementAdminItem key={a.id} id={a.id} title={a.title} body={a.body} date={announcementDate(a.createdAt)} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
