import { BottomNav } from "@/components/bottom-nav";
import { CategoriesProvider } from "@/components/categories-provider";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { NavTracker } from "@/components/nav-tracker";
import { ToastProvider } from "@/components/toast";
import { requireUser } from "@/lib/auth/current-user";
import { getCategories } from "@/lib/categories";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const categories = await getCategories();
  return (
    <ToastProvider>
      <ConfirmProvider>
        <CategoriesProvider categories={categories}>
          <NavTracker />
          <div className="flex min-h-dvh flex-1 flex-col">
            <div className="flex flex-1 flex-col">{children}</div>
            <BottomNav />
          </div>
        </CategoriesProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
