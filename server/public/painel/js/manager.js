const tvSelect = document.getElementById('cfg-tv')
const itemSelect = document.getElementById('cfg-item')
const grid = document.getElementById('cal-grid')
const title = document.getElementById('cal-title')
const prev = document.getElementById('cal-prev')
const next = document.getElementById('cal-next')
const timeStart = document.getElementById('time-start')
const timeEnd = document.getElementById('time-end')
const summary = document.getElementById('cfg-summary')
const applyBtn = document.getElementById('cfg-apply')

let view = new Date()
let startSel = null
let endSel = null

function dayKey(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }

function buildTimes(){
  const opts=[]
  for(let h=0; h<24; h++) for(let m=0; m<60; m+=15){ const hh=String(h).padStart(2,'0'); const mm=String(m).padStart(2,'0'); opts.push(`${hh}:${mm}`) }
  timeStart.innerHTML = opts.map(t=>`<option value="${t}">${t}</option>`).join('')
  timeEnd.innerHTML = opts.map(t=>`<option value="${t}">${t}</option>`).join('')
}

async function buildTVs(){
  const tvs = await (await fetch('/api/tvs')).json()
  tvSelect.innerHTML = tvs.map((t)=>`<option value="${t.id}">${t.name} — ${t.location}${t.group? ' • '+t.group:''}</option>`).join('')
  await buildItems()
}

async function buildItems(){
  const tvId = tvSelect.value
  const p = await (await fetch(`/api/playlists/${tvId}`)).json()
  itemSelect.innerHTML = (p.items||[]).map((it,idx)=>`<option value="${idx}">${it.type.toUpperCase()} — ${it.src}</option>`).join('')
  updateSummary()
}

function render(){
  const year=view.getFullYear(), month=view.getMonth()
  title.textContent = new Date(year, month, 1).toLocaleString(undefined,{month:'long',year:'numeric'})
  grid.innerHTML = ''
  const first = new Date(year, month, 1)
  const startWeek = first.getDay()
  const days = new Date(year, month+1, 0).getDate()
  const today = dayKey(new Date())
  for(let i=0;i<startWeek;i++){ const blank=document.createElement('div'); grid.appendChild(blank) }
  for(let d=1; d<=days; d++){
    const el = document.createElement('div')
    el.className = 'cal-day'
    el.textContent = d
    const cur = dayKey(new Date(year, month, d))
    const disabled = cur < today
    if(disabled) el.classList.add('disabled')
    el.onclick = ()=>{
      if(disabled) return
      if(!startSel || (startSel && endSel)) { startSel = new Date(year, month, d); endSel = null }
      else { const second = new Date(year, month, d); if(second < startSel){ endSel = startSel; startSel = second } else endSel = second }
      updateSelected()
      updateSummary()
    }
    grid.appendChild(el)
  }
}

function updateSelected(){
  const days = grid.querySelectorAll('.cal-day')
  days.forEach(d=>d.classList.remove('selected'))
  if(!startSel) return
  const year=view.getFullYear(), month=view.getMonth()
  const startDay = startSel.getDate()
  const endDay = (endSel||startSel).getDate()
  for(let d=startDay; d<=endDay; d++){
    const idx = d + new Date(year, month, 1).getDay() - 1
    const el = grid.children[idx]
    el?.classList.add('selected')
  }
}

function updateSummary(){
  if(!startSel){ summary.textContent = 'Selecione um intervalo de datas'; return }
  const end = endSel || startSel
  const s = `${startSel.toLocaleDateString()} ${timeStart.value||'00:00'}`
  const e = `${end.toLocaleDateString()} ${timeEnd.value||'23:59'}`
  summary.textContent = `Início: ${s} • Fim: ${e}`
}

applyBtn?.addEventListener('click', async ()=>{
  const tvId = tvSelect.value
  const idx = parseInt(itemSelect.value||'0',10)
  const p = await (await fetch(`/api/playlists/${tvId}`)).json()
  const items = (p.items||[]).slice()
  if(!items[idx]) return alert('Selecione um item válido')
  const today = new Date()
  const startDate = startSel || today
  const endDate = endSel || startDate
  const [sh, sm] = (timeStart.value||'00:00').split(':').map(Number)
  const [eh, em] = (timeEnd.value||'23:59').split(':').map(Number)
  const start_at = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), sh, sm)
  const end_at = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), eh, em)
  if(end_at < start_at) return alert('Fim não pode ser antes do início')
  if(start_at < today) return alert('Não é permitido agendar no passado')
  items[idx] = { ...items[idx], start_at: start_at.toISOString(), end_at: end_at.toISOString() }
  const next = { items, fixed: p.fixed }
  const r = await fetch(`/api/playlists/${tvId}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(next) })
  if(!r.ok) return alert('Falha ao aplicar à playlist')
  alert('Agendamento aplicado ao item.')
})

prev?.addEventListener('click', ()=>{ view = new Date(view.getFullYear(), view.getMonth()-1, 1); render(); updateSelected() })
next?.addEventListener('click', ()=>{ view = new Date(view.getFullYear(), view.getMonth()+1, 1); render(); updateSelected() })
timeStart?.addEventListener('change', updateSummary)
timeEnd?.addEventListener('change', updateSummary)

document.addEventListener('DOMContentLoaded', async ()=>{ buildTimes(); await buildTVs(); render() })