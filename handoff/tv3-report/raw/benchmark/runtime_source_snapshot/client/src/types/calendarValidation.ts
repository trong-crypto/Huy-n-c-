import type { CalendarResult, CanChiResult } from "./contract";
import { isRecord, isResultEvidence } from "./contractValidation";
import { validGregorianDate } from "@/components/calendar/calendarInput";

export const STEM_LABELS = { GIAP: "Giáp", AT: "Ất", BINH: "Bính", DINH: "Đinh", MAU: "Mậu", KY: "Kỷ", CANH: "Canh", TAN: "Tân", NHAM: "Nhâm", QUY: "Quý" };
export const BRANCH_LABELS = { TY: "Tý", SUU: "Sửu", DAN: "Dần", MAO: "Mão", THIN: "Thìn", TI: "Tỵ", NGO: "Ngọ", MUI: "Mùi", THAN: "Thân", DAU: "Dậu", TUAT: "Tuất", HOI: "Hợi" };
const range = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
function pair(value: unknown) {
  return isRecord(value) && typeof value.stem === "string" && Object.hasOwn(STEM_LABELS, value.stem)
    && typeof value.branch === "string" && Object.hasOwn(BRANCH_LABELS, value.branch);
}
export function isCalendarResult(value: unknown): value is CalendarResult {
  if (!isRecord(value)) return false;
  const { timezone, solarDate, lunarDate: lunar } = value;
  if (!isResultEvidence(value) || value.ruleVersion.trim() === "" || timezone !== "Asia/Ho_Chi_Minh"
    || typeof solarDate !== "string" || solarDate.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(solarDate)) return false;
  const [year, month, day] = solarDate.split("-").map(Number);
  return year >= 1900 && year <= 2099 && validGregorianDate(year, month, day)
    && isRecord(lunar) && range(lunar.year, 1899, 2099) && range(lunar.month, 1, 12) && range(lunar.day, 1, 30) && typeof lunar.isLeapMonth === "boolean"
    && value.sourceReferences.length > 0 && value.rules.some(rule => rule.ruleCode === "LUNAR-CONVERSION")
    && value.rules.every(rule => rule.ruleCode.trim() !== "" && rule.ruleVersion.trim() !== "" && rule.sourceReferences.length > 0);
}
export function isCanChiResult(value: unknown): value is CanChiResult {
  if (!isRecord(value)) return false;
  const { year, month, day, hour } = value;
  return isCalendarResult(value) && pair(year) && pair(month) && pair(day) && (hour === null || pair(hour));
}
