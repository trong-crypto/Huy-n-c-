"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { LineMark } from "@/components/hexagrams/HexagramView";
import { FieldError, FormField, PrimaryButton } from "@/components/ui/Controls";
import { buildLinesPayload, type LinesErrors, type LinesPayload } from "./linesInput";

type Props = { onSubmit: (payload: LinesPayload) => void; disabled?: boolean; busy?: boolean };

export function LinesForm({ onSubmit, disabled = false, busy = false }: Props) {
  const id = useId();
  const [lines, setLines] = useState<(boolean | null)[]>(() => Array(6).fill(null));
  const [movingLine, setMovingLine] = useState("");
  const [errors, setErrors] = useState<LinesErrors>({});
  const radios = useRef<(HTMLInputElement | null)[]>([]);
  const movingSelect = useRef<HTMLSelectElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || busy) return;
    const result = buildLinesPayload(lines, movingLine === "" ? undefined : Number(movingLine));
    if (!result.ok) {
      setErrors(result.errors);
      if (result.errors.lines) {
        const index = [5, 4, 3, 2, 1, 0].find(index => lines[index] === null);
        if (index !== undefined) radios.current[index]?.focus();
      } else movingSelect.current?.focus();
      return;
    }
    setErrors({});
    onSubmit(result.payload);
  }

  return (
    <form onSubmit={submit} noValidate className="form-stack" aria-label="Nhập sáu hào">
      <p id={`${id}-hint`} className="field-hint">Nhập từ hào 1 ở dưới lên hào 6 ở trên. Dương là nét liền, Âm là nét đứt. Hãy chọn đủ sáu hào trước khi gửi.</p>
      <fieldset disabled={busy} className="lines-editor" aria-describedby={`${id}-hint${errors.lines ? ` ${id}-lines-error` : ""}`}>
        <legend className="sr-only">Sáu hào từ dưới lên</legend>
        {[5, 4, 3, 2, 1, 0].map(index => {
          const invalid = Boolean(errors.lines && lines[index] === null);
          return (
            <fieldset key={index} className={`line-choice${invalid ? " line-choice--invalid" : ""}`}>
              <legend>Hào {index + 1}{Number(movingLine) === index + 1 && <span className="moving-marker">↔ Hào động</span>}</legend>
              <div className="line-options">
                {[false, true].map(yang => (
                  <label key={String(yang)} className="line-option">
                    <input type="radio" name={`${id}-line-${index}`} value={String(yang)}
                      ref={!yang ? element => { radios.current[index] = element; } : undefined}
                      checked={lines[index] === yang} required aria-invalid={invalid || undefined}
                      aria-describedby={invalid ? `${id}-lines-error` : undefined}
                      onChange={() => {
                        const next = lines.map((value, position) => position === index ? yang : value);
                        setLines(next);
                        if (next.every(value => typeof value === "boolean")) setErrors(current => ({ ...current, lines: undefined }));
                      }} />
                    <span className="line-option-content"><LineMark yang={yang} /><span>{yang ? "Dương — nét liền" : "Âm — nét đứt"}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </fieldset>
      {errors.lines && <FieldError id={`${id}-lines-error`}>{errors.lines}</FieldError>}
      <FormField id={`${id}-moving`} label="Hào động" hint="Chọn đúng một vị trí, tính từ hào 1 ở dưới cùng.">
        <select id={`${id}-moving`} ref={movingSelect} value={movingLine} required disabled={busy}
          aria-invalid={Boolean(errors.movingLine) || undefined}
          aria-describedby={`${id}-moving-hint${errors.movingLine ? ` ${id}-moving-error` : ""}`}
          onChange={event => { setMovingLine(event.target.value); setErrors(current => ({ ...current, movingLine: undefined })); }}>
          <option value="">Chọn hào động</option>
          {[1, 2, 3, 4, 5, 6].map(line => <option key={line} value={line}>Hào {line}{line === 1 ? " — dưới cùng" : line === 6 ? " — trên cùng" : ""}</option>)}
        </select>
      </FormField>
      {errors.movingLine && <FieldError id={`${id}-moving-error`}>{errors.movingLine}</FieldError>}
      <PrimaryButton type="submit" disabled={disabled || busy}>{busy ? "Đang chờ phản hồi…" : "Gửi yêu cầu"}</PrimaryButton>
      {disabled && !busy && <p className="field-hint">Cần kết nối Server để gửi. Bạn vẫn có thể chuẩn bị sáu hào.</p>}
    </form>
  );
}
