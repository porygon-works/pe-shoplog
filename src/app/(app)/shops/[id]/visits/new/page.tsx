import { requireUser } from "@/lib/auth/current-user";

// 仮のページ。行った記録の入力は後続のタスクで実装する。
export default async function NewVisitPage() {
  await requireUser();
  return (
    <main className="flex flex-col gap-4 bg-surface p-4">
      <h1 className="text-lg font-bold">行った記録（準備中）</h1>
    </main>
  );
}
