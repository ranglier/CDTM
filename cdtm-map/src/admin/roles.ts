export type AdminRole = "staff" | "tech_admin";

export function isAdminRole(value: unknown): value is AdminRole {
  return value === "staff" || value === "tech_admin";
}

export function isTechAdminRole(role: AdminRole | null | undefined): boolean {
  return role === "tech_admin";
}
