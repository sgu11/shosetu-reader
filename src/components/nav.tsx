import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/register", label: "Register" },
] as const;

export function Nav() {
  return (
    <nav className="border-b border-border bg-background px-6 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium tracking-tight text-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-accent" />
            Shosetu Reader
          </Link>
          <div className="flex items-center gap-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <Link
          href="/register"
          className="btn-pill btn-primary text-xs"
        >
          Add novel
        </Link>
      </div>
    </nav>
  );
}
