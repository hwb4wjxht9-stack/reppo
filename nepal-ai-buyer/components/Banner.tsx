"use client";

import { usePathname } from "next/navigation";

// The customer screens still run on fake data; the admin page is real.
export default function Banner() {
  if (usePathname().startsWith("/admin")) return null;
  return <div className="banner">Prototype · all prices and shops are fake</div>;
}
