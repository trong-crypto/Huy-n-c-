import type { DetailedReading, ReadingPhase, ReadingRelation } from "@/types/readingContract";

// Presentation copies of the reviewed M01 templates. An exact match avoids
// replacing revised Server text with an explanation of an older template.
const explanations: Record<DetailedReading["topic"], Record<ReadingRelation, readonly [string, string]>> = {
  GENERAL: {
    SAME_ELEMENT: [
      "Theo mục Thể–Dụng, hai quái cùng hành được xét là tỷ hòa, biểu thị sự hòa hợp trong quan hệ chủ–khách.",
      "Bạn và sự việc đang xét được mô tả là có sự hòa hợp.",
    ],
    USE_GENERATES_BODY: [
      "Quái Dụng sinh cho quái Thể: mục nguồn diễn giải theo hướng chủ thể nhận được sự hỗ trợ hoặc lợi ích từ sự việc.",
      "Bạn có thể nhận được sự hỗ trợ hoặc lợi ích từ sự việc đang xét.",
    ],
    BODY_GENERATES_USE: [
      "Quái Thể sinh cho quái Dụng: mục nguồn coi đây là tiết khí, chủ thể phải bỏ sức hoặc hao tổn cho sự việc.",
      "Bạn phải bỏ công sức hoặc chịu hao tổn cho sự việc đang xét.",
    ],
    BODY_CONTROLS_USE: [
      "Quái Thể khắc quái Dụng: theo quan hệ trong mục nguồn, chủ thể có thế chế ngự sự việc.",
      "Bạn được mô tả là ở thế có thể kiểm soát sự việc đang xét.",
    ],
    USE_CONTROLS_BODY: [
      "Quái Dụng khắc quái Thể: theo mục nguồn, sự việc tạo sức ép hoặc trở ngại đối với chủ thể.",
      "Sự việc đang xét tạo sức ép hoặc trở ngại cho bạn.",
    ],
  },
  CAREER: {
    SAME_ELEMENT: [
      "Theo mục cầu danh, Thể–Dụng tỷ hòa được luận là công danh có sự thuận hợp.",
      "Mục tiêu công danh của bạn được đánh giá theo hướng thuận lợi.",
    ],
    USE_GENERATES_BODY: [
      "Theo mục cầu danh, Dụng sinh Thể được luận là dễ thành hoặc nhờ việc cầu danh mà có lợi ích.",
      "Mục tiêu công danh được đánh giá là dễ đạt, hoặc việc theo đuổi mục tiêu này mang lại lợi ích cho bạn.",
    ],
    BODY_GENERATES_USE: [
      "Theo mục cầu danh, Thể sinh Dụng được luận là khó đạt điều mong cầu hoặc có hao tổn danh lợi.",
      "Mục tiêu công danh được đánh giá là khó đạt, hoặc có tổn thất về danh tiếng và lợi ích.",
    ],
    BODY_CONTROLS_USE: [
      "Theo mục cầu danh, Thể khắc Dụng được luận là có thể thành nhưng tiến triển chậm.",
      "Bạn có thể đạt mục tiêu công danh, nhưng tiến triển được mô tả là chậm.",
    ],
    USE_CONTROLS_BODY: [
      "Theo mục cầu danh, Dụng khắc Thể được luận theo chiều trở ngại đối với việc cầu danh.",
      "Việc theo đuổi mục tiêu công danh của bạn được đánh giá là có trở ngại.",
    ],
  },
  WEALTH: {
    SAME_ELEMENT: [
      "Theo mục cầu tài, tỷ hòa được luận theo chiều tài lợi thuận ý.",
      "Mục tiêu tài lộc của bạn được đánh giá theo hướng thuận lợi, phù hợp điều mong muốn.",
    ],
    USE_GENERATES_BODY: [
      "Theo mục cầu tài, Dụng sinh Thể được luận theo chiều tăng ích cho chủ thể.",
      "Việc tìm kiếm tài lộc được đánh giá theo hướng mang lại thêm lợi ích cho bạn.",
    ],
    BODY_GENERATES_USE: [
      "Theo mục cầu tài, Thể sinh Dụng được luận theo chiều hao tổn khi cầu tài.",
      "Việc tìm kiếm tài lộc được đánh giá là có hao tổn.",
    ],
    BODY_CONTROLS_USE: [
      "Theo mục cầu tài, Thể khắc Dụng được luận theo chiều có thể đạt điều cầu tài.",
      "Bạn có khả năng đạt mục tiêu tài lộc đang mong muốn.",
    ],
    USE_CONTROLS_BODY: [
      "Theo mục cầu tài, Dụng khắc Thể được luận theo chiều bất lợi đối với điều cầu tài.",
      "Mục tiêu tài lộc của bạn được đánh giá là có yếu tố bất lợi.",
    ],
  },
  LOVE: {
    SAME_ELEMENT: [
      "Theo mục hôn nhân, tỷ hòa được luận là hai bên thuận hợp.",
      "Trong việc hôn nhân đang xét, hai bên được mô tả là hòa hợp.",
    ],
    USE_GENERATES_BODY: [
      "Theo mục hôn nhân, Dụng sinh Thể được luận là dễ thành hoặc có lợi ích từ quan hệ hôn nhân.",
      "Việc hôn nhân được đánh giá là dễ thành, hoặc quan hệ hôn nhân mang lại lợi ích cho bạn.",
    ],
    BODY_GENERATES_USE: [
      "Theo mục hôn nhân, Thể sinh Dụng được luận là khó thành hoặc có hao tổn trong việc hôn nhân.",
      "Việc hôn nhân được đánh giá là khó thành hoặc có hao tổn.",
    ],
    BODY_CONTROLS_USE: [
      "Theo mục hôn nhân, Thể khắc Dụng được luận là có thể thành nhưng chậm.",
      "Việc hôn nhân có thể thành, nhưng tiến triển được mô tả là chậm.",
    ],
    USE_CONTROLS_BODY: [
      "Theo mục hôn nhân, Dụng khắc Thể được luận theo chiều bất lợi cho việc kết thành hôn nhân.",
      "Việc tiến tới hôn nhân được đánh giá theo hướng bất lợi.",
    ],
  },
};

export function explainReadingPhase(topic: DetailedReading["topic"], phase: ReadingPhase): string | null {
  const [original, explanation] = explanations[topic][phase.relation];
  return phase.templateCode === `MH-${topic}-${phase.relation}` && phase.content === original ? explanation : null;
}
