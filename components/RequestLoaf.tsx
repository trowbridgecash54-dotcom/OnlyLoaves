"use client";

import Link from "next/link";
import { useState } from "react";
import { orderLink } from "@/lib/site";
import { Stepper } from "./Stepper";
import { buttonClass } from "./ui";

/**
 * Quantity selector plus "Request This Loaf". Sends the customer to the
 * order form with this loaf and quantity already filled in. There is no
 * cart and no checkout — the form is the whole order.
 */
export function RequestLoaf({
  productSlug,
  productName,
  max,
}: {
  productSlug: string;
  productName: string;
  max: number;
}) {
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Stepper
        value={quantity}
        min={1}
        max={max}
        onChange={setQuantity}
        itemName={productName}
      />
      <Link href={orderLink(productSlug, quantity)} className={buttonClass("primary")}>
        Request This Loaf
      </Link>
    </div>
  );
}
