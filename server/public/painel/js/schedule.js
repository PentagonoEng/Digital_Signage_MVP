const listEl = document.getElementById('mgr-list')
const createBtn = document.getElementById('mgr-create')
const newName = document.getElementById('mgr-new-name')
const search = document.getElementById('mgr-search')
const statusEl = document.getElementById('mgr-status')
const timeline = document.getElementById('mgr-timeline')
const mediaGrid = document.getElementById('mgr-media')
const prevImg = document.getElementById('mgr-prev-img')
const prevVid = document.getElementById('mgr-prev-video')
const assignBtn = document.getElementById('mgr-assign')

let playlists = []
let activeId = null
let items = []
let fixed = { enabled:false, item:null }
let saveTimer = null

function setStatus(t){ statusEl.textContent = t }
function renderList(){
  const q = (search.value||'').toLowerCase()
  listEl.innerHTML = playlists.filter(p=>p.name.toLowerCase().includes(q)).map(p=>`<div class="mgr-item ${p.id===activeId?'active':''}" data-id="${p.id}"><b>${p.name}</b><div class="muted">Atualizada: ${p.updatedAt? new Date(p.updatedAt).toLocaleString(): '-'}</div></div>`).join('')
  listEl.querySelectorAll('.mgr-item').forEach(el=> el.onclick = ()=> selectPlaylist(el.dataset.id))
}
async function loadLib(){ playlists = await (await fetch('/api/playlist-lib')).json(); renderList() }
async function selectPlaylist(id){ activeId=id; const p = await (await fetch(`/api/playlist-lib/${id}`)).json(); items = p.items||[]; fixed = p.fixed||{enabled:false,item:null}; renderTimeline(); setStatus('Pronto') }
function renderTimeline(){
  timeline.innerHTML = items.map((it,idx)=>{
    const isImg = it.type==='image'
    return `<div class="block" draggable="true" data-idx="${idx}"><div class="thumb">${isImg? `<img src="${it.src}" style="width:100%;height:100%;object-fit:cover">` : `<video src="${it.src}" muted style="width:100%;height:100%;object-fit:cover"></video>`}</div><div class="controls"><button class="i-dur" title="Duração"><span>⏱</span></button><button class="i-vis" title="Visibilidade"><span>👁</span></button><button class="i-aud" title="Áudio"><span>🔇</span></button><button class="i-del" title="Excluir"><span>🗑</span></button></div></div>`
  }).join('')
  bindTimeline()
}
function bindTimeline(){
  timeline.querySelectorAll('.block').forEach(b=>{
    b.addEventListener('dragstart', e=>{ b.classList.add('dragging'); e.dataTransfer.setData('text/plain','') })
    b.addEventListener('dragend', ()=> b.classList.remove('dragging'))
    b.querySelector('.i-del').onclick = ()=>{ const idx=parseInt(b.dataset.idx,10); items.splice(idx,1); renderTimeline(); scheduleSave() }
    b.querySelector('.i-dur').onclick = ()=>{ const idx=parseInt(b.dataset.idx,10); const v=prompt('Duração (s) para imagens', items[idx].duration||8); if(v){ items[idx].duration = parseInt(v,10)||8; scheduleSave(); renderTimeline() } }
    b.querySelector('.i-vis').onclick = ()=>{ const idx=parseInt(b.dataset.idx,10); items[idx].enabled = items[idx].enabled!==false ? false : true; scheduleSave(); renderTimeline() }
    b.querySelector('.i-aud').onclick = ()=>{ const idx=parseInt(b.dataset.idx,10); items[idx].muted = items[idx].muted!==false ? false : true; scheduleSave(); renderTimeline() }
  })
  timeline.addEventListener('dragover', e=>{
    e.preventDefault()
    const dragging = timeline.querySelector('.block.dragging')
    if(!dragging) return
    const after = getAfter(timeline, e.clientX)
    if(after==null) timeline.appendChild(dragging)
    else timeline.insertBefore(dragging, after)
  })
}
function getAfter(container, x){
  const els=[...container.querySelectorAll('.block:not(.dragging)')]
  return els.reduce((closest, child)=>{
    const box = child.getBoundingClientRect()
    const offset = x - box.left - box.width/2
    if(offset<0 && offset>closest.offset){ return {offset, element:child} } else return closest
  }, {offset:Number.NEGATIVE_INFINITY}).element
}
async function loadMedia(){
  const list = await (await fetch('/api/uploads')).json()
  mediaGrid.innerHTML = list.map(m=>{
    const isImg = /\.(png|jpe?g|gif|webp)$/i.test(m.name)
    return `<div class="thumb" data-src="${m.url}" data-type="${isImg?'image':'video'}">${isImg? `<img src="${m.url}">` : `<video src="${m.url}" muted loop></video>`}</div>`
  }).join('')
  mediaGrid.querySelectorAll('.thumb').forEach(el=>{
    el.onmouseenter = ()=>{
      const src = el.dataset.src, isImg = el.dataset.type==='image'
      prevVid.style.display='none'; prevImg.style.display='none'
      if(isImg){ prevImg.src = src; prevImg.style.display='block' } else { prevVid.src = src; prevVid.style.display='block'; prevVid.play() }
    }
    el.draggable = true
    el.addEventListener('dragstart', e=>{ el.classList.add('dragging'); e.dataTransfer.setData('text/plain','') })
    el.addEventListener('dragend', ()=> el.classList.remove('dragging'))
  })
  timeline.addEventListener('dragover', e=>{
    const draggingMedia = mediaGrid.querySelector('.thumb.dragging')
    if(draggingMedia){ e.preventDefault(); const src=draggingMedia.dataset.src; const type=draggingMedia.dataset.type; items.push({type,src,duration:type==='image'?8:undefined,enabled:true}); renderTimeline(); scheduleSave() }
  })
}
function scheduleSave(){ clearTimeout(saveTimer); setStatus('Salvando…'); saveTimer=setTimeout(saveNow, 800) }
async function saveNow(){ if(!activeId) return; await fetch(`/api/playlist-lib/${activeId}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ items, fixed })}); setStatus('Salvo!') }

createBtn?.addEventListener('click', async ()=>{ const name=(newName.value||'').trim()||'Nova Playlist'; const r=await fetch('/api/playlist-lib',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name})}); const j=await r.json(); await loadLib(); selectPlaylist(j.id) })
search?.addEventListener('input', renderList)
assignBtn?.addEventListener('click', async ()=>{
  const tvs = await (await fetch('/api/tvs')).json()
  const ids = prompt('Atribuir a TVs (ids separados por vírgula)\nDisponíveis: '+tvs.map(t=>t.id).join(', '))
  if(!ids) return
  const tvIds = ids.split(',').map(s=>s.trim()).filter(Boolean)
  const r = await fetch('/api/playlist-assignments',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ tvIds, playlistId: activeId })})
  if(!r.ok) return alert('Falha ao atribuir')
  alert('Atribuído com sucesso')
})

document.addEventListener('DOMContentLoaded', async ()=>{ await loadLib(); await loadMedia() })