// public/painel/app.js — v2.5
// Comentários pedagógicos: fluxo do painel, ações e polling básico.

const menuButtons = document.querySelectorAll('.menu button')
const tabs = document.querySelectorAll('.tab')
const pageTitle = document.getElementById('page-title')
menuButtons.forEach((btn) =>
  btn.addEventListener('click', () => {
    menuButtons.forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    tabs.forEach((s) => s.classList.remove('active'))
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active')
    pageTitle.textContent = btn.textContent
  })
)

// Parear TV
const approveBtn = document.getElementById('btn-approve')
approveBtn?.addEventListener('click', async () => {
  const code = document.getElementById('pair-code').value.trim()
  const name = document.getElementById('pair-name').value.trim()
  const location = document.getElementById('pair-location').value.trim()
  const out = document.getElementById('pair-result')
  out.textContent = ''
  if (!code || !name || !location) {
    out.textContent = 'Preencha todos os campos.'
    out.style.color = '#e98b16'
    return
  }
  const r = await fetch('/api/tvs/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, name, location }),
  })
  const j = await r.json()
  if (!r.ok) {
    out.textContent = j.error || 'Falha ao aprovar'
    out.style.color = '#c62828'
    return
  }
  out.textContent = `Aprovado! TV ID: ${j.tvId}`
  out.style.color = '#2e7d32'
  await loadTVs()
  await buildTVSelect()
  await updateKPIs()
})

// DASHBOARD/KPIs
async function updateKPIs() {
  const tvs = await (await fetch('/api/tvs')).json()
  document.getElementById('kpi-total').textContent = tvs.length
  const now = Date.now()
  const ativas = tvs.filter((t) => t.lastContact && now - t.lastContact < 60000).length
  document.getElementById('kpi-ativas').textContent = ativas
  document.getElementById('kpi-off').textContent = tvs.length - ativas
  try {
    const logs = await (await fetch('/api/logs?tail=200')).text()
    const pend = (logs.match(/DISPLAY_CODE_REQUEST/g) || []).length - (logs.match(/TV_APPROVED/g) || []).length
    document.getElementById('kpi-pend').textContent = Math.max(pend, 0)
  } catch {
    document.getElementById('kpi-pend').textContent = 0
  }
  const grid = document.getElementById('dash-tvs')
  grid.innerHTML = ''
  tvs.forEach((t) => {
    const last = t.lastContact ? new Date(t.lastContact).toLocaleString() : '-'
    const card = document.createElement('div')
    card.className = 'tv-card'
    card.innerHTML = `<b>${t.name}</b><div class="muted">${t.location}</div><div class="muted">Último contato: ${last}</div><div class="muted">Tocando: ${t.nowPlaying || '-'}</div>`
    const actions = document.createElement('div')
    actions.className = 'tv-actions'
    const del = document.createElement('button')
    del.textContent = 'Remover TV'
    del.className = 'action-danger'
    del.onclick = () => deleteTV(t.id)
    actions.appendChild(del)
    card.appendChild(actions)
    grid.appendChild(card)
  })
}
async function deleteTV(id) {
  if (!confirm('Remover esta TV?')) return
  const r = await fetch(`/api/tvs/${id}`, { method: 'DELETE' })
  if (!r.ok) {
    alert('Falha ao remover TV')
    return
  }
  await loadTVs()
  await buildTVSelect()
  await updateKPIs()
}

// Conteúdo & Playlist
const tvSelect = document.getElementById('pl-tv')
const itemsDiv = document.getElementById('pl-items')
const mediaGrid = document.getElementById('media-grid')
const fileInput = document.getElementById('file-input')
const fixedEnabled = document.getElementById('fixed-enabled')
const fixedSrc = document.getElementById('fixed-src')
const fixedType = document.getElementById('fixed-type')
const btnUseSelected = document.getElementById('btn-use-selected')

document.getElementById('btn-upload').onclick = async () => {
  const files = fileInput.files
  if (!files || !files.length) return
  for (const f of files) {
    const fd = new FormData()
    fd.append('file', f)
    await fetch('/api/upload', { method: 'POST', body: fd })
  }
  await loadUploads()
}

