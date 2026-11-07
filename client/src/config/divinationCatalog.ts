export const methodCatalogHref = "/phuong-phap";

const maiHoaMethods = [
  { code: "TIME", title: "Theo thời điểm", formLabel: "Theo thời gian", body: "Lập quẻ từ thời điểm được nhập theo giờ Việt Nam.",
    input: "Ngày và giờ lập quẻ theo giờ Việt Nam (UTC+07:00)." },
  { code: "OBJECT_COUNT", title: "Theo số vật", formLabel: "Theo số vật đếm được", body: "Lập quẻ theo dữ kiện số vật.",
    input: "Số vật đếm được và giờ Chi." },
  { code: "LINES", title: "Theo sáu hào", formLabel: "Nhập sáu hào (LINES)", body: "Lập quẻ từ sáu hào và hào động đã chọn.",
    input: "Sáu hào từ dưới lên và một hào động." },
] as const;

const tamTheMethod = {
  code: "TAM_THE", title: "Tra cứu theo dữ kiện sinh", formLabel: "Công danh, Tài lộc, Tình duyên",
  body: "Tra cứu Công danh, Tài lộc và Tình duyên theo dữ kiện sinh.",
  input: "Ngày sinh, giờ sinh, loại lịch và nội dung muốn xem.",
} as const;

export const divinationCatalog = [
  {
    href: "/mai-hoa",
    number: "01",
    group: "Mai Hoa",
    title: "Mai Hoa Dịch Số",
    tag: "SÁU HÀO · THỜI GIAN · SỐ VẬT",
    description: "Lập quẻ từ sáu hào, thời điểm hoặc số vật để tìm hiểu cấu trúc quẻ và lời luận theo chủ đề, có nguồn tham chiếu.",
    summary: "Sáu hào · Thời gian · Số vật đếm được",
    action: "Khám phá Mai Hoa",
    methods: maiHoaMethods,
  },
  {
    href: "/tam-the",
    number: "02",
    group: "Tam Thế",
    title: "Diễn Cầm Tam Thế",
    tag: "NGÀY SINH · GIỜ SINH · LỊCH",
    description: "Tra cứu theo ngày giờ sinh và lịch truyền thống, với căn cứ nguồn được đối chiếu.",
    summary: "Công danh · Tài lộc · Tình duyên",
    action: "Tìm hiểu Tam Thế",
    methods: [tamTheMethod],
  },
] as const;
