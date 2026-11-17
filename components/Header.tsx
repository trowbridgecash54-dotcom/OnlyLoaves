"use client";

import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navigation, routes } from "@/lib/site";
import { buttonClass, Shell } from "./ui";
import { Wordmark } from "./Wordmark";

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  // Close the mobile menu after navigating, and on Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="relative z-40 border-b border-espresso/15">
      <Shell className="flex items-center justify-between gap-4 py-4 lg:py-5">
        <Link href={routes.home} className="inline-flex min-h-11 shrink-0 items-center">
          <Wordmark className="text-[2rem] lg:text-[2.25rem]" />
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-x-5 text-[0.9375rem] xl:gap-x-8">
            {navigation.map((item) => {
              const current = isCurrent(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={`whitespace-nowrap py-2 underline-offset-[7px] transition-colors duration-200 hover:text-terracotta-deep ${
                      current ? "underline decoration-terracotta decoration-[1.5px]" : ""
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link href={routes.order} className={buttonClass("primary", "min-h-11 px-4 sm:px-5")}>
            Order Bread
          </Link>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-[2px] border border-espresso/30 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            {open ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
          </button>
        </div>
      </Shell>

      <AnimatePresence>
        {open ? (
          <motion.nav
            id="mobile-menu"
            aria-label="Main"
            className="absolute inset-x-0 top-full border-b border-espresso/15 bg-cream lg:hidden"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <Shell className="pb-8 pt-2">
              <ul className="divide-y divide-espresso/15">
                {navigation.map((item) => {
                  const current = isCurrent(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={current ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={`type-title flex items-center justify-between py-4 ${
                          current ? "text-terracotta-deep" : ""
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Shell>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
