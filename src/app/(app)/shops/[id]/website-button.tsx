/**
 * 公式サイトへのリンク。タップで /shops/{id}/website を新しいタブで開き、
 * そのページがサーバーで Google からサイト URL を取得してリダイレクトする。
 * （fetch のあとに window.open すると iOS Safari にブロックされるため、リンクにしている。）
 */
export function WebsiteButton({ shopId }: { shopId: string }) {
  return (
    <a
      href={`/shops/${shopId}/website`}
      target="_blank"
      rel="noopener noreferrer"
      className="btn flex-1 !px-2.5 !py-[7px] text-[13px]"
    >
      🌐 公式サイト
    </a>
  );
}
