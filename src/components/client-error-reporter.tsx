"use client";

import { useEffect } from "react";
import { describeError, flushClientErrors, reportClientError } from "@/lib/log/client";

/** 画面で起きた想定外のエラーを操作ログに送る。圏外のときにためたものも送る。 */
export function ClientErrorReporter() {
  useEffect(() => {
    void flushClientErrors();
    const onOnline = () => void flushClientErrors();
    const onError = (e: ErrorEvent) =>
      reportClientError("client_error", { message: String(e.message).slice(0, 200), source: e.filename, line: e.lineno });
    const onRejection = (e: PromiseRejectionEvent) => reportClientError("client_rejection", describeError(e.reason));
    window.addEventListener("online", onOnline);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
