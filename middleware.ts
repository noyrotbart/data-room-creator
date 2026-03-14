import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware: extract subdomain from host and set x-org-slug header.
 * - Root domain / app / www → landing pages (no org context)
 * - Org subdomains → set header for downstream pages/routes
 * - Localhost with ?org=slug → dev mode org context
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "localhost";
  const hostname = host.split(":")[0];
  const response = NextResponse.next();

  // Dev mode: use ?org=slug query param
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    const orgParam = request.nextUrl.searchParams.get("org");
    if (orgParam) {
      response.headers.set("x-org-slug", orgParam);
    }
    return response;
  }

  const platformDomain = process.env.PLATFORM_DOMAIN;
  if (!platformDomain) return response;

  // Root domain — no org context (landing page)
  if (hostname === platformDomain || hostname === `www.${platformDomain}` || hostname === `app.${platformDomain}`) {
    return response;
  }

  // Org subdomain
  if (hostname.endsWith(`.${platformDomain}`)) {
    const slug = hostname.slice(0, -(platformDomain.length + 1));
    if (slug && slug !== "app" && slug !== "www") {
      response.headers.set("x-org-slug", slug);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and internal Next.js paths
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
