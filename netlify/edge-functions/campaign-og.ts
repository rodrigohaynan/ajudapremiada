const escapeMeta = (value) => String(value || "")
  .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
  .replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default async (request, context) => {
  const url = new URL(request.url);
  if (request.method !== "GET" || !url.pathname.startsWith("/campanha/")) return;
  const slug = decodeURIComponent(url.pathname.slice("/campanha/".length)).replace(/\/$/, "");
  if (!slug || slug.includes("/") || slug.length > 180) return;
  const backend = Netlify.env.get("VITE_SUPABASE_URL");
  const apikey = Netlify.env.get("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!backend || !apikey) return;

  try {
    const search = new URL(backend + "/rest/v1/campaigns");
    search.searchParams.set("select", "slug,title,description,cause,cover_url,status");
    search.searchParams.set("slug", "eq." + slug);
    search.searchParams.set("status", "eq.active");
    search.searchParams.set("limit", "1");
    const api = await fetch(search.toString(), {
      headers: { apikey, Accept: "application/json" },
      signal: AbortSignal.timeout(4000)
    });
    if (!api.ok) return;
    const campaigns = await api.json();
    const campaign = Array.isArray(campaigns) ? campaigns[0] : null;
    if (!campaign) return;

    const response = await context.next();
    if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) return response;

    const title = escapeMeta(campaign.title + " | Ajude e Ganhe");
    const description = escapeMeta((campaign.cause || campaign.description || "Conheça esta campanha no Ajude e Ganhe").slice(0, 210));
    const canonical = "https://ajude-e-ganhe.netlify.app/campanha/" + encodeURIComponent(campaign.slug);
    const image = (campaign.cover_url || "").startsWith(backend + "/storage/v1/object/public/campaign-covers/")
      ? escapeMeta(campaign.cover_url) : "";

    const meta = [
      '<meta property="og:type" content="website">',
      '<meta property="og:site_name" content="Ajude e Ganhe">',
      '<meta property="og:title" content="' + title + '">',
      '<meta property="og:description" content="' + description + '">',
      '<meta property="og:url" content="' + escapeMeta(canonical) + '">',
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="twitter:title" content="' + title + '">',
      '<meta name="twitter:description" content="' + description + '">',
      image ? '<meta property="og:image" content="' + image + '">' : "",
      image ? '<meta property="og:image:width" content="1200">' : "",
      image ? '<meta property="og:image:height" content="630">' : "",
      image ? '<meta name="twitter:image" content="' + image + '">' : ""
    ].filter(Boolean).join("\n");

    const html = (await response.text()).replace(/<head([^>]*)>/i,
      (_match, attrs) => "<head" + attrs + ">\n" + meta + "\n");
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.set("cache-control", "public, max-age=0, s-maxage=120");
    return new Response(html, {status: response.status, headers});
  } catch (_) {
    // Metadados não podem impedir que a campanha continue acessível.
    return;
  }
};

export const config = { path: "/campanha/*", onError: "bypass" };
