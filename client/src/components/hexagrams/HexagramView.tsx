import type { HexagramView as HexagramData, SixLines } from "@/types/contract";

export function LineMark({ yang }: { yang: boolean }) {
  return <span aria-hidden="true" className={`line-mark ${yang ? "line-mark--yang" : "line-mark--yin"}`}>
    <span />{!yang && <span />}
  </span>;
}

type Props = {
  roleLabel: string;
  linesBottomUp: Readonly<SixLines>;
  code?: HexagramData["code"];
  name?: string | null;
  nameStatus?: HexagramData["nameStatus"];
  movingLine?: number;
};

// Presentation only: never compute another hexagram or derive its identity.
export function HexagramView({ roleLabel, linesBottomUp, code, name, nameStatus, movingLine }: Props) {
  const approvedName = nameStatus === "VERIFIED" && name != null ? name : null;
  return (
    <figure className="hexagram" aria-label={roleLabel}>
      <figcaption>
        <p className="eyebrow">{roleLabel}</p>
        {approvedName ? <h3>{approvedName}</h3> : <p className="field-hint">Chưa có tên đã duyệt</p>}
        {approvedName && <p className="hexagram-name-status">Tên quẻ đã được đối chiếu</p>}
        {code && <code className="hexagram-code">{code}</code>}
      </figcaption>
      <ol className="hexagram-lines" aria-label={`Sáu hào của ${roleLabel}`}>
        {[5, 4, 3, 2, 1, 0].map(index => (
          <li key={index} data-line-number={index + 1} className={movingLine === index + 1 ? "hexagram-line is-moving" : "hexagram-line"}>
            <span className="hexagram-line-label">Hào {index + 1}<span className="sr-only"> — {linesBottomUp[index] ? "Dương" : "Âm"}</span></span>
            <LineMark yang={linesBottomUp[index]} />
            {movingLine === index + 1 && <span className="moving-marker">↔ Hào động</span>}
          </li>
        ))}
      </ol>
    </figure>
  );
}
