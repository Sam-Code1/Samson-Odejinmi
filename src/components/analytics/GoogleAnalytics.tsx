"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

const GA_ID = "G-JPG7L1SMVX";

/** Google tag on every public page. Staff-only areas are left out so admin work never shows up in the reports. */
export function GoogleAnalytics() {
  const path = usePathname() ?? "";
  if (path === "/admin" || path.startsWith("/admin/")) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="google-tag" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
      </Script>
    </>
  );
}
