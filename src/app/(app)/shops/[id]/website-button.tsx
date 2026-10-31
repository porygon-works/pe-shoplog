"use client";

import { useState } from "react";
import { useToast } from "@/components/toast";

/** タップした時だけ Google からサイト URL を取得して開く（保存はしない）。 */
export function WebsiteButton({ placeId }: { placeId: string }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const open = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/places/website?id=${encodeURIComponent(placeId)}`);
      if (!res.ok) throw new Error(`website ${res.status}`);
      const data = (await res.json()) as { url: string | null };
      if (!data.url) {
        toast.show("サイト情報がありません");
        return;
      }
      window.open(data.url, "_blank", "noopener");
    } catch {
      toast.show("サイト情報を取得できませんでした", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button type="button" className="btn flex-1 !px-2.5 !py-[7px] text-[13px]" onClick={open} disabled={loading}>
      🌐 公式サイト
    </button>
  );
}
