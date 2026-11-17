import { isPlaceholder, productImage } from "@/lib/images";
import type { Product } from "@/lib/types";
import { PhotoField } from "./client";
import { Area, Choice, Field, Hidden, PostForm, Save, Tick } from "./ui";

/** Add-or-edit form for one loaf. */
export function ProductForm({ product, back }: { product: Product | null; back: string }) {
  const image = product ? productImage(product) : null;
  return (
    <PostForm action="product-save" back={back} upload className="grid max-w-[48rem] gap-5 sm:grid-cols-2">
      {product ? <Hidden name="id" value={product.id} /> : null}
      <div className="sm:col-span-2"><Field label="Name" name="name" required defaultValue={product?.name} /></div>
      <Field
        label="Price per loaf ($)"
        name="price"
        inputMode="decimal"
        defaultValue={product?.price_cents != null ? (product.price_cents / 100).toFixed(product.price_cents % 100 ? 2 : 0) : ""}
        hint="Leave blank and the site says “Price confirmed when ordering”."
      />
      <Choice
        label="Availability"
        name="availability"
        defaultValue={product?.availability ?? "available"}
        options={[["available", "Available"], ["limited", "Limited"], ["sold-out", "Sold out"], ["coming-soon", "Coming soon"]]}
      />
      <div className="sm:col-span-2"><Area label="Description" name="description" defaultValue={product?.description} rows={2} /></div>
      <Area label="Ingredients" name="ingredients" defaultValue={product?.ingredients ?? ""} hint="Exactly as on your label. Leave blank until confirmed." />
      <Area label="Allergens" name="allergens" defaultValue={product?.allergens ?? ""} hint="e.g. “Contains wheat.” Leave blank until confirmed — never guess." />
      <Field label="Availability note" name="availability_note" defaultValue={product?.availability_note} hint="Optional, e.g. “Baked on Fridays”." />
      <Field label="Display order" name="sort_order" type="number" defaultValue={product?.sort_order ?? 100} hint="Lower numbers show first." />
      <div className="sm:col-span-2">
        <PhotoField name="photo" label="Photo" current={image && !isPlaceholder(image) ? image : null} />
        {product?.image_path ? <Tick label="Remove the current photo" name="remove_photo" /> : null}
      </div>
      <div className="sm:col-span-2"><Field label="Photo description" name="image_alt" defaultValue={product?.image_alt} hint="For visitors using screen readers, e.g. “Round loaf with a deep golden crust”." /></div>
      <div className="sm:col-span-2 space-y-1">
        <Tick label="Feature on the homepage" name="featured" defaultChecked={product?.featured ?? false} hint="The first three featured loaves appear under What's Baking." />
        <Tick label="Club members can receive this loaf" name="club_eligible" defaultChecked={product?.club_eligible ?? true} />
      </div>
      <div className="sm:col-span-2"><Save>{product ? "Save changes" : "Add loaf"}</Save></div>
    </PostForm>
  );
}
