// Decorative brand mark — small "N" circle pinned to the lower-left.
// Doubles as a back-to-home affordance.
import Link from "next/link";

export function BrandDot() {
  return (
    <Link
      href="/"
      aria-label="narou · reader home"
      className="fixed bottom-4 left-4 z-10 hidden h-9 w-9 place-items-center rounded-full bg-deep text-[14px] font-semibold text-accent-contrast transition-opacity hover:opacity-90 lg:grid"
    >
      N
    </Link>
  );
}
