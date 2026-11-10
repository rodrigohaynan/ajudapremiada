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
})

async function paidCount(campaignId){
  const { count, error } = await supabase
    .from('campaign_numbers')
    .select('*',{count:'exact',head:true})
    .eq('campaign_id',campaignId)
    .eq('status','paid')
  if(error) throw error
  return count || 0
}

async function enrichCampaigns(rows=[]){
  return Promise.all(rows.map(async row=>toCampaign({...row,sold:await paidCount(row.id)})))
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
  return toCampaign({...data,sold:await paidCount(data.id)})
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
  const {data,error}=await supabase.from('campaign_numbers')
    .select('number,status,reserved_until')
    .eq('campaign_id',campaignId)
    .neq('status','available')
  if(error) throw error
  const now=Date.now()
  return (data||[]).filter(x=>x.status==='paid'||(x.status==='reserved'&&x.reserved_until&&new Date(x.reserved_until).getTime()>now)).map(x=>x.number)
 }
}

export const dataService = supabase ? supabaseService : localService