document.getElementById('btn-save').onclick = savePlaylist

function itemRow(item) {
  const wrap = document.createElement('div')
  wrap.className = 'playlist-item'
  wrap.draggable = true
  wrap.innerHTML = `
    <div class="row">
      <div><label>Tipo</label>
        <select class="i-type">
          <option value="image" ${item.type === 'image' ? 'selected' : ''}>Imagem</option>
          <option value="video" ${item.type === 'video' ? 'selected' : ''}>Vídeo</option>
        </select>
      </div>
      <div><label>Ativo</label><input type="checkbox" class="i-enabled" ${item.enabled !== false ? 'checked' : ''} /></div>
      <div style="grid-column:1/3"><label>Fonte (URL público)</label><input class="i-src" value="${item.src || ''}" placeholder="/uploads/arquivo.mp4"/></div>
      <div><label>Duração (s) — imagens</label><input type="number" class="i-duration" min="1" value="${item.duration || 8}"/></div>
      <div><label>Start (ISO opcional)</label><input class="i-start" placeholder="2025-11-03T09:00:00" value="${item.start_at || ''}"/></div>
      <div><label>End (ISO opcional)</label><input class="i-end" placeholder="2025-11-03T18:00:00" value="${item.end_at || ''}"/></div>
      <div style="grid-column:1/3;display:flex;gap:8px"><button class="btn-preview">Pré-visualizar</button><button class="btn-del action-danger">Remover</button></div>
    </div>`
  wrap.querySelector('.btn-preview').onclick = () => previewItem({ type: wrap.querySelector('.i-type').value, src: wrap.querySelector('.i-src').value })
  wrap.querySelector('.btn-del').onclick = () => wrap.remove()
  wrap.addEventListener('dragstart', (e) => {
    wrap.classList.add('dragging')
    e.dataTransfer.setData('text/plain', '')
  })
  wrap.addEventListener('dragend', () => wrap.classList.remove('dragging'))
  return wrap
}

itemsDiv?.addEventListener('dragover', (e) => {
  e.preventDefault()
  const dragging = document.querySelector('.playlist-item.dragging')
  if (!dragging) return
  const after = getDragAfterElement(itemsDiv, e.clientY)
  if (after == null) {
    itemsDiv.appendChild(dragging)
  } else {
    itemsDiv.insertBefore(dragging, after)
  }
})
function getDragAfterElement(container, y) {
  const els = [...container.querySelectorAll('.playlist-item:not(.dragging)')]
  return els.reduce((closest, child) => {
    const box = child.getBoundingClientRect()
    const offset = y - box.top - box.height / 2
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child }
    } else return closest
  }, { offset: Number.NEGATIVE_INFINITY }).element
}

async function buildTVSelect() {
  const tvs = await (await fetch('/api/tvs')).json()
  tvSelect.innerHTML = tvs.map((t) => `<option value="${t.id}">${t.name} — ${t.location}</option>`).join('')
  if (tvs.length) await loadPlaylist(tvs[0].id)
}

tvSelect?.addEventListener('change', () => loadPlaylist(tvSelect.value))

async function loadPlaylist(tvId) {
  const r = await fetch(`/api/playlists/${tvId}`)
  const j = await r.json()
  itemsDiv.innerHTML = ''
  ;(j.items || []).forEach((it) => itemsDiv.appendChild(itemRow(it)))
  fixedEnabled.checked = !!(j.fixed && j.fixed.enabled)
  fixedSrc.value = (j.fixed && j.fixed.item && j.fixed.item.src) || ''
  fixedType.value = (j.fixed && j.fixed.item && j.fixed.item.type) || 'image'
}

function collectItems() {
  return Array.from(itemsDiv.children).map((el) => ({
    type: el.querySelector('.i-type').value,
    enabled: el.querySelector('.i-enabled').checked,
    src: el.querySelector('.i-src').value.trim(),
    duration: parseInt(el.querySelector('.i-duration').value || '8', 10),
    start_at: el.querySelector('.i-start').value.trim() || null,
    end_at: el.querySelector('.i-end').value.trim() || null,
    id: crypto.randomUUID(),
  }))
}

