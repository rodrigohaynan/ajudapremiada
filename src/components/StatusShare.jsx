import { useEffect, useRef, useState } from 'react'
import qrFactory from '../vendor/qrcode.mjs'
import { dataService } from '../services/dataService'
import { money } from './CampaignCard'

const W=1080,H=1920
const brand='#0f766e'
const string=(value)=>String(value||'')
const round=(ctx,x,y,w,h,r,fill)=>{
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill()
}
const drawText=(ctx,text,x,y,maxWidth,font,color)=>{
  ctx.font=font;ctx.fillStyle=color;ctx.fillText(string(text),x,y,maxWidth)
}
const wrapText=(ctx,text,x,y,maxWidth,lineHeight,maxLines,font,color)=>{
  const words=string(text).split(/\s+/)
  ctx.font=font;ctx.fillStyle=color;let line='',lines=0
  for(let i=0;i<words.length;i++){
    const test=line?(line+' '+words[i]):words[i]
    if(ctx.measureText(test).width>maxWidth&&line){
      ctx.fillText(line,x,y+lines*lineHeight)
      lines++;line=words[i]
      if(lines>=maxLines-1)break
    }else line=test
  }
  if(line&&lines<maxLines)ctx.fillText(line,x,y+lines*lineHeight,maxWidth)
}
async function drawCover(ctx,url){
  if(!url)return
  const img=new Image()
  img.crossOrigin='anonymous'
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url})
  const ratio=Math.min(920/img.naturalWidth,440/img.naturalHeight)
  const iw=img.naturalWidth*ratio,ih=img.naturalHeight*ratio
  ctx.drawImage(img,80+(920-iw)/2,365+(440-ih)/2,iw,ih)
}
function drawQr(ctx,url,x,y,size){
  const qr=qrFactory(0,'M');qr.addData(url);qr.make()
  const cells=qr.getModuleCount(),moduleSize=size/(cells+8)
  round(ctx,x,y,size,size,16,'#fff')
  ctx.fillStyle='#172b28'
  for(let row=0;row<cells;row++)for(let col=0;col<cells;col++){
    if(qr.isDark(row,col))ctx.fillRect(x+(col+4)*moduleSize,y+(row+4)*moduleSize,moduleSize+.18,moduleSize+.18)
  }
}
function drawGrid(ctx,statuses,quantity){
  const paid=statusess=>statusess.filter(s=>s==='paid').length
  const sold=paid(statuses), reserved=statuses.filter(s=>s==='reserved').length
  const available=quantity-sold-reserved
  round(ctx,50,950,980,568,28,'#ffffff')
  drawText(ctx,'QUAIS NÚMEROS ESTÃO LIVRES?',86,1012,880,'800 32px Arial',brand)
  if(quantity<=160){
    const cols=10,rows=Math.ceil(quantity/cols),gap=9,cellW=87,cellH=Math.min(39,(430-(rows-1)*gap)/rows)
    const top=1044
    for(let i=0;i<quantity;i++){
      const col=i%cols,row=Math.floor(i/cols),x=83+col*(cellW+gap),y=top+row*(cellH+gap)
      const type=statuses[i],bg=type==='paid'?'#0f766e':type==='reserved'?'#f3c86b':'#eff5f3'
      round(ctx,x,y,cellW,cellH,8,bg)
      drawText(ctx,String(i+1).padStart(3,'0'),x+cellW/2-23,y+cellH*.71,50,'700 19px Arial',type==='paid'?'#fff':'#183b35')
    }
  }else{
    drawText(ctx,'Veja no site a grade completa e atualizada.',85,1084,905,'600 28px Arial','#425d55')
    const groups=[
      ['LIVRES',statuses.map((s,i)=>s==='available'?i+1:null).filter(Boolean),'#e9f4f0'],
      ['CONFIRMADOS',statuses.map((s,i)=>s==='paid'?i+1:null).filter(Boolean),'#e0f0eb'],
      ['RESERVADOS',statuses.map((s,i)=>s==='reserved'?i+1:null).filter(Boolean),'#fff1cf']
    ]
    for(let g=0;g<3;g++){
      const [name,nums,bg]=groups[g],y=1110+g*125
      round(ctx,75,y,930,108,14,bg)
      drawText(ctx,name,94,y+33,830,'800 23px Arial',brand)
      const text=nums.length?nums.slice(0,14).map(n=>String(n).padStart(3,'0')).join(' · ')+(nums.length>14?' · ...':''):'Nenhum'
      drawText(ctx,text,94,y+77,860,'600 26px Arial','#213731')
    }
  }
  return {sold,reserved,available}
}
async function makeImage(campaign,statusRows){
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas indisponível.')
  const url=window.location.origin+'/campanha/'+encodeURIComponent(campaign.slug)
  const now=Date.now()
  const lookup=new Map(statusRows.map(x=>[Number(x.number),x]))
  const statuses=Array.from({length:campaign.quantity},(_,i)=>{
    const row=lookup.get(i+1)
    return row?.status==='paid'?'paid':row?.status==='reserved'&&Date.parse(row.reserved_until)>now?'reserved':'available'
  })
  ctx.fillStyle='#f5fbf9';ctx.fillRect(0,0,W,H)
  round(ctx,0,0,W,330,0,brand)
  round(ctx,56,54,88,88,24,'#ffffff')
  drawText(ctx,'♥',80,116,65,'800 58px Arial',brand)
  drawText(ctx,'AJUDE E GANHE',175,105,840,'800 47px Arial','#ffffff')
  drawText(ctx,'Compartilhe a solidariedade',175,150,830,'500 30px Arial','#dbf6ee')
  wrapText(ctx,campaign.title,59,241,960,58,2,'800 50px Arial','#ffffff')
  round(ctx,50,343,980,480,25,'#ffffff')
  try{await drawCover(ctx,campaign.coverImage)}catch{drawText(ctx,'♥',430,615,200,'800 130px Arial',brand)}
  round(ctx,50,840,980,98,21,'#e4f4ef')
  drawText(ctx,money(campaign.price)+' / NÚMERO',85,907,900,'800 43px Arial',brand)
  const totals=drawGrid(ctx,statuses,campaign.quantity)
  round(ctx,55,1523,305,90,20,'#e2f3ee')
  round(ctx,388,1523,305,90,20,'#f7ecd2')
  round(ctx,720,1523,305,90,20,'#d2eee5')
  drawText(ctx,totals.available+' LIVRES',80,1580,260,'800 28px Arial',brand)
  drawText(ctx,totals.reserved+' RESERVADOS',407,1580,270,'800 25px Arial','#75571b')
  drawText(ctx,totals.sold+' PAGOS',744,1580,260,'800 27px Arial',brand)
  round(ctx,44,1635,992,246,24,'#ffffff')
  drawQr(ctx,url,73,1650,210)
  drawText(ctx,'ESCANEIE PARA PARTICIPAR',305,1706,700,'800 32px Arial',brand)
  drawText(ctx,'ou use o link da campanha',305,1750,705,'500 28px Arial','#425e58')
  drawText(ctx,'ajude-e-ganhe.netlify.app',305,1791,680,'700 28px Arial','#23423b')
  drawText(ctx,'Confira a disponibilidade atual antes de reservar.',70,1900,930,'600 23px Arial','#4c665f')
  drawText(ctx,'Imagem atualizada em '+new Date(now).toLocaleString('pt-BR'),70,1920-7,900,'400 18px Arial','#758c84')
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png',.94))
  if(!blob)throw new Error('Não foi possível gerar a arte.')
  return {blob,url}
}

