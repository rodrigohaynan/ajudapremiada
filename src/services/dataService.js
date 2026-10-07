import { seedCampaigns } from '../data/mockCampaigns'
const K={campaigns:'ap:campaigns',parts:'ap:participations'}
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))||f}catch{return f}}
const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v))
const seed=()=>{if(!localStorage.getItem(K.campaigns))write(K.campaigns,seedCampaigns)}

export const dataService={
 async listCampaigns(){seed();return read(K.campaigns,seedCampaigns)},
 async getCampaign(value){return (await this.listCampaigns()).find(c=>c.id===value||c.slug===value)||null},
 async createCampaign(payload,user){const all=await this.listCampaigns();const stamp=Date.now();const slug=(payload.title||'campanha').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')+'-'+String(stamp).slice(-4);const item={...payload,id:`c-${stamp}`,slug,ownerId:user.id,organizer:user.name,verified:false,sold:0,createdAt:new Date().toISOString()};write(K.campaigns,[item,...all]);return item},
 async reserveNumbers({campaignId,numbers,user,amount}){const all=read(K.parts,[]);const item={id:`p-${Date.now()}`,campaignId,numbers,userId:user.id,userName:user.name,amount,status:'aguardando-pagamento',createdAt:new Date().toISOString()};write(K.parts,[item,...all]);return item},
 async listParticipations(userId){return read(K.parts,[]).filter(p=>p.userId===userId)},
 async listOwnedCampaigns(userId){return (await this.listCampaigns()).filter(c=>c.ownerId===userId)},
 async listReservedNumbers(campaignId){return read(K.parts,[]).filter(p=>p.campaignId===campaignId).flatMap(p=>p.numbers)}
}

// Futuro: implemente supabaseDataService com a mesma interface e altere somente esta exportação.
