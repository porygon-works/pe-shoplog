import { BottomNav } from "@/components/bottom-nav";
import { CategoriesProvider } from "@/components/categories-provider";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { NavTracker } from "@/components/nav-tracker";
import { ScrollRestorer } from "@/components/scroll-restorer";
import { ClientErrorReporter } from "@/components/client-error-reporter";
import { ToastProvider } from "@/components/toast";
import { MapHost, MapHostProvider } from "./map/map-host";
import { requireUser } from "@/lib/auth/current-user";
import { getCategories } from "@/lib/categories";
import { unreadAnnouncementCount } from "@/lib/announcements";
import { createServerClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [categories, unread] = await Promise.all([
    getCategories(),
    // 下のメニュー「マイページ」に出す、お知らせの未読件数。失敗しても画面は出す。
    createServerClient()
      .then((s) => unreadAnnouncementCount(s, user.id))
      .catch((e) => {
        console.error("unread announcements failed", e);
        return 0;
      }),
  ]);
  return (
    <ToastProvider>
      <ConfirmProvider>
        <CategoriesProvider categories={categories}>
          <MapHostProvider>
            <NavTracker />
            <ScrollRestorer />
            <ClientErrorReporter />
            <div className="flex min-h-[calc(100dvh-env(safe-area-inset-top))] flex-1 flex-col">
              <div className="flex flex-1 flex-col">
                {children}
                <MapHost />
              </div>
              <BottomNav unread={unread} />
            </div>
          </MapHostProvider>
        </CategoriesProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
