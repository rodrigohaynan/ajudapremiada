import { seedCampaigns } from '../data/mockCampaigns'
import { supabase } from '../lib/supabase'

const K={campaigns:'ap:campaigns',parts:'ap:participations'}
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))||f}catch{return f}}
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v))
const seed=()=>{if(!localStorage.getItem(K.campaigns))write(K.campaigns,seedCampaigns)}
const localService={
 async listCampaigns(){seed();return read(K.campaigns,seedCampaigns)},
 async getCampaign(value){return (await this.listCampaigns()).find(c=>c.id===value||c.slug===value)||null},
 async createCampaign(payload,user){const all=await this.listCampaigns();const stamp=Date.now();const slug=(payload.title||'campanha').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')+'-'+String(stamp).slice(-4);const item={...payload,id:`c-${stamp}`,slug,ownerId:user.id,organizer:user.name,verified:false,sold:0,createdAt:new Date().toISOString()};write(K.campaigns,[item,...all]);return item},
 async reserveNumbers({campaignId,numbers,user,amount}){const all=read(K.parts,[]);const item={id:`p-${Date.now()}`,campaignId,numbers,userId:user.id,userName:user.name,amount,status:'aguardando-pagamento',createdAt:new Date().toISOString(),payment:null};write(K.parts,[item,...all]);return item},
 async getPaymentSettings(){return {pixKey:'',pixHolder:''}},
 async reserveGuestNumbers(){throw new Error('A participação sem cadastro exige conexão com o Supabase.')},
 async updateCampaign(id,payload,user){
  const all=await this.listCampaigns()
  const old=all.find(c=>c.id===id&&c.ownerId===user.id)
  if(!old)throw new Error('Somente o organizador pode editar esta campanha.')
  const item={...old,...payload,id,ownerId:user.id,quantity:old.quantity,price:old.price,updatedAt:new Date().toISOString()}
  write(K.campaigns,all.map(c=>c.id===id?item:c))
  return item
 },
 async getCampaignLifecycle(id){
  const c=(await this.listCampaigns()).find(item=>item.id===id)
  if(!c)throw new Error('Campanha não encontrada.')
  const count=read(K.parts,[]).filter(item=>item.campaignId===id).length
  return {canDelete:count===0&&['draft','active','paused'].includes(c.status||'active'),
    participations:count,occupiedNumbers:count,status:c.status||'active'}
 },
 async manageCampaignLifecycle(id,action,user){
  const all=await this.listCampaigns()
  const campaign=all.find(item=>item.id===id&&item.ownerId===user?.id)
  if(!campaign)throw new Error('Somente o organizador pode gerenciar esta campanha.')
  const lifecycle=await this.getCampaignLifecycle(id)
  if(action==='delete'){
    if(!lifecycle.canDelete)throw new Error('Esta campanha já tem participações. Arquive em vez de excluir.')
    write(K.campaigns,all.filter(item=>item.id!==id))
    return {action:'deleted'}
  }
  if(action!=='archive')throw new Error('Ação inválida.')
  write(K.campaigns,all.map(item=>item.id===id?{...item,status:'archived',archivedAt:new Date().toISOString()}:item))
  return {action:'archived'}
 },
 async listParticipations(userId){return read(K.parts,[]).filter(p=>p.userId===userId)},
 async listOwnedCampaigns(userId){return (await this.listCampaigns()).filter(c=>c.ownerId===userId)},
 async listReservedNumbers(campaignId){return read(K.parts,[]).filter(p=>p.campaignId===campaignId).flatMap(p=>p.numbers)}
}

const slugify = value => (value||'campanha')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9]+/g,'-')
  .replace(/(^-|-$)/g,'')

const campaignSelect = `*, profiles(full_name), campaign_prizes(position,title)`

