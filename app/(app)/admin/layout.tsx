import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth";

// En escritorio: barra lateral + área de trabajo a lo ancho, con esquinas y espaciados más compactos.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="flex w-full flex-1 flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
      <AdminNav />
      <div className="flex min-w-0 flex-1 flex-col gap-5 lg:max-w-[1400px] lg:text-[13px] lg:[&_.rounded-2xl]:rounded-lg lg:[&_.rounded-3xl]:rounded-xl">
        {children}
      </div>
    </div>
  );
}
