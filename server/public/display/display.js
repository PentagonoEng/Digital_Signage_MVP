// public/display/display.js — v2.5
// Crossfade de dupla camada com pré-carregamento real: imagem espera evento 'load',
// vídeo espera 'canplay' antes de entrar, evitando quadros pretos.

;(function(){
  const qs = new URLSearchParams(location.search)
  let tvId = localStorage.getItem('tvId') || qs.get('tv')
  const pairEl = document.getElementById('pair')
  const codeEl = document.getElementById('code')
  const playerEl = document.getElementById('player')

  const layerA = document.querySelectorAll('.layer')[0]
  const layerB = document.querySelectorAll('.layer')[1]
  const imgA = document.getElementById('imgA')
  const vidA = document.getElementById('vidA')
  const imgB = document.getElementById('imgB')
  const vidB = document.getElementById('vidB')

  let active = 'A'
  function show(layer){ layerA.classList.remove('show'); layerB.classList.remove('show'); layer.classList.add('show') }
  function sleep(ms){ return new Promise(r=>setTimeout(r,ms)) }

  async function heartbeat(nowPlaying){ if(!tvId) return; try{ await fetch(`/api/tvs/${tvId}/heartbeat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nowPlaying})}) }catch(e){} }

  async function startPlayer(){ pairEl.style.display='none'; playerEl.style.display='block'; playLoop(); setInterval(fetchPlaylist, 5000); setInterval(pollCommands, 3000); }

  async function pollCommands(){ if(!tvId) return; try{ const j=await (await fetch(`/api/commands/${tvId}?x=${Date.now()}`)).json(); if(j.reload){ location.reload() } }catch(e){} }

  let state = { items:[], fixed:{enabled:false,item:null}, updatedAt:0 }
  async function fetchPlaylist(){ if(!tvId) return; try{ const r=await fetch(`/api/playlists/${tvId}`,{cache:'no-store'}); const j=await r.json(); state=j; const ov=document.getElementById('overlay'); if(ov){ const has=(j.fixed&&j.fixed.enabled&&j.fixed.item)||((j.items||[]).length>0); ov.style.display=has?'none':'flex' } }catch(e){ state={items:[], fixed:{enabled:false,item:null}, updatedAt:0} } }

  function withinWindow(it){ const now=Date.now(); const s=it.start_at?Date.parse(it.start_at):null; const e=it.end_at?Date.parse(it.end_at):null; if(s&&now<s) return false; if(e&&now>e) return false; return true }

  async function playLoop(){ await fetchPlaylist(); let idx=0; while(true){
    let list=[]
    if(state.fixed && state.fixed.enabled && state.fixed.item){ list=[state.fixed.item] }
    else { list=(state.items||[]).filter(it=>it.enabled!==false && withinWindow(it)) }
    if(!list.length){ const ov=document.getElementById('overlay'); if(ov) ov.style.display='flex'; await sleep(500); continue }
    const it = list[idx % list.length]
    try{ await playItem(it) }catch(e){}
    idx++; if(idx>999999) idx=0
    await sleep(1000)
  } }

  async function loadImage(el, src){ return new Promise((res,rej)=>{ el.onload=()=>res(); el.onerror=rej; el.src=src }) }
  async function loadVideo(vid, src){ return new Promise((res,rej)=>{ vid.oncanplay=()=>res(); vid.onerror=rej; vid.src=src; vid.load() }) }

  async function playItem(it){
    const front = active==='A'? layerA : layerB
    const back  = active==='A'? layerB : layerA
    const backImg  = active==='A'? imgB : imgA
    const backVid  = active==='A'? vidB : vidA

    // Limpa apenas a camada de trás (nunca esvazia a camada visível)
    backImg.removeAttribute('src'); backImg.style.opacity=0; backVid.pause(); backVid.removeAttribute('src'); backVid.load(); backVid.style.opacity=0

    if(it.type==='image'){
      await loadImage(backImg, it.src)         // garante que a imagem renderizou
      backImg.style.opacity=1
      show(back); active = (active==='A'?'B':'A')
      await heartbeat(it.src)
      await sleep((it.duration||8)*1000)
    } else {
      await loadVideo(backVid, it.src)         // espera canplay do vídeo
      await backVid.play().catch(()=>{})
      backVid.style.opacity=1
      show(back); active = (active==='A'?'B':'A')
      await heartbeat(it.src)
      await new Promise(res=> backVid.onended=()=>res())
    }
  }

  async function requestPair(){ try{
    const r = await fetch('/api/pair/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ tvId })})
    const j = await r.json()
    if(!r.ok) throw new Error('pair request failed')
    tvId = j.tvId
    localStorage.setItem('tvId', tvId)
    codeEl.textContent = j.code
  }catch(e){ codeEl.textContent='OFFLINE'; }
  }
  async function pollPair(){ if(!tvId) return; try{ const r = await fetch(`/api/pair/status?tvId=${encodeURIComponent(tvId)}`); const j = await r.json(); if(j.approved){ startPlayer(); return } if(j.expired){ await requestPair() } }catch(e){} }

  async function boot(){ if(tvId){ try{ const j = await (await fetch(`/api/tvs/${encodeURIComponent(tvId)}/status`)).json(); if(j.exists){ startPlayer(); return } }catch(e){} localStorage.removeItem('tvId'); tvId=null }
    playerEl.style.display='none'; pairEl.style.display='flex'; await requestPair(); setInterval(pollPair,2000) }

  boot()
})()
