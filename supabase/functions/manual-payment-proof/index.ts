import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const origin="https://ajude-e-ganhe.netlify.app";
const base=Deno.env.get("SUPABASE_URL")||"";
const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const cors={
 "access-control-allow-origin":origin,
 "access-control-allow-headers":"authorization,apikey,content-type,x-client-info",
 "access-control-allow-methods":"POST,OPTIONS",
 "content-type":"application/json; charset=utf-8",
 "cache-control":"no-store"
};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const isUuid=(value:unknown)=>typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const isToken=(value:unknown)=>typeof value==="string"&&/^[0-9a-f]{64}$/.test(value);
async function tokenHash(token:string){
 const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
 return Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,"0")).join("");
}
async function rpc(method:string,args:Record<string,unknown>){
 const response=await fetch(base+"/rest/v1/rpc/"+method,{
  method:"POST",
  headers:{apikey:service,authorization:"Bearer "+service,"content-type":"application/json"},
  body:JSON.stringify(args)
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(String(data.message||"INTERNAL_ERROR"));
 return data;
}
async function getOwner(req:Request){
 const auth=req.headers.get("authorization")||"";
 if(!auth.startsWith("Bearer "))throw Error("AUTH_REQUIRED");
 const response=await fetch(base+"/auth/v1/user",{
  headers:{apikey:service,authorization:auth}
 });
 if(!response.ok)throw Error("AUTH_REQUIRED");
 const user=await response.json();
 if(!isUuid(user.id))throw Error("AUTH_REQUIRED");
 return user.id as string;
}
async function signedProof(path:string){
 const endpoint=base+"/storage/v1/object/sign/manual-payment-proofs/"+
   path.split("/").map(encodeURIComponent).join("/");
 const response=await fetch(endpoint,{
  method:"POST",
  headers:{apikey:service,authorization:"Bearer "+service,"content-type":"application/json"},
  body:JSON.stringify({expiresIn:600})
 });
 if(!response.ok)return null;
 const data=await response.json();
 const link=data.signedURL||data.signedUrl;
 if(typeof link!=="string")return null;
 if(link.startsWith("http"))return link;
 return base+"/storage/v1"+(link.startsWith("/")?link:"/"+link);
}
async function uploadFile(id:string,file:File){
 const mime=file.type;
 const types:Record<string,string>={
  "image/jpeg":"jpg","image/png":"png","image/webp":"webp","application/pdf":"pdf"
 };
 const ext=types[mime];
 if(!ext||file.size===0||file.size>5*1024*1024)
  throw Error("Arquivo inválido. Envie JPG, PNG, WEBP ou PDF com até 5 MB.");
 const sample=new Uint8Array(await file.slice(0,16).arrayBuffer());
 const starts=(signature:number[])=>signature.every((c,i)=>sample[i]===c);
 if(!(mime==="image/jpeg"&&starts([255,216,255])) &&
    !(mime==="image/png"&&starts([137,80,78,71,13,10,26,10])) &&
    !(mime==="image/webp"&&String.fromCharCode(...sample.slice(0,4))==="RIFF"&&String.fromCharCode(...sample.slice(8,12))==="WEBP") &&
    !(mime==="application/pdf"&&String.fromCharCode(...sample.slice(0,4))==="%PDF"))
    throw Error("Conteúdo de arquivo não corresponde ao formato informado.");
 const path=id+"/"+crypto.randomUUID()+"."+ext;
 const response=await fetch(base+"/storage/v1/object/manual-payment-proofs/"+path,{
  method:"POST",
  headers:{apikey:service,authorization:"Bearer "+service,
    "content-type":mime,"x-upsert":"false","cache-control":"no-store"},
  body:file
 });
 if(!response.ok)throw Error("Não foi possível guardar o comprovante.");
 return path;
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 if(req.method!=="POST")return reply({error:"Método não permitido."},405);
 const from=req.headers.get("origin");
 if(from&&from!==origin)return reply({error:"Origem inválida."},403);
 if(!base||!service)return reply({error:"Serviço temporariamente indisponível."},503);
 try{
  const type=req.headers.get("content-type")||"";
  if(type.startsWith("multipart/form-data")){
   const size=Number(req.headers.get("content-length")||0);
   if(size>5*1024*1024+20000)return reply({error:"O comprovante deve ter até 5 MB."},413);
   const form=await req.formData();
   const id=form.get("id"),token=form.get("token"),file=form.get("file");
   if(!isUuid(id)||!isToken(token)||!(file instanceof File))
    return reply({error:"Reserva ou comprovante inválido."},400);
   const hash=await tokenHash(token as string);
   const records=await rpc("manual_receipt_status",{
     p_participation_id:id,p_token_hash:hash
   });
   const current=Array.isArray(records)?records[0]:null;
   if(!current||current.status!=="pending_payment"||Date.parse(current.expires_at)<=Date.now())
     return reply({error:"A reserva de 30 minutos terminou ou já possui um comprovante."},409);
   const path=await uploadFile(id as string,file);
   try{
    const deadline=await rpc("manual_submit_proof",{
     p_participation_id:id,p_token_hash:hash,p_file_path:path
    });
    return reply({status:"proof_review",expiresAt:deadline,
      message:"Comprovante enviado. Números protegidos por até 3 dias para conferência."});
   }catch(e){
    // Remove the unreferenced private object when the DB rejects an expired hold.
    await fetch(base+"/storage/v1/object/manual-payment-proofs",{
      method:"DELETE",headers:{apikey:service,authorization:"Bearer "+service,"content-type":"application/json"},
      body:JSON.stringify({prefixes:[path]})
    }).catch(()=>{});
    throw e;
   }
  }
  if(!type.includes("application/json"))return reply({error:"Formato de solicitação inválido."},415);
  const body=await req.json();
  if(body.action==="status"){
    if(!isUuid(body.id)||!isToken(body.token))
      return reply({error:"Dados inválidos."},400);
    const rows=await rpc("manual_receipt_status",{
      p_participation_id:body.id,p_token_hash:await tokenHash(body.token)
    });
    const r=Array.isArray(rows)?rows[0]:null;
    if(!r)return reply({error:"Reserva não encontrada."},404);
    const instructions=await rpc("manual_receipt_payment",{
      p_participation_id:body.id,p_token_hash:await tokenHash(body.token)
    });
    const details=Array.isArray(instructions)?instructions[0]:null;
    return reply({id:r.participation_id,amount:Number(r.amount),status:r.status,
      expiresAt:r.expires_at,proofSubmittedAt:r.proof_submitted_at,numbers:r.numbers,
      payment:details?{pixKey:details.pix_key,pixHolder:details.pix_holder}:null});
  }
  if(body.action==="pending"){
    const userId=await getOwner(req);
    const list=await rpc("manual_owner_pending",{p_owner_id:userId});
    return reply({items:await Promise.all((list||[]).map(async(row:Record<string,unknown>)=>({
      ...row,proofUrl:await signedProof(String(row.file_path))
    })))});
  }
  if(body.action==="review"){
    const userId=await getOwner(req);
    if(!isUuid(body.id)||!["confirmed","rejected"].includes(body.decision))
      return reply({error:"Decisão inválida."},400);
    await rpc("manual_review_proof",{
      p_participation_id:body.id,p_owner_id:userId,p_decision:body.decision
    });
    return reply({ok:true,status:body.decision==="confirmed"?"paid":"cancelled"});
  }
  return reply({error:"Operação inválida."},400);
 }catch(error){
   const m=String(error instanceof Error?error.message:error);
   const isExpired=/EXPIRED|NUMBER_UNAVAILABLE|NOT_PENDING/.test(m);
   const auth=m==="AUTH_REQUIRED";
   const known=/^(Arquivo inválido|Conteúdo de arquivo|Não foi possível guardar|O comprovante)/.test(m);
   return reply({error:auth?"Entre na conta do organizador para revisar.":isExpired?
     "Reserva encerrada ou comprovante já analisado. Atualize sua situação.":
     known?m:"Não foi possível concluir a solicitação."},auth?401:isExpired?409:known?400:500);
 }
});
