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
  const pathname = request.nextUrl.pathname;

  // ?org=slug query param works everywhere (for dev mode and pre-subdomain setups)
  const orgParam = request.nextUrl.searchParams.get("org");
  if (orgParam) {
    response.headers.set("x-org-slug", orgParam);
    return response;
  }

  // Try subdomain-based org detection
  const platformDomain = process.env.PLATFORM_DOMAIN;
  if (platformDomain && hostname.endsWith(`.${platformDomain}`)) {
    const slug = hostname.slice(0, -(platformDomain.length + 1));
    if (slug && slug !== "app" && slug !== "www") {
      response.headers.set("x-org-slug", slug);
      return response;
    }
  }

  // No org context — allow public pages, redirect root to landing
  const publicPaths = ["/landing", "/signup", "/api/"];
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/landing", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and internal Next.js paths
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
