import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/** Page-width container with the site's side margins. */
export function Shell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[84rem] px-5 sm:px-8 lg:px-12 ${className}`}>
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "light";

const buttonBase =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-[2px] px-6 py-3 text-[0.9375rem] font-medium leading-tight transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-espresso text-cream hover:bg-terracotta-deep",
  secondary:
    "border border-espresso text-espresso hover:bg-espresso hover:text-cream",
  light: "bg-cream text-espresso hover:bg-wheat",
};

export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
  return `${buttonBase} ${buttonVariants[variant]} ${extra}`;
}

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}

export const textLinkClass =
  "underline decoration-terracotta decoration-[1.5px] underline-offset-[5px] transition-colors duration-200 hover:text-terracotta-deep";

export function TextLink({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const external = /^(https?:|mailto:)/.test(href);
  if (external) {
    return (
      <a
        href={href}
        className={`${textLinkClass} ${className}`}
        {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={`${textLinkClass} ${className}`}>
      {children}
    </Link>
  );
}

/**
 * A cropped photograph. The frame keeps its shape (`ratio`, as
 * "width / height") and the image fills it, so replacing a photo never
 * shifts the layout.
 */
export function Photo({
  src,
  alt,
  ratio = "4 / 5",
  sizes,
  eager = false,
  className = "",
}: {
  src: string;
  alt: string;
  ratio?: string;
  sizes: string;
  eager?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-wheat ${className}`}
      style={{ aspectRatio: ratio }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className="object-cover"
        // SVG placeholders are served as-is; real photos are optimized by Next.js.
        unoptimized={src.endsWith(".svg")}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
      />
    </div>
  );
}

/** A simple outline camera glyph for the Instagram link. Decorative: pair it with text. */
export function InstagramIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.25" cy="6.75" r="0.6" fill="currentColor" />
    </svg>
  );
}

/** Multi-paragraph owner text: blank lines become paragraph breaks. */
export function Paragraphs({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {text
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph) => (
          <p key={paragraph.slice(0, 40)}>{paragraph}</p>
        ))}
    </div>
  );
}
