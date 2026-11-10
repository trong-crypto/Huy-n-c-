export const aiConsultationPath = "/tu-van/hoi-ai";
export const aiQuestionLimit = 1000;

export type AiReadingRef = { readingId: string } | { calculationRequestId: string };

export function aiReadingHref(reference: AiReadingRef) {
  return `${aiConsultationPath}?${new URLSearchParams(reference)}`;
}
