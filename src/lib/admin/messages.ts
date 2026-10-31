export type AdminError = "forbidden" | "not_found" | "invalid" | "self" | "server_error";
export type AdminResult = { ok: true } | { ok: false; error: AdminError };

export function adminErrorMessage(error: AdminError): string {
  switch (error) {
    case "forbidden":
      return "この操作を行う権限がありません";
    case "not_found":
      return "対象が見つかりませんでした（すでに削除されている可能性があります）";
    case "invalid":
      return "入力内容を確認してください";
    case "self":
      return "自分自身には行えない操作です（管理者がいなくなるのを防ぐため）";
    case "server_error":
      return "処理に失敗しました。時間をおいてもう一度お試しください";
  }
}
