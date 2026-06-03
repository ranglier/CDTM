import type { AdminSession } from "@/admin/types";

export type AppNavigationItem = {
  href: string;
  label: string;
  current?: boolean;
};

export type AppNavigationPage = "public" | "editor" | "technical-admin";

export function buildAppNavigationItems({
  session,
  currentPage,
  editorHref = "/editeur",
  publicHref = "/#carte",
}: {
  session: AdminSession;
  currentPage: AppNavigationPage;
  editorHref?: string;
  publicHref?: string;
}): AppNavigationItem[] {
  if (!session.authenticated) {
    return [
      {
        href: currentPage === "public" ? "#carte" : "/#carte",
        label: "Carte",
        current: currentPage === "public",
      },
    ];
  }

  return [
    {
      href: editorHref,
      label: "Editeur",
      current: currentPage === "editor",
    },
    {
      href: publicHref,
      label: "Vue publique",
      current: currentPage === "public",
    },
    ...(session.is_tech_admin
      ? [
          {
            href: "/admin/tech",
            label: "Administration",
            current: currentPage === "technical-admin",
          },
        ]
      : []),
  ];
}
