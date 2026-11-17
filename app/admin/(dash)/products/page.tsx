import Link from "next/link";
import { AdminPage, ButtonAnchor, Empty, Hidden, Pill, PostForm, Save, adminLink, param, type Search } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { loadOwnerView } from "@/lib/admin/load";
import { availabilityLabels, priceFallback } from "@/lib/defaults";
import { formatCents } from "@/lib/format";
import { isPlaceholder, productImage } from "@/lib/images";

export default async function ProductsPage({ searchParams }: { searchParams: Search }) {
  const { store } = await requireAdmin();
  const { allProducts } = await loadOwnerView(store);
  const live = allProducts.filter((p) => p.archived_at === null);
  const archived = allProducts.filter((p) => p.archived_at !== null);

  return (
    <AdminPage
      title="Bread"
      intro="Everything on the Our Bread page. Lower display numbers appear first."
      ok={await param(searchParams, "ok")}
      error={await param(searchParams, "error")}
      aside={<ButtonAnchor href="/admin/products/new">Add a loaf</ButtonAnchor>}
    >
      {live.length === 0 ? (
        <Empty title="No loaves on the menu">Add a loaf to show it on the website.</Empty>
      ) : (
        <ul className="divide-y divide-espresso/15 border-y border-espresso/15">
          {live.map((product) => {
            const image = productImage(product);
            const missing = [
              product.price_cents === null && "price",
              !product.ingredients && "ingredients",
              !product.allergens && "allergens",
              isPlaceholder(image) && "photo",
            ].filter(Boolean);
            return (
              <li key={product.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 py-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- small dashboard thumbnail */}
                <img src={image} alt="" className="h-20 w-16 shrink-0 bg-wheat object-cover" />
                <div className="min-w-0 flex-1 basis-56">
                  <Link href={`/admin/products/${product.id}`} className="font-serif text-2xl hover:underline">{product.name}</Link>
                  <p className="type-small text-espresso/75">
                    {product.price_cents === null ? priceFallback : formatCents(product.price_cents)} · #{product.sort_order}
                    {product.club_eligible ? " · in the Club" : ""}
                  </p>
                  {missing.length ? <p className="type-small text-terracotta-deep">Still needs: {missing.join(", ")}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={product.availability === "available" ? "good" : product.availability === "sold-out" ? "muted" : "neutral"}>
                    {availabilityLabels[product.availability]}
                  </Pill>
                  <Link href={`/admin/products/${product.id}`} className={`${adminLink} inline-flex min-h-11 items-center px-2`}>Edit</Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {archived.length ? (
        <details className="mt-10">
          <summary className="min-h-11 py-2 font-medium">Archived — hidden from the website ({archived.length})</summary>
          <ul className="mt-3 divide-y divide-espresso/15 border-y border-espresso/15">
            {archived.map((product) => (
              <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <Link href={`/admin/products/${product.id}`} className={adminLink}>{product.name}</Link>
                <PostForm action="product-archive" back="/admin/products">
                  <Hidden name="id" value={product.id} />
                  <Hidden name="archived" value="0" />
                  <Save quiet>Restore</Save>
                </PostForm>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </AdminPage>
  );
}