const toCampaign = row => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  organizer: row.profiles?.full_name || 'Organizador',
  ownerId: row.owner_id,
  verified: row.verified,
  category: row.category,
  cause: row.cause,
  city: row.city,
  state: row.state,
  prizes: [...(row.campaign_prizes||[])].sort((a,b)=>a.position-b.position).map(x=>x.title),
  quantity: row.quantity,
  price: Number(row.price),
  sold: Number(row.sold ?? 0),
  unavailable: Number(row.unavailable ?? row.sold ?? 0),
  drawType: row.draw_type,
  drawDate: row.draw_date,
  drawRule: row.draw_rule,
  emoji: row.emoji,
  accent: row.accent,
  description: row.description,
  customText: row.custom_text,
  coverImage: row.cover_url,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

// A contagem pública usa somente dois estados: disponível / indisponível.
// Uma reserva expirada volta a ser considerada livre, mesmo quando a linha
// continua marcada como 'reserved' até a próxima atualização.
async function countCampaignNumbers(campaignId){
  const now=new Date().toISOString()
  const base=()=>supabase.from('campaign_numbers')
    .select('*',{count:'exact',head:true})
    .eq('campaign_id',campaignId)
  const [paidResult,reservedResult]=await Promise.all([
    base().eq('status','paid'),
    base().eq('status','reserved').gt('reserved_until',now)
  ])
  if(paidResult.error)throw paidResult.error
  if(reservedResult.error)throw reservedResult.error
  const sold=paidResult.count||0
  return {sold,unavailable:sold+(reservedResult.count||0)}
}

async function enrichCampaigns(rows=[]){
  return Promise.all(rows.map(async row=>
    toCampaign({...row,...await countCampaignNumbers(row.id)})
  ))
}

async function uploadCover(dataUrl,userId){
  if(!dataUrl) return null
  const blob = await fetch(dataUrl).then(r=>r.blob())
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('campaign-covers').upload(path,blob,{contentType:blob.type,upsert:false})
  if(error) throw error
  return supabase.storage.from('campaign-covers').getPublicUrl(path).data.publicUrl
}

async function fetchAllNumberRows(campaignId, onlyOccupied=false){
  const items=[]
  let offset=0
  for(;;){
    let query=supabase.from('campaign_numbers')
      .select('number,status,reserved_until')
      .eq('campaign_id',campaignId)
      .order('number')
      .range(offset,offset+999)
    if(onlyOccupied)query=query.neq('status','available')
    const {data,error}=await query
    if(error)throw error
    items.push(...(data||[]))
    if(!data||data.length<1000)break
    offset+=1000
  }
  return items
}

