import Link from "next/link";
import { ProductForm } from "@/components/admin/ProductForm";
import { AdminPage, adminLink, param, type Search } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";

export default async function NewProductPage({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  return (
    <AdminPage title="Add a loaf" error={await param(searchParams, "error")} aside={<Link href="/admin/products" className={adminLink}>Back to Bread</Link>}>
      <ProductForm product={null} back="/admin/products/new" />
    </AdminPage>
  );
}