async function savePlaylist() {
  const tvId = tvSelect.value
  if (!tvId) return
  const items = collectItems()
  const fixed = { enabled: fixedEnabled.checked, item: fixedEnabled.checked ? { type: fixedType.value, src: fixedSrc.value.trim(), duration: 8 } : null }
  const r = await fetch(`/api/playlists/${tvId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, fixed }) })
  const j = await r.json()
  const out = document.getElementById('pl-status')
  if (!r.ok) {
    out.textContent = j.error || 'Falha ao salvar'
    out.style.color = '#c62828'
    return
  }
  out.textContent = 'Playlist/Conteúdo fixo salvo e enviado.'
  out.style.color = '#2e7d32'
}

async function loadUploads() {
  const list = await (await fetch('/api/uploads')).json()
  mediaGrid.innerHTML = ''
  list
    .slice()
    .reverse()
    .forEach((m) => {
      const el = document.createElement('div')
      el.className = 'thumb'
      const isImg = /\.(png|jpe?g|gif|webp)$/i.test(m.name)
      el.innerHTML = `${isImg ? `<img src="${m.url}">` : `<video src="${m.url}" muted loop></video>`}<div class="thumb-actions"><button class="add">Adicionar</button><button class="prev">Pré-visualizar</button><button class="del action-danger">Remover</button></div>`
      el.querySelector('.add').onclick = () => itemsDiv.appendChild(itemRow({ type: isImg ? 'image' : 'video', src: m.url, duration: isImg ? 8 : undefined, enabled: true }))
      el.querySelector('.prev').onclick = () => previewItem({ type: isImg ? 'image' : 'video', src: m.url })
      el.querySelector('.del').onclick = async () => {
        if (!confirm('Remover este arquivo?')) return
        await fetch(`/api/uploads/${encodeURIComponent(m.name)}`, { method: 'DELETE' })
        await loadUploads()
      }
      mediaGrid.appendChild(el)
    })
}

function previewItem(item) {
  const v = document.getElementById('preview-video')
  const i = document.getElementById('preview-img')
  v.style.display = 'none'
  i.style.display = 'none'
  if (item.type === 'image') {
    i.src = item.src
    i.style.display = 'block'
  } else {
    v.src = item.src
    v.style.display = 'block'
    v.play()
  }
}

async function loadTVs() {
  const tvs = await (await fetch('/api/tvs')).json()
  const tb = document.querySelector('#tvs-table tbody')
  if (!tb) return
  tb.innerHTML = ''
  const now = Date.now()
  tvs.forEach((t) => {
    const uptime = t.onlineSince ? msToHMS(now - t.onlineSince) : '-'
    const isImg = t.nowPlaying && /\.(png|jpe?g|gif|webp)$/i.test(t.nowPlaying)
    const prev = isImg ? `<img src="${t.nowPlaying}"/>` : t.nowPlaying ? `<video src="${t.nowPlaying}" muted loop></video>` : '-'
    const tr = document.createElement('tr')
    tr.innerHTML = `<td>${t.name}</td><td>${t.location}</td><td>${uptime}</td><td>${t.nowPlaying || '-'}</td><td class="small-prev">${prev}</td><td></td>`
    const td = tr.querySelector('td:last-child')
    const btn = document.createElement('button')
    btn.textContent = 'Restart TV'
    btn.onclick = async () => {
      await fetch(`/api/commands/${t.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reload: true }) })
      alert('Comando de restart enviado')
    }
    td.appendChild(btn)
    tb.appendChild(tr)
  })
}

function msToHMS(ms) {
  const s = Math.floor(ms / 1000)
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const se = String(s % 60).padStart(2, '0')
  return `${h}:${m}:${se}`
}

// Inicializa
;(async function init() {
  await buildTVSelect()
  await loadUploads()
  await updateKPIs()
  await loadTVs()
  setInterval(updateKPIs, 5000)
})()
