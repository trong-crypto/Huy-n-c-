export const adminModules = [
  { id: "users", href: "/admin/users", kind: "directory", title: "Quản lý người dùng", description: "Theo dõi tài khoản, vai trò và trạng thái truy cập." },
  { id: "methods", href: "/admin/methods", kind: "content", title: "Quản lý phương pháp bói", description: "Quản lý danh mục và thông tin của từng phương pháp." },
  { id: "readings", href: "/admin/readings", kind: "content", title: "Quản lý quẻ và lời giải nghĩa", description: "Tổ chức nội dung quẻ, lời giải nghĩa và bản dùng để đối chiếu." },
  { id: "sources", href: "/admin/sources", kind: "content", title: "Quản lý dữ liệu nguồn", description: "Theo dõi tài liệu tham chiếu và trạng thái kiểm duyệt." },
  { id: "website", href: "/admin/website", kind: "content", title: "Quản lý nội dung website", description: "Soạn và xem trước phần giới thiệu, hướng dẫn và mô tả phương pháp." },
  { id: "consultants", href: "/admin/consultants", kind: "directory", title: "Quản lý tư vấn viên", description: "Theo dõi tài khoản, hồ sơ và trạng thái duyệt của tư vấn viên." },
  { id: "audit", href: "/admin/audit", kind: "audit", title: "Nhật ký quản trị", description: "Đối chiếu thao tác quản trị khi Backend cung cấp nhật ký." },
] as const;

export type ContentModule = Extract<typeof adminModules[number], { kind: "content" }>;
export type DirectoryModule = Extract<typeof adminModules[number], { kind: "directory" }>;
export const workspaceModules = adminModules.filter(module => module.id !== "website" && module.id !== "consultants");
