"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type Confirm = (message: string) => Promise<boolean>;
type Pending = { message: string; resolve: (ok: boolean) => void };

const ConfirmContext = createContext<Confirm | null>(null);

export function useConfirm(): Confirm {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm は ConfirmProvider の内側で使ってください");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const confirm = useCallback<Confirm>((message) => {
    // 既に開いているものがあれば、キャンセル扱いで閉じてから開き直す。
    pendingRef.current?.resolve(false);
    return new Promise<boolean>((resolve) => {
      returnFocus.current = document.activeElement as HTMLElement | null;
      const p = { message, resolve };
      pendingRef.current = p;
      setPending(p);
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    pendingRef.current?.resolve(ok);
    pendingRef.current = null;
    setPending(null);
    returnFocus.current?.focus?.();
  }, []);

  useEffect(() => {
    if (pending) okRef.current?.focus();
  }, [pending]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-[rgba(10,15,25,.45)]"
          onClick={() => settle(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-message"
            className="mx-auto flex w-full max-w-xl flex-col gap-3 rounded-t-[18px] bg-surface p-4 pb-[calc(16px+env(safe-area-inset-bottom))] motion-safe:animate-[sheet-up_.18s_ease-out]"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") settle(false);
            }}
          >
            <p id="confirm-message" className="m-0 text-base font-bold">
              {pending.message}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn" onClick={() => settle(false)}>
                キャンセル
              </button>
              <button ref={okRef} type="button" className="btn btn-accent" onClick={() => settle(true)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