const supabaseService={
 async listCampaigns(){
  const { data,error }=await supabase.from('campaigns').select(campaignSelect).eq('status','active').order('created_at',{ascending:false})
  if(error) throw error
  return enrichCampaigns(data)
 },
 async getCampaign(value){
  let q=supabase.from('campaigns').select(campaignSelect).eq('slug',value).maybeSingle()
  let {data,error}=await q
  if(error) throw error
  if(!data && /^[0-9a-f-]{36}$/i.test(value)){
    const r=await supabase.from('campaigns').select(campaignSelect).eq('id',value).maybeSingle()
    data=r.data; error=r.error
    if(error) throw error
  }
  if(!data) return null
  return toCampaign({...data,...await countCampaignNumbers(data.id)})
 },
 async createCampaign(payload,user){
  let uploadedPath=null
  try{
    const coverUrl=await uploadCover(payload.coverImage,user.id)
    if(coverUrl){
      const marker='/storage/v1/object/public/campaign-covers/'
      uploadedPath=coverUrl.includes(marker)?coverUrl.split(marker)[1]:null
    }
    const slug=`${slugify(payload.title)}-${Date.now().toString().slice(-6)}`
    const {data:campaign,error}=await supabase.from('campaigns').insert({
      owner_id:user.id,slug,title:payload.title,category:payload.category,cause:payload.cause,
      city:payload.city,state:payload.state,description:payload.description,quantity:Number(payload.quantity),
      price:Number(payload.price),draw_type:payload.drawType,draw_date:payload.drawType==='date'&&payload.drawDate?payload.drawDate:null,
      draw_rule:payload.drawRule,custom_text:payload.customText||null,emoji:payload.emoji||'🎁',
      accent:payload.accent||'#0f766e',cover_url:coverUrl,status:'active'
    }).select().single()
    if(error) throw error

    const prizes=(payload.prizes||[]).filter(Boolean).map((title,index)=>({campaign_id:campaign.id,position:index+1,title}))
    if(prizes.length){
      const r=await supabase.from('campaign_prizes').insert(prizes)
      if(r.error) throw r.error
    }
    const pay=await supabase.from('campaign_payment_settings').insert({
      campaign_id:campaign.id,pix_key:payload.pixKey,pix_holder:payload.pixHolder
    })
    if(pay.error) throw pay.error

    return this.getCampaign(campaign.slug)
  }catch(error){
    if(uploadedPath) await supabase.storage.from('campaign-covers').remove([uploadedPath])
    throw error
  }
 },
 async getPaymentSettings(campaignId){
  const {data,error}=await supabase.from('campaign_payment_settings')
    .select('pix_key,pix_holder').eq('campaign_id',campaignId).maybeSingle()
  if(error)throw error
  return {pixKey:data?.pix_key||'',pixHolder:data?.pix_holder||''}
 },
 async updateCampaign(id,payload,user){
  const existing=await this.getCampaign(id)
  if(!existing||existing.ownerId!==user.id)throw new Error('Somente o organizador pode editar esta campanha.')
  let coverUrl=payload.coverImage||null
  if(coverUrl?.startsWith('data:image/')) coverUrl=await uploadCover(coverUrl,user.id)
  const {data,error}=await supabase.from('campaigns').update({
    title:payload.title,category:payload.category,cause:payload.cause,city:payload.city,
    state:payload.state,description:payload.description,
    draw_type:payload.drawType,draw_date:payload.drawType==='date'&&payload.drawDate?payload.drawDate:null,
    draw_rule:payload.drawRule,custom_text:payload.customText||null,cover_url:coverUrl,
    updated_at:new Date().toISOString()
  }).eq('id',id).eq('owner_id',user.id).select('slug').single()
  if(error)throw error
  const updatedPay=await supabase.from('campaign_payment_settings').update({
    pix_key:payload.pixKey,pix_holder:payload.pixHolder,updated_at:new Date().toISOString()
  }).eq('campaign_id',id)
  if(updatedPay.error)throw updatedPay.error
  const newPrizes=(payload.prizes||[]).map(p=>String(p).trim()).filter(Boolean)
  if(!newPrizes.length)throw new Error('Informe ao menos um prêmio.')
  const removed=await supabase.from('campaign_prizes').delete().eq('campaign_id',id)
  if(removed.error)throw removed.error
  const added=await supabase.from('campaign_prizes').insert(newPrizes.map((title,index)=>({
    campaign_id:id,position:index+1,title
  })))
  if(added.error)throw added.error
  return this.getCampaign(data.slug)
 },
 async getCampaignLifecycle(id){
  const {data,error}=await supabase.rpc('get_campaign_lifecycle',{p_campaign_id:id})
  if(error)throw new Error('Não foi possível consultar o histórico da campanha.')
  if(!data)throw new Error('Esta campanha não está disponível para gerenciamento.')
  return data
 },
 async manageCampaignLifecycle(id,action,user){
  if(!user?.id)throw new Error('Entre na sua conta para continuar.')
  const {data,error}=await supabase.rpc('manage_campaign_lifecycle',{
    p_campaign_id:id,p_action:action
  })
  if(error){
    const code=String(error.message||'')
    if(code.includes('DELETE_NOT_ALLOWED_ARCHIVE_INSTEAD'))
      throw new Error('Esta campanha já tem histórico. Utilize Arquivar para preservar os registros.')
    if(code.includes('ONLY_OWNER_CAN_MANAGE')||code.includes('AUTH_REQUIRED'))
      throw new Error('Apenas o organizador pode gerenciar esta campanha.')
    throw new Error('Não foi possível concluir a operação. Atualize a página e tente novamente.')
  }
  return data
 },
 async reserveNumbers({campaignId,numbers}){
  const {data,error}=await supabase.rpc('reserve_campaign_numbers',{p_campaign_id:campaignId,p_numbers:numbers})
  if(error) throw error
  const reservation=data?.[0]
  if(!reservation) throw new Error('Não foi possível criar a participação.')
  const {data:payment,error:paymentError}=await supabase.rpc('get_payment_instructions',{p_participation_id:reservation.participation_id})
  if(paymentError) throw paymentError
  return {
    id:reservation.participation_id,
    campaignId,
    numbers,
    amount:Number(reservation.amount),
    status:'aguardando-pagamento',
    expiresAt:reservation.expires_at,
    payment:payment?.[0] ? {pixKey:payment[0].pix_key,pixHolder:payment[0].pix_holder}:null
  }
 },
 async reserveGuestNumbers({campaignId,numbers,participant}){
  const {data,error}=await supabase.functions.invoke('guest-reserve-numbers',{
    body:{
      campaignId,numbers,
      fullName:participant.fullName,
      ddd:participant.ddd,
      phone:participant.phone,
      email:participant.email
    }
  })
  if(error){
    let message='Não foi possível reservar os números.'
    try {
      const response=await error.context.json()
      message=response?.error || message
    } catch {}
    throw new Error(message)
  }
  if(data?.error) throw new Error(data.error)
  if(!data?.id || !data?.expiresAt)throw new Error('Não foi possível confirmar a reserva.')
  return data
 },
 async listNumberStatuses(campaignId){
  return fetchAllNumberRows(campaignId)
 },
 async getManualReservation(id,accessToken){
  const {data,error}=await supabase.functions.invoke('manual-payment-proof',{
    body:{action:'status',id,token:accessToken}
  })
  if(error){
    try{const m=await error.context.json();throw Error(m.error||'Não foi possível consultar a reserva.')}
    catch(e){throw Error(e.message||'Não foi possível consultar a reserva.')}
  }
  if(data?.error)throw Error(data.error)
  return {...data,accessToken}
 },
 async submitManualProof(reservation,file){
  if(!file)throw Error('Selecione um comprovante.')
  if(file.size>5*1024*1024)throw Error('Arquivo maior que 5 MB.')
  const form=new FormData()
  form.set('id',reservation.id)
  form.set('token',reservation.accessToken)
  form.set('file',file)
  const response=await fetch(import.meta.env.VITE_SUPABASE_URL+'/functions/v1/manual-payment-proof',{
    method:'POST',headers:{apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY},body:form
  })
  const data=await response.json().catch(()=>({}))
  if(!response.ok)throw Error(data.error||'Não foi possível enviar o comprovante.')
  return data
 },
 async listPendingManualReceipts(){
  const {data,error}=await supabase.functions.invoke('manual-payment-proof',{body:{action:'pending'}})
  if(error)throw Error('Não foi possível carregar os comprovantes do organizador.')
  return data.items||[]
 },
 async reviewManualReceipt(id,decision){
  const {data,error}=await supabase.functions.invoke('manual-payment-proof',{
    body:{action:'review',id,decision}
  })
  if(error||!data?.ok)throw Error(data?.error||'Não foi possível confirmar o pagamento.')
  return data
 },
 async listParticipations(userId){
  const {data,error}=await supabase.from('participations')
    .select('*, participation_numbers(number), campaigns(title,slug)')
    .eq('user_id',userId).order('created_at',{ascending:false})
  if(error) throw error
  return (data||[]).map(p=>({
    id:p.id,campaignId:p.campaign_id,userId:p.user_id,amount:Number(p.amount),
    status:p.status,createdAt:p.created_at,expiresAt:p.expires_at,
    numbers:(p.participation_numbers||[]).map(x=>x.number).sort((a,b)=>a-b),
    campaign:p.campaigns
  }))
 },
 async listOwnedCampaigns(userId){
  const {data,error}=await supabase.from('campaigns').select(campaignSelect).eq('owner_id',userId).order('created_at',{ascending:false})
  if(error) throw error
  return enrichCampaigns(data)
 },
 async listReservedNumbers(campaignId){
  const data=await fetchAllNumberRows(campaignId,true)
  const now=Date.now()
  return data.filter(x=>x.status==='paid'||(x.status==='reserved'&&x.reserved_until&&new Date(x.reserved_until).getTime()>now)).map(x=>x.number)
 }
}

export const dataService = supabase ? supabaseService : localService
