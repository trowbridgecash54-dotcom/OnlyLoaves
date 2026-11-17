"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";

/** Save button that shows it's working once its form has been submitted. */
export function SubmitButton({ children, quiet = false }: { children: ReactNode; quiet?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const onSubmit = () => setPending(true);
    // Coming back with the browser's Back button shouldn't leave it stuck.
    const onShow = () => setPending(false);
    form.addEventListener("submit", onSubmit);
    window.addEventListener("pageshow", onShow);
    return () => {
      form.removeEventListener("submit", onSubmit);
      window.removeEventListener("pageshow", onShow);
    };
  }, []);

  return (
    <button
      ref={ref}
      type="submit"
      aria-disabled={pending}
      // A second click while saving does nothing (and the server ignores repeats too).
      onClick={(event: { preventDefault(): void }) => {
        if (pending) event.preventDefault();
      }}
      className={`inline-flex min-h-11 items-center justify-center rounded-[2px] px-5 py-2.5 text-[0.9375rem] font-medium transition-colors duration-200 aria-disabled:opacity-60 ${
        quiet
          ? "border border-espresso text-espresso hover:bg-espresso hover:text-cream"
          : "bg-espresso text-cream hover:bg-terracotta-deep"
      }`}
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

const LINKS = [
  ["/admin", "Overview"],
  ["/admin/orders", "Orders"],
  ["/admin/club", "Club"],
  ["/admin/products", "Bread"],
  ["/admin/pickup", "Pickup"],
  ["/admin/messages", "Messages"],
  ["/admin/settings", "Settings"],
  ["/admin/checklist", "Checklist"],
] as const;

/** Dashboard navigation. Scrolls sideways on a phone rather than wrapping. */
export function AdminNav() {
  const pathname = usePathname() ?? "/admin";
  return (
    <nav aria-label="Dashboard" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-x-1">
        {LINKS.map(([href, label]) => {
          const current = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center border-b-2 px-3 text-[0.9375rem] font-medium transition-colors duration-200 ${
                  current
                    ? "border-terracotta text-espresso"
                    : "border-transparent text-espresso/70 hover:text-espresso"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const MAX_EDGE = 2000;
const SHRINK_ABOVE_BYTES = 1_500_000;

/** Shrinks a large photo in the browser so phone pictures upload quickly. */
async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= SHRINK_ABOVE_BYTES) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

/**
 * Photo picker for the dashboard. Shows the current photo, previews a
 * new one, and resizes big pictures before they're sent. The server
 * checks the file again — this is for speed and convenience only.
 */
export function PhotoField({
  name,
  label,
  current,
  hint,
}: {
  name: string;
  label: string;
  /** URL of the photo in use now, if any. */
  current: string | null;
  hint?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      input.value = "";
      setPreview(null);
      setNote("Choose a JPEG, PNG or WebP photo.");
      return;
    }
    try {
      const ready = await shrink(file);
      if (ready !== file) {
        const transfer = new DataTransfer();
        transfer.items.add(ready);
        input.files = transfer.files;
      }
      setPreview(URL.createObjectURL(ready));
      setNote(`Ready to upload (${(ready.size / 1_000_000).toFixed(1)} MB). Save to use it.`);
    } catch {
      setNote("That photo couldn't be read. Try a different one.");
    }
  }

  const shown = preview ?? current;
  return (
    <div>
      <label className="mb-1.5 block font-medium" htmlFor={`photo-${name}`}>
        {label}
      </label>
      <div className="flex flex-wrap items-start gap-5">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local preview, not a page image
          <img src={shown} alt="" className="h-36 w-28 border border-espresso/20 bg-wheat object-cover" />
        ) : (
          <div className="flex h-36 w-28 items-center justify-center border border-dashed border-espresso/30 px-2 text-center text-[0.8125rem] text-espresso/60">
            No photo yet
          </div>
        )}
        <div className="min-w-0 flex-1 basis-56">
          <input
            id={`photo-${name}`}
            type="file"
            name={name}
            accept="image/jpeg,image/png,image/webp"
            onChange={onChange}
            className="block w-full text-[0.9375rem] file:mr-4 file:min-h-11 file:rounded-[2px] file:border file:border-solid file:border-espresso file:bg-paper file:px-4 file:py-2 file:font-medium file:text-espresso"
          />
          <p aria-live="polite" className="type-small mt-2 text-espresso/75">
            {note || hint || "JPEG, PNG or WebP. Photos are cropped to fit, so keep the bread near the middle."}
          </p>
        </div>
      </div>
    </div>
  );
}
