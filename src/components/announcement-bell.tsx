import Link from "next/link";

/** マイページの右上に置く、お知らせへの鈴。未読があれば赤い点を付ける。 */
export function AnnouncementBell({ unread }: { unread: boolean }) {
  return (
    <Link
      href="/announcements"
      aria-label={unread ? "お知らせ（未読あり）" : "お知らせ"}
      data-testid="announcement-bell"
      className="relative grid h-9 w-9 place-items-center rounded-full text-ink no-underline hover:bg-surface-2"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9" />
        <path d="M10 19a2 2 0 0 0 4 0" />
      </svg>
      {unread && (
        <span data-testid="announcement-unread" className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-shu" />
      )}
    </Link>
  );
}
