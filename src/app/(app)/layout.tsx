import { BottomNav } from "@/components/bottom-nav";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { ToastProvider } from "@/components/toast";
import { requireUser } from "@/lib/auth/current-user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="flex min-h-dvh flex-1 flex-col">
          <div className="flex flex-1 flex-col">{children}</div>
          <BottomNav />
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}
