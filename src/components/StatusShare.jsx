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
  // Esta arte pública NÃO diferencia pagamento confirmado de reserva.
  const unavailable=statuses.filter(state=>state==='unavailable').length
  const available=quantity-unavailable
  round(ctx,50,950,980,568,28,'#ffffff')
  drawText(ctx,'STATUS DOS NÚMEROS',86,1007,870,'800 32px Arial',brand)
  round(ctx,87,1029,32,27,7,'#eff5f3')
  drawText(ctx,'Disponível (livre)',129,1051,360,'600 23px Arial','#244a43')
  round(ctx,558,1029,32,27,7,'#f5c6c6')
  drawText(ctx,'Indisponível',602,1051,340,'600 23px Arial','#6e3232')

  if(quantity<=160){
    const cols=10,rows=Math.ceil(quantity/cols)
    const gapX=8,gapY=7,cellW=86
    const cellH=Math.min(37,(390-(rows-1)*gapY)/rows)
    const fontSize=Math.max(13,Math.min(19,cellH*.64))
    const top=1088
    const previousAlign=ctx.textAlign
    ctx.textAlign='center'
    for(let i=0;i<quantity;i++){
      const col=i%cols,row=Math.floor(i/cols)
      const x=72+col*(cellW+gapX),y=top+row*(cellH+gapY)
      const unavailableNumber=statuses[i]==='unavailable'
      round(ctx,x,y,cellW,cellH,Math.min(8,cellH/3),unavailableNumber?'#f5c6c6':'#eff5f3')
      drawText(ctx,String(i+1).padStart(3,'0'),x+cellW/2,y+cellH*.71,cellW-8,
        '700 '+fontSize+'px Arial',unavailableNumber?'#6b3030':'#183b35')
    }
    ctx.textAlign=previousAlign
  }else{
    drawText(ctx,'Consulte a grade completa e atualizada na campanha.',86,1105,880,'600 25px Arial','#425d55')
    const groups=[
      ['DISPONÍVEIS',statuses.map((state,i)=>state==='available'?i+1:null).filter(Boolean),'#e9f4f0'],
      ['INDISPONÍVEIS',statuses.map((state,i)=>state==='unavailable'?i+1:null).filter(Boolean),'#fbe6e6']
    ]
    for(let i=0;i<groups.length;i++){
      const [name,numbers,background]=groups[i],y=1141+i*160
      round(ctx,75,y,930,139,15,background)
      drawText(ctx,name+' ('+numbers.length+')',95,y+40,840,'800 26px Arial',brand)
      const preview=numbers.length?
        numbers.slice(0,16).map(n=>String(n).padStart(3,'0')).join(' · ')+(numbers.length>16?' · ...':''):
        'Nenhum'
      drawText(ctx,preview,95,y+92,852,'600 24px Arial','#213731')
    }
  }
  return {available,unavailable}
}
async function makeImage(campaign,statusRows){
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas indisponível.')
  const url=window.location.origin+'/campanha/'+encodeURIComponent(campaign.slug)
  const now=Date.now()
  const lookup=new Map(statusRows.map(x=>[Number(x.number),x]))
  const statuses=Array.from({length:campaign.quantity},(_,i)=>{
    const row=lookup.get(i+1)
    return row?.status==='paid'||(row?.status==='reserved'&&Date.parse(row.reserved_until)>now)
      ? 'unavailable' : 'available'
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
  round(ctx,55,1523,472,90,20,'#e2f3ee')
  round(ctx,548,1523,477,90,20,'#fbe6e6')
  drawText(ctx,totals.available+' DISPONÍVEIS',79,1580,435,'800 32px Arial',brand)
  drawText(ctx,totals.unavailable+' INDISPONÍVEIS',570,1580,430,'800 30px Arial','#a34646')
  round(ctx,44,1635,992,246,24,'#ffffff')
  drawQr(ctx,url,73,1650,210)
  drawText(ctx,'ESCANEIE PARA PARTICIPAR',305,1706,700,'800 32px Arial',brand)
  drawText(ctx,'ou use o link da campanha',305,1750,705,'500 28px Arial','#425e58')
  drawText(ctx,'ajude-e-ganhe.netlify.app/campanha/',305,1790,680,'700 24px Arial','#23423b')
  drawText(ctx,campaign.slug,305,1830,680,'700 24px Arial','#23423b')
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
    <p>Gere uma imagem com números <b>disponíveis e indisponíveis</b>, sem revelar quais estão reservados ou pagos. Inclui valor, QR Code e endereço da campanha. Qualquer visitante pode compartilhar.</p>
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
