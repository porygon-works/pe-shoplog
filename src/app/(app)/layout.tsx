import { BottomNav } from "@/components/bottom-nav";
import { CategoriesProvider } from "@/components/categories-provider";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { NavTracker } from "@/components/nav-tracker";
import { ScrollRestorer } from "@/components/scroll-restorer";
import { ToastProvider } from "@/components/toast";
import { MapHost, MapHostProvider } from "./map/map-host";
import { requireUser } from "@/lib/auth/current-user";
import { getCategories } from "@/lib/categories";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const categories = await getCategories();
  return (
    <ToastProvider>
      <ConfirmProvider>
        <CategoriesProvider categories={categories}>
          <MapHostProvider>
            <NavTracker />
            <ScrollRestorer />
            <div className="flex min-h-[calc(100dvh-env(safe-area-inset-top))] flex-1 flex-col">
              <div className="flex flex-1 flex-col">
                {children}
                <MapHost />
              </div>
              <BottomNav />
            </div>
          </MapHostProvider>
        </CategoriesProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
