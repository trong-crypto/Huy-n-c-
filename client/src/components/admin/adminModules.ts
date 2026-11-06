export const adminModules = [
  { id: "users", title: "Quản lý người dùng", description: "Theo dõi tài khoản và trạng thái truy cập." },
  { id: "methods", title: "Quản lý phương pháp bói", description: "Quản lý danh mục và thông tin của từng phương pháp." },
  { id: "readings", title: "Quản lý quẻ và lời giải nghĩa", description: "Tổ chức nội dung quẻ, lời giải nghĩa và bản dùng để đối chiếu." },
  { id: "sources", title: "Quản lý dữ liệu nguồn", description: "Theo dõi tài liệu tham chiếu và trạng thái kiểm duyệt." },
  { id: "consultants", title: "Quản lý tư vấn viên", description: "Quản lý hồ sơ và trạng thái hoạt động của tư vấn viên." },
  { id: "statistics", title: "Thống kê", description: "Tổng hợp mức sử dụng theo dữ liệu Server." },
  { id: "system", title: "Trạng thái hệ thống", description: "Theo dõi tình trạng hoạt động của các dịch vụ." },
] as const;
