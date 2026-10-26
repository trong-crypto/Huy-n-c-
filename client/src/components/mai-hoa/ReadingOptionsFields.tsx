import { FieldError, FormField } from "@/components/ui/Controls";
import type { MaiHoaPayload } from "@/types/contract";
import { READING_TOPICS, TIME_MAX_DATETIME, TIME_MIN_DATETIME, type ReadingInputError, type ReadingSelection } from "./maiHoaInput";

export const readingFieldIds = { readingTopic: "maihoa-reading-topic", readingDatetime: "maihoa-reading-datetime" };
export const readingTopicLabels = { GENERAL: "Tổng quan", CAREER: "Công việc", WEALTH: "Tài lộc", LOVE: "Tình duyên" };

export function ReadingOptionsFields({ method, value, onChange, error, disabled }: {
  method: MaiHoaPayload["method"]; value: ReadingSelection; onChange: (value: ReadingSelection) => void;
  error: ReadingInputError | null; disabled: boolean;
}) {
  return <fieldset className="reading-options" disabled={disabled}>
    <legend>Nội dung kết quả</legend>
    <div className="reading-mode-options">
      <label className="checkbox-field"><input type="radio" name="maihoa-reading-mode" checked={!value.enabled}
        onChange={() => onChange({ ...value, enabled: false })} />Chỉ lập quẻ</label>
      <label className="checkbox-field"><input type="radio" name="maihoa-reading-mode" checked={value.enabled}
        onChange={() => onChange({ ...value, enabled: true })} />Luận giải chi tiết</label>
    </div>
    {value.enabled && <div className="reading-options-fields">
      <FormField id={readingFieldIds.readingTopic} label="Chủ đề luận giải" hint="Chọn chủ đề rõ ràng; không suy đoán từ nội dung câu hỏi.">
        <select id={readingFieldIds.readingTopic} value={value.topic} required
          aria-invalid={error?.field === "readingTopic" || undefined}
          aria-describedby={`${readingFieldIds.readingTopic}-hint${error?.field === "readingTopic" ? ` ${readingFieldIds.readingTopic}-error` : ""}`}
          onChange={event => onChange({ ...value, topic: event.target.value })}>
          <option value="">Chọn chủ đề</option>
          {READING_TOPICS.map(topic => <option key={topic} value={topic}>{readingTopicLabels[topic]}</option>)}
        </select>
        {error?.field === "readingTopic" && <FieldError id={`${readingFieldIds.readingTopic}-error`}>{error.message}</FieldError>}
      </FormField>
      {method === "TIME" ? <p className="field-hint">Luận theo thời điểm lập quẻ đã nhập ở trên, UTC+07:00. Không có thời điểm thứ hai.</p> :
        <FormField id={readingFieldIds.readingDatetime} label="Thời điểm luận (tùy chọn, UTC+07:00)" hint="Để trống nếu không muốn xét mùa. Không tự lấy thời gian hiện tại; khoảng 1900–2099, chính xác đến phút.">
          <input id={readingFieldIds.readingDatetime} type="datetime-local" step={60} min={TIME_MIN_DATETIME} max={TIME_MAX_DATETIME}
            value={value.datetime} onChange={event => onChange({ ...value, datetime: event.target.value })}
            aria-invalid={error?.field === "readingDatetime" || undefined}
            aria-describedby={`${readingFieldIds.readingDatetime}-hint${error?.field === "readingDatetime" ? ` ${readingFieldIds.readingDatetime}-error` : ""}`} />
          {error?.field === "readingDatetime" && <FieldError id={`${readingFieldIds.readingDatetime}-error`}>{error.message}</FieldError>}
        </FormField>}
    </div>}
  </fieldset>;
}
