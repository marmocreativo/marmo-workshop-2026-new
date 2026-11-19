import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto flex w-full flex-1 flex-col gap-5 lg:max-w-5xl">
      <AdminNav />
      {children}
    </div>
  );
}