export default function StatusShare({campaign}){
  const [working,setWorking]=useState(false)
  const [preview,setPreview]=useState('')
  const [result,setResult]=useState(null)
  const [notice,setNotice]=useState('')
  const previewRef=useRef(null)
  useEffect(()=>()=>{if(previewRef.current)URL.revokeObjectURL(previewRef.current)},[])
  const create=async()=>{
    setWorking(true);setNotice('')
    try{
      const rows=await dataService.listNumberStatuses(campaign.id)
      const output=await makeImage(campaign,rows)
      if(previewRef.current)URL.revokeObjectURL(previewRef.current)
      const p=URL.createObjectURL(output.blob)
      previewRef.current=p;setPreview(p);setResult(output)
      setNotice('Arte criada com a situação dos números neste momento.')
    }catch(e){setNotice(e.message||'Falha ao gerar a imagem.')}
    finally{setWorking(false)}
  }
  const download=()=>{
    if(!result)return
    const a=document.createElement('a');a.href=preview;a.download='status-ajude-e-ganhe-'+campaign.slug+'.png';a.click()
  }
  const copyLink=async()=>{
    if(!result)return
    try{await navigator.clipboard.writeText(result.url);setNotice('Link da campanha copiado. No WhatsApp, use a figurinha de link no Status.')}
    catch{setNotice(result.url)}
  }
  const share=async()=>{
    if(!result)return
    const file=new File([result.blob],'status-ajude-e-ganhe.png',{type:'image/png'})
    if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
      try{await navigator.share({files:[file],title:campaign.title,text:'Acesse a campanha: '+result.url})}
      catch(e){if(e.name!=='AbortError')setNotice('Compartilhamento não disponível. Baixe a imagem e publique pelo WhatsApp.')}
    }else{download();setNotice('Imagem baixada. Abra o Status no WhatsApp, selecione a imagem e adicione uma figurinha de link.')}
  }
  return <section className="statusShare">
    <h3>📲 Compartilhe os números no Status</h3>
    <p>Gere uma imagem com números <b>disponíveis, reservados e pagos</b>, valor, QR Code e o endereço da campanha. Qualquer visitante pode compartilhar.</p>
    <button className="btn primary" type="button" onClick={create} disabled={working}>{working?'Gerando arte…':'Gerar imagem para Status'}</button>
    {preview&&<div className="statusSharePreview">
      <img src={preview} alt="Prévia da arte com números e QR Code para WhatsApp Status" />
      <div className="statusShareActions">
        <button type="button" className="btn primary" onClick={share}>Compartilhar imagem</button>
        <button type="button" className="btn ghost" onClick={download}>Baixar imagem</button>
        <button type="button" className="btn ghost" onClick={copyLink}>Copiar link</button>
      </div>
    </div>}
    <small>O Status é uma imagem estática. Quem vê depois deve conferir os números no site. Para deixar o link clicável, adicione a figurinha “Link” no editor do Status do WhatsApp.</small>
    {notice&&<p role="status" className="statusNotice">{notice}</p>}
  </section>
}
