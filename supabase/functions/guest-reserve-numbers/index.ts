import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const origin = "https://ajude-e-ganhe.netlify.app";
const url = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const headers = {
  "access-control-allow-origin": origin,
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8"
};
const send = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {status, headers});

async function adminRpc(fn: string, data: Record<string, unknown>) {
  const response = await fetch(url + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers: {
      apikey: serviceKey, authorization: "Bearer " + serviceKey,
      "content-type": "application/json"
    },
    body: JSON.stringify(data)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = String(body?.message || "");
    if ([
      "INVALID_FULL_NAME","INVALID_PHONE","INVALID_EMAIL","INVALID_USER",
      "INVALID_NUMBER_COUNT","NUMBER_OUT_OF_RANGE","NUMBER_UNAVAILABLE",
      "ACTIVE_RESERVATION_LIMIT","CAMPAIGN_UNAVAILABLE"
    ].includes(code)) throw new Error(code);
    throw new Error("INTERNAL_ERROR");
  }
  return body;
}

async function hashedFingerprint(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
  const userAgent = (req.headers.get("user-agent") || "").slice(0, 200);
  const key = new TextEncoder().encode(ip + "|" + userAgent + "|" + serviceKey);
  const hash = await crypto.subtle.digest("SHA-256", key);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2,"0")).join("");
}

const messages: Record<string,string> = {
  INVALID_FULL_NAME:"Informe nome completo, com nome e sobrenome.",
  INVALID_PHONE:"Informe DDD e celular válidos.",
  INVALID_EMAIL:"Informe um endereço de e-mail válido.",
  INVALID_NUMBER_COUNT:"Selecione de 1 a 100 números diferentes.",
  NUMBER_OUT_OF_RANGE:"Um número selecionado é inválido.",
  NUMBER_UNAVAILABLE:"Um dos números não está disponível. Atualize a seleção.",
  ACTIVE_RESERVATION_LIMIT:"Este contato já possui reservas pendentes. Aguarde o vencimento antes de reservar novamente.",
  CAMPAIGN_UNAVAILABLE:"Esta campanha não está disponível.",
  INTERNAL_ERROR:"Não foi possível concluir a reserva. Tente novamente."
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, {headers});
  if (req.method !== "POST") return send({error:"Método não permitido."},405);
  if (req.headers.get("origin") && req.headers.get("origin") !== origin)
    return send({error:"Origem inválida."},403);
  if (!url || !serviceKey) return send({error:"Reservas temporariamente indisponíveis."},503);

  let payload: Record<string,unknown>;
  try { payload = await req.json(); }
  catch (_) { return send({error:"Dados inválidos."},400); }

  const id = String(payload.campaignId || "");
  const numbers = payload.numbers;
  const fullName = String(payload.fullName || "").trim().replace(/\s+/g," ");
  const ddd = String(payload.ddd || "").replace(/\D/g,"");
  const phone = String(payload.phone || "").replace(/\D/g,"");
  const email = String(payload.email || "").trim().toLowerCase();

  if (!/^[0-9a-f-]{36}$/i.test(id) || !Array.isArray(numbers) || numbers.length < 1 || numbers.length > 100 ||
    !numbers.every(n => Number.isInteger(n) && n > 0 && n <= 5000) ||
    new Set(numbers).size !== numbers.length)
    return send({error:messages.INVALID_NUMBER_COUNT},400);
  if (fullName.length < 5 || fullName.length > 120 || !/\S+\s+\S+/.test(fullName))
    return send({error:messages.INVALID_FULL_NAME},400);
  if (!/^[1-9][0-9]$/.test(ddd) || !/^\d{8,9}$/.test(phone))
    return send({error:messages.INVALID_PHONE},400);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return send({error:messages.INVALID_EMAIL},400);

  try {
    const fingerprint = await hashedFingerprint(req);
    const allowed = await adminRpc("guest_reservation_rate_limit",{p_fingerprint:fingerprint});
    if (!allowed) return send({error:"Muitas tentativas recentes. Aguarde alguns minutos para tentar novamente."},429);

    let userId: string | null = null;
    const authorization = req.headers.get("authorization") || "";
    if (authorization.startsWith("Bearer ")) {
      const me = await fetch(url + "/auth/v1/user", {
        headers:{apikey:serviceKey, authorization}
      });
      if (me.ok) {
        const user = await me.json();
        if (/^[0-9a-f-]{36}$/i.test(String(user.id || ""))) userId = user.id;
      }
    }

    const reservation = await adminRpc("reserve_guest_campaign_numbers",{
      p_campaign_id:id,p_numbers:numbers,p_full_name:fullName,p_ddd:ddd,
      p_phone:phone,p_email:email,p_user_id:userId
    });
    const item = Array.isArray(reservation) ? reservation[0] : null;
    if (!item?.participation_id) return send({error:"Não foi possível criar a reserva."},500);

    // A chave Pix só é retornada após a reserva atômica. Não expomos contatos de participantes.
    const endpoint = new URL(url + "/rest/v1/campaign_payment_settings");
    endpoint.searchParams.set("select","pix_key,pix_holder");
    endpoint.searchParams.set("campaign_id","eq." + id);
    endpoint.searchParams.set("limit","1");
    const settingsResponse = await fetch(endpoint.toString(), {
      headers:{apikey:serviceKey,authorization:"Bearer " + serviceKey,accept:"application/json"}
    });
    const settings = settingsResponse.ok ? await settingsResponse.json() : [];
    return send({
      id:item.participation_id, campaignId:id, numbers,
      amount:Number(item.amount),status:"pending_payment",expiresAt:item.expires_at,
      payment:settings[0] ? {pixKey:settings[0].pix_key,pixHolder:settings[0].pix_holder} : null
    });
  } catch(err) {
    const code = err instanceof Error ? err.message : "INTERNAL_ERROR";
    return send({error:messages[code] || messages.INTERNAL_ERROR},code==="NUMBER_UNAVAILABLE"?409:code==="INTERNAL_ERROR"?500:400);
  }
});
