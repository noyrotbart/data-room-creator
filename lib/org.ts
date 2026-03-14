import { headers } from "next/headers";
import { getOrgBySlug, OrgRow } from "@/lib/db";

/**
 * Get the current org from the request headers.
 * The middleware sets x-org-slug based on the subdomain.
 */
export async function getOrgFromHeaders(): Promise<OrgRow | null> {
  const headerList = headers();
  const slug = headerList.get("x-org-slug");
  if (!slug) return null;
  return getOrgBySlug(slug);
}

/**
 * Get org slug from request headers (for API routes).
 */
export function getOrgSlugFromRequest(request: Request): string | null {
  return request.headers.get("x-org-slug");
}

/**
 * Get org from a Request object (API routes).
 */
export async function getOrgFromRequest(request: Request): Promise<OrgRow | null> {
  const slug = getOrgSlugFromRequest(request);
  if (!slug) return null;
  return getOrgBySlug(slug);
}

/**
 * Extract subdomain from host.
 * E.g. "churney.dataroom.io" -> "churney"
 * Returns null for root domain, "app", "www", or localhost.
 */
export function extractSubdomain(host: string): string | null {
  const hostname = host.split(":")[0];
  
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return null;
  }

  const platformDomain = process.env.PLATFORM_DOMAIN;
  if (!platformDomain) return null;

  if (!hostname.endsWith(`.${platformDomain}`)) {
    return null;
  }

  const sub = hostname.slice(0, -(platformDomain.length + 1));
  
  if (!sub || sub === "app" || sub === "www") {
    return null;
  }

  return sub;
}
