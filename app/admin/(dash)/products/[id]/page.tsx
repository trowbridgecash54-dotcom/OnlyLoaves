import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { AdminPage, Hidden, PostForm, Save, Section, Tick, adminLink, param, type Search } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  const { id } = await params;
  const { store } = await requireAdmin();
  const product = (await store.products()).find((candidate) => candidate.id === id);
  if (!product) notFound();
  const back = `/admin/products/${id}`;

  return (
    <AdminPage
      title={product.name}
      ok={await param(searchParams, "ok")}
      error={await param(searchParams, "error")}
      aside={<Link href="/admin/products" className={adminLink}>Back to Bread</Link>}
    >
      <ProductForm product={product} back={back} />

      <Section title="Remove from the website" description="Archiving hides the loaf but keeps it so you can bring it back. Deleting removes it for good; past orders keep its name.">
        <div className="flex flex-wrap items-start gap-8">
          <PostForm action="product-archive" back={back}>
            <Hidden name="id" value={id} />
            <Hidden name="archived" value={product.archived_at ? "0" : "1"} />
            <Save quiet>{product.archived_at ? "Restore to website" : "Archive"}</Save>
          </PostForm>
          <PostForm action="product-delete" back={back} className="space-y-2">
            <Hidden name="id" value={id} />
            <Tick label="Yes, delete this loaf permanently" name="confirm" required />
            <Save quiet>Delete</Save>
          </PostForm>
        </div>
      </Section>
    </AdminPage>
  );
}
