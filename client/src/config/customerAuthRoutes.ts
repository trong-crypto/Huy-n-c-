export const customerAuthRoutes = {
  login: "/dang-nhap",
  register: "/dang-ky",
} as const;

export const passwordChangeRoutes = {
  customer: "/doi-mat-khau",
  admin: "/admin/doi-mat-khau",
} as const;
