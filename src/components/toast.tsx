"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type Kind = "info" | "error";
type ToastApi = { show: (message: string, kind?: Kind) => void };
type Item = { id: number; message: string; kind: Kind };

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast は ToastProvider の内側で使ってください");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const set = timers.current;
    return () => set.forEach(clearTimeout);
  }, []);

  const show = useCallback((message: string, kind: Kind = "info") => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, message, kind }]);
    const t = setTimeout(
      () => {
        timers.current.delete(t);
        setItems((prev) => prev.filter((i) => i.id !== id));
      },
      kind === "error" ? 4000 : 2200,
    );
    timers.current.add(t);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {items.map((i) => (
          <div
            key={i.id}
            className={`max-w-full rounded-full px-3.5 py-2 text-[13px] shadow-lg ${
              i.kind === "error" ? "bg-shu text-white" : "bg-ink text-surface"
            }`}
          >
            {i.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
