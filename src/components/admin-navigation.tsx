"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleHelp,
  CreditCard,
  House,
  Image,
  Monitor,
  Settings,
  Users,
} from "lucide-react";

type NavigationItem = {
  href: string;
  label: string;
  icon: typeof House;
  exact?: boolean;
};

const primaryLinks: NavigationItem[] = [
  { href: "/dashboard", label: "Home", icon: House, exact: true },
  { href: "/dashboard/screens", label: "Screens", icon: Monitor },
  { href: "/dashboard/media", label: "Media", icon: Image },
  { href: "/dashboard/team", label: "Team", icon: Users },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
];

const secondaryLinks: NavigationItem[] = [
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help center", icon: CircleHelp },
];

function NavigationLink({
  href,
  label,
  icon: Icon,
  exact = false,
  pathname,
}: NavigationItem & { pathname: string }) {
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link href={href} className={active ? "active" : undefined}>
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

export function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard navigation">
      <div className="sidebar-nav-group">
        {primaryLinks.map((link) => (
          <NavigationLink key={link.href} {...link} pathname={pathname} />
        ))}
      </div>
      <div className="sidebar-nav-group sidebar-nav-secondary">
        {secondaryLinks.map((link) => (
          <NavigationLink key={link.href} {...link} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}
