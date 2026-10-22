import Link from "next/link";

const modules = [
  {
    href: "/mai-hoa",
    number: "01",
    title: "Mai Hoa Dịch Số",
    description: "Nhập thời điểm lập quẻ theo giờ Việt Nam; xem phản hồi giao tiếp trong khi quy tắc được kiểm chứng.",
  },
  {
    href: "/tam-the",
    number: "02",
    title: "Diễn Cầm Tam Thế",
    description: "Nhập ngày giờ sinh và loại lịch; thử luồng yêu cầu trước khi bảng tra được duyệt.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-14">
      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">Khung dự án v1.0</p>
      <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-emerald-950 sm:text-5xl">
        Khung tra cứu theo hai bản sách đang được kiểm chứng
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
        Hai module dùng chung hợp đồng JSON/STOMP. Nhóm đã ghi nguồn theo trang sách; kết quả nghiệp vụ chỉ mở khi dữ liệu và kiểm thử được duyệt.
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {modules.map((module) => (
          <Link key={module.href} href={module.href} className="group rounded-2xl border border-emerald-950/10 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <span className="text-sm font-bold text-emerald-700">{module.number}</span>
            <h2 className="mt-5 text-2xl font-semibold text-emerald-950">{module.title}</h2>
            <p className="mt-3 leading-relaxed text-slate-600">{module.description}</p>
            <span className="mt-8 inline-block font-semibold text-emerald-800 group-hover:underline">Mở biểu mẫu →</span>
          </Link>
        ))}
      </div>
      <p className="mt-10 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-900">
        Các thuật toán Mai Hoa và Tam Thế hiện chưa được xác minh theo ấn bản sách. Server sẽ trả mã RULE_NOT_AVAILABLE thay vì tạo kết quả suy đoán.
      </p>
    </main>
  );
}

