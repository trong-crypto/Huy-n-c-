// Category artwork only: independent of input, Server responses and calculations.
export function TamTheArt() {
  return (
    <div className="tamthe-themes" role="group" aria-label="Minh họa các chủ đề Tam Thế">
      <svg className="tamthe-constellation" viewBox="0 0 360 128" fill="none" aria-hidden="true" focusable="false">
        <path d="M36 112a144 92 0 0 1 288 0M60 112a120 76 0 0 1 240 0" stroke="currentColor" opacity=".3" />
        <path d="M78 112 180 36l102 76M180 12v12m-6-6h12M36 112h288" stroke="currentColor" opacity=".55" />
        <circle cx="180" cy="36" r="5" stroke="currentColor" />
        <circle cx="78" cy="112" r="3" fill="currentColor" />
        <circle cx="282" cy="112" r="3" fill="currentColor" />
        <path d="m57 45 2 6 6 2-6 2-2 6-2-6-6-2 6-2Zm243-6 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="currentColor" />
      </svg>
      <p className="tamthe-art-title">Ba miền nhân sinh</p>
      <ul className="tamthe-theme-list">
        <li>
          <span className="theme-medallion"><svg viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false"><path d="M9 39h30M14 39V19m20 20V19M8 19 24 9l16 10H8Zm11 5v10m10-10v10M24 5v4" /></svg></span>
          <span>Công danh</span>
        </li>
        <li>
          <span className="theme-medallion"><svg viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false"><circle cx="24" cy="24" r="16" /><circle cx="24" cy="24" r="12" opacity=".5" /><path d="M19 19h10v10H19ZM24 4v4m0 32v4M4 24h4m32 0h4" /></svg></span>
          <span>Tài lộc</span>
        </li>
        <li>
          <span className="theme-medallion"><svg viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false"><path d="M24 38S8 28 8 18a9 9 0 0 1 16-5 9 9 0 0 1 16 5c0 10-16 20-16 20ZM17 17c-3 1-3 5 0 8" /><path d="m24 4 1 3 3 1-3 1-1 3-1-3-3-1 3-1Z" /></svg></span>
          <span>Tình duyên</span>
        </li>
      </ul>
      <p className="tamthe-art-note">Biểu tượng chủ đề, không phải kết quả luận giải.</p>
    </div>
  );
}
