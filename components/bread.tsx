import Link from "next/link";
import { availabilityLabels, maxQuantityPerLoaf, priceFallback } from "@/lib/defaults";
import { formatCents } from "@/lib/format";
import { productImage } from "@/lib/images";
import { orderLink } from "@/lib/site";
import { isRequestable } from "@/lib/site-build";
import type { Availability, Product } from "@/lib/types";
import { RequestLoaf } from "./RequestLoaf";
import { Photo, textLinkClass } from "./ui";

const availabilityDot: Record<Availability, string> = {
  available: "bg-olive",
  limited: "bg-terracotta",
  "sold-out": "bg-espresso/30",
  "coming-soon": "border border-espresso/50",
};

export function AvailabilityTag({ product }: { product: Product }) {
  return (
    <p className="type-small flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`inline-block size-2 rounded-full ${availabilityDot[product.availability]}`}
      />
      <span>
        {availabilityLabels[product.availability]}
        {product.availability_note ? (
          <span className="text-espresso/70"> — {product.availability_note}</span>
        ) : null}
      </span>
    </p>
  );
}

/** One-time price. Independent of Club pricing. Never shows a made-up number. */
export function Price({ product, className = "" }: { product: Product; className?: string }) {
  if (product.price_cents === null) {
    return <p className={`type-small text-espresso/75 ${className}`}>{priceFallback}</p>;
  }
  return (
    <p className={className}>
      <span className="font-medium">{formatCents(product.price_cents)}</span>
      <span className="type-small text-espresso/70"> per loaf</span>
    </p>
  );
}

/** Homepage "What's Baking" entry. */
export function FeaturedLoaf({
  product,
  canOrder,
  className = "",
}: {
  product: Product;
  /** False while the owner hasn't opened ordering. */
  canOrder: boolean;
  className?: string;
}) {
  return (
    <article className={className}>
      <Photo
        src={productImage(product)}
        alt={product.image_alt}
        ratio="4 / 5"
        sizes="(min-width: 768px) 30vw, 100vw"
      />
      <div className="mt-5 border-t border-espresso/20 pt-4">
        <h3 className="type-title">{product.name}</h3>
        <Price product={product} className="mt-1.5" />
        <p className="mt-3 text-espresso/80">{product.description}</p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <AvailabilityTag product={product} />
          {canOrder && isRequestable(product) ? (
            <Link href={orderLink(product.slug)} className={`${textLinkClass} font-medium`}>
              Request this loaf
              <span className="sr-only">, {product.name}</span>
            </Link>
          ) : (
            <span className="type-small text-espresso/70">
              {canOrder ? "Not taking requests" : "Ordering opens soon"}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/** Full catalog entry on /bread. `flip` puts the photo on the right. */
export function CatalogLoaf({
  product,
  flip,
  canOrder,
}: {
  product: Product;
  flip: boolean;
  canOrder: boolean;
}) {
  return (
    <article
      id={product.slug}
      className="grid scroll-mt-8 gap-x-8 gap-y-8 border-t border-espresso/15 py-12 lg:grid-cols-12 lg:py-20"
    >
      <div className={`lg:col-span-5 lg:row-start-1 ${flip ? "lg:col-start-8" : "lg:col-start-1"}`}>
        <Photo
          src={productImage(product)}
          alt={product.image_alt}
          ratio="4 / 5"
          sizes="(min-width: 1024px) 40vw, 100vw"
        />
      </div>

      <div
        className={`lg:col-span-6 lg:row-start-1 lg:self-center ${
          flip ? "lg:col-start-1" : "lg:col-start-7"
        }`}
      >
        <h2 className="type-headline">{product.name}</h2>
        <Price product={product} className="mt-4 text-xl" />
        <p className="type-lede mt-5 max-w-[34rem] text-espresso/85">{product.description}</p>

        <dl className="mt-8 max-w-[34rem] divide-y divide-espresso/15 border-y border-espresso/15">
          <div className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[8.5rem_1fr]">
            <dt className="type-small font-medium">Ingredients</dt>
            <dd className={product.ingredients ? "" : "text-espresso/75"}>
              {product.ingredients ?? "Ingredient list coming soon. Ask us before you order."}
            </dd>
          </div>
          <div className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[8.5rem_1fr]">
            <dt className="type-small font-medium">Allergens</dt>
            <dd className={product.allergens ? "" : "text-espresso/75"}>
              {product.allergens ??
                "Not published yet. If you have a food allergy, ask us before ordering."}
            </dd>
          </div>
          <div className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[8.5rem_1fr]">
            <dt className="type-small font-medium">Availability</dt>
            <dd>
              <AvailabilityTag product={product} />
            </dd>
          </div>
        </dl>

        <div className="mt-8">
          {!canOrder ? (
            <p className="text-espresso/75">Ordering opens soon.</p>
          ) : isRequestable(product) ? (
            <RequestLoaf
              productSlug={product.slug}
              productName={product.name}
              max={maxQuantityPerLoaf}
            />
          ) : (
            <p className="text-espresso/75">This loaf isn&apos;t taking requests right now.</p>
          )}
        </div>
      </div>
    </article>
  );
}
