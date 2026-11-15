
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const PROJECT_ORIGIN = "https://ajude-e-ganhe.netlify.app";
const MP_CLIENT_ID = Deno.env.get("MP_CLIENT_ID") || "";
const MP_CLIENT_SECRET = Deno.env.get("MP_CLIENT_SECRET") || "";
const CALLBACK_URL = Deno.env.get("MP_REDIRECT_URI") ||
  SUPABASE_URL + "/functions/v1/mercado-pago-oauth?flow=callback";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": PROJECT_ORIGIN,
    "cache-control": "no-store",
  } });
}
function redirect(result: string) {
  return Response.redirect(PROJECT_ORIGIN + "/painel?mp=" + encodeURIComponent(result), 303);
}
async function rpc(name: string, args: Record<string, unknown>) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { "apikey": SERVICE_KEY, "authorization": "Bearer " + SERVICE_KEY, "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error("Erro interno na autenticação da conexão.");
  return response.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: {
    "access-control-allow-origin": PROJECT_ORIGIN,
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "POST, GET, OPTIONS",
  } });
  if (!SUPABASE_URL || !SERVICE_KEY) return json({error:"Configuração Supabase indisponível."},503);
  const url = new URL(req.url);
  if (url.searchParams.get("flow") === "callback") {
    if (req.method !== "GET") return redirect("error");
    if (url.searchParams.has("error")) return redirect("cancelled");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state || !/^[0-9a-f-]{36}$/i.test(state)) return redirect("error");
    if (!MP_CLIENT_ID || !MP_CLIENT_SECRET) return redirect("unconfigured");
    try {
      const valid = await rpc("mp_state_valid",{p_state:state});
      if (!valid) return redirect("expired");
      const res = await fetch("https://api.mercadopago.com/oauth/token",{
        method:"POST",headers:{"content-type":"application/json","accept":"application/json"},
        body:JSON.stringify({client_id:MP_CLIENT_ID, client_secret:MP_CLIENT_SECRET,
          grant_type:"authorization_code", code, redirect_uri:CALLBACK_URL, state})
      });
      if (!res.ok) return redirect("error");
      const token = await res.json();
      if (!token.access_token || !token.user_id) return redirect("error");
      const expiresAt = token.expires_in ?
        new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null;
      await rpc("mp_complete_oauth",{
        p_state:state, p_provider_user_id:String(token.user_id),
        p_access_token:token.access_token,p_refresh_token:token.refresh_token||null,
        p_expires_at:expiresAt
      });
      return redirect("connected");
    } catch (_) { return redirect("error"); }
  }
  if (req.method !== "POST") return json({error:"Método inválido."},405);
  if (req.headers.get("origin") && req.headers.get("origin") !== PROJECT_ORIGIN) return json({error:"Origem inválida."},403);
  if (!MP_CLIENT_ID || !MP_CLIENT_SECRET) return json({
    error:"A conexão Mercado Pago ainda depende das credenciais do aplicativo e da liberação comercial."
  },503);
  const bearer = req.headers.get("authorization") || "";
  if (!/^Bearer /i.test(bearer)) return json({error:"Entre na sua conta para continuar."},401);
  let body: {action?:string};
  try { body = await req.json(); } catch { return json({error:"Solicitação inválida."},400); }
  if (body.action !== "start") return json({error:"Operação não suportada."},400);
  const me = await fetch(SUPABASE_URL + "/auth/v1/user",{
    headers:{"apikey": SERVICE_KEY,"authorization":bearer}
  });
  if (!me.ok) return json({error:"Sessão inválida. Entre novamente."},401);
  const authenticated = await me.json();
  if (!authenticated.id) return json({error:"Usuário inválido."},401);
  try {
    const state = await rpc("mp_begin_oauth",{p_user_id:authenticated.id});
    const authorize = new URL("https://auth.mercadopago.com.br/authorization");
    authorize.searchParams.set("client_id",MP_CLIENT_ID);
    authorize.searchParams.set("response_type","code");
    authorize.searchParams.set("platform_id","mp");
    authorize.searchParams.set("state",String(state));
    authorize.searchParams.set("redirect_uri",CALLBACK_URL);
    return json({url:authorize.toString()});
  } catch (_) { return json({error:"Não foi possível iniciar a conexão."},500); }
});
