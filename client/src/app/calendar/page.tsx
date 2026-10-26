import { PageContainer, PageHeader } from "@/components/ui/Page";
import { StatusBanner } from "@/components/ui/Controls";
import { CalendarForm } from "@/components/calendar/CalendarForm";

export default function CalendarPage() {
  return <PageContainer>
    <PageHeader eyebrow="04 / LỊCH VÀ CAN CHI" title="Hai lịch, một mốc thời gian.">
      <p>Đổi ngày Âm–Dương và tra Can Chi từ Server. Đầu vào giữ nguyên ngày dân sự, không đổi theo múi giờ thiết bị.</p>
    </PageHeader>
    <StatusBanner>Phạm vi ngày Dương: 1900-01-01 đến 2099-12-31. Một phần năm âm 1899 hợp lệ; ngày Âm và tháng nhuận phải được Server xác nhận theo ngày Dương tương ứng. Không tự giới hạn hoặc sửa ngày thay bạn.</StatusBanner>
    <div className="calendar-layout"><CalendarForm kind="convert" /><CalendarForm kind="can-chi" /></div>
    <aside className="section-card calendar-conventions" aria-label="Quy ước lịch và Can Chi">
      <h2 className="section-title">Mô hình và giới hạn áp dụng</h2>
      <p>Phép chuyển đổi dùng UTC+07:00 cố định, nhãn Asia/Ho_Chi_Minh; kể cả trước 1968, không áp dụng offset lịch sử. Đây là mô hình lịch của dự án, không tái hiện mọi niên lịch lịch sử hoặc quy ước chiêm tinh theo tiết khí.</p>
      <ul><li>Năm Can Chi đổi tại Tết; tháng theo tháng âm.</li><li>Ngày dân sự đổi lúc 00:00; giờ Tý kéo dài 23:00–00:59.</li>
        <li>23:xx vẫn dùng Can của ngày dân sự hiện tại.</li><li>Tháng âm nhuận giữ Can Chi của tháng cùng số; cờ nhuận vẫn hiển thị riêng.</li></ul>
      <p>Không phải Bát Tự / Tứ trụ theo tiết khí. Client chỉ trình bày giá trị do Server trả về, không tính lại Can Chi.</p>
    </aside>
  </PageContainer>;
}
