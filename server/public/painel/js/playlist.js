// server/public/painel/js/playlist.js
export async function buildTVSelect() {
  const tvs = await (await fetch('/api/tvs')).json()
  const tvSelect = document.getElementById('pl-tv')
  const tvMulti = document.getElementById('pl-tv-multi')
  if (!tvSelect) return
  tvSelect.innerHTML = tvs.map((t) => `<option value="${t.id}">${t.name} — ${t.location}${t.group ? ' • ' + t.group : ''}</option>`).join('')
  if (tvMulti) tvMulti.innerHTML = tvs.map((t) => `<option value="${t.id}">${t.name} — ${t.location}${t.group ? ' • ' + t.group : ''}</option>`).join('')
  if (tvs.length) await loadPlaylist(tvs[0].id)
}

export async function loadPlaylist(tvId) {
  const itemsDiv = document.getElementById('pl-items')
  itemsDiv && itemsDiv.classList.add('fade-out')
  const r = await fetch(`/api/playlists/${tvId}`)
  const j = await r.json()
  const title = document.getElementById('pl-title')
  const nameInput = document.getElementById('pl-name')
  const nameTitle = document.getElementById('pl-name-title')
  if (title) title.textContent = j.name || ''
  if (nameInput && j.name) nameInput.value = j.name
  if (nameTitle) nameTitle.textContent = j.name || ''
  const fixedEnabled = document.getElementById('fixed-enabled')
  const fixedSrc = document.getElementById('fixed-src')
  const fixedType = document.getElementById('fixed-type')
  itemsDiv.innerHTML = ''
  ;(j.items || []).forEach((it) => itemsDiv.appendChild(itemRow(it)))
  fixedEnabled.checked = !!(j.fixed && j.fixed.enabled)
  fixedSrc.value = (j.fixed && j.fixed.item && j.fixed.item.src) || ''
  fixedType.value = (j.fixed && j.fixed.item && j.fixed.item.type) || 'image'
  itemsDiv && itemsDiv.classList.remove('fade-out')
  itemsDiv && itemsDiv.classList.add('fade-in')
  itemsDiv && setTimeout(() => itemsDiv.classList.remove('fade-in'), 200)
}

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
      <div><label>Start (ISO opcional)</label><input class="i-start" value="${item.start_at || ''}"/></div>
      <div><label>End (ISO opcional)</label><input class="i-end" value="${item.end_at || ''}"/></div>
      <div style="grid-column:1/3;display:flex;gap:8px"><button class="btn-preview">Pré-visualizar</button><button class="btn-del action-danger">Remover</button></div>
    </div>`
  wrap.querySelector('.btn-preview').onclick = () => {
    previewItem({ type: wrap.querySelector('.i-type').value, src: wrap.querySelector('.i-src').value })
    wrap.classList.add('active')
    setTimeout(() => wrap.classList.remove('active'), 600)
  }
  wrap.querySelector('.btn-del').onclick = () => wrap.remove()
  wrap.addEventListener('dragstart', (e) => {
    wrap.classList.add('dragging')
    e.dataTransfer.setData('text/plain', '')
  })
  wrap.addEventListener('dragend', () => wrap.classList.remove('dragging'))
  return wrap
}

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
  const prevStatus = document.getElementById('prev-status')
  if (prevStatus) prevStatus.textContent = item.type === 'image' ? 'Visualizando imagem' : 'Visualizando vídeo'
}

;(function enhancePreviewControls(){
  const clearBtn = document.getElementById('prev-clear')
  const openLink = document.getElementById('prev-open')
  const v = document.getElementById('preview-video')
  const i = document.getElementById('preview-img')
  const status = document.getElementById('prev-status')
  clearBtn?.addEventListener('click', ()=>{ v.style.display='none'; i.style.display='none'; v.pause?.(); status && (status.textContent='Pré-visualização limpa') })
  openLink?.addEventListener('click', (e)=>{
    e.preventDefault()
    const src = i.style.display!=='none' ? i.src : (v.style.display!=='none' ? v.src : null)
    if(!src){ status && (status.textContent='Nada para abrir'); return }
    openLink.href = src
    status && (status.textContent='Abrindo em nova aba…')
    window.open(src, '_blank')
  })
})()

function collectItems() {
  const itemsDiv = document.getElementById('pl-items')
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

export async function savePlaylist() {
  const tvSelect = document.getElementById('pl-tv')
  const tvId = tvSelect.value
  if (!tvId) return
  const saveBtn = document.getElementById('btn-save')
  const out = document.getElementById('pl-status')
  try {
    saveBtn && (saveBtn.disabled = true)
    saveBtn && (saveBtn.textContent = 'Salvando…')
    saveBtn && saveBtn.classList.add('loading')
    const fixedEnabled = document.getElementById('fixed-enabled')
    const fixedSrc = document.getElementById('fixed-src')
    const fixedType = document.getElementById('fixed-type')
    let items = collectItems()
    const itemsDiv = document.getElementById('pl-items')
    let invalid = false
    Array.from(itemsDiv.children).forEach((el) => {
      const srcEl = el.querySelector('.i-src')
      const typeEl = el.querySelector('.i-type')
      const durEl = el.querySelector('.i-duration')
      const t = typeEl.value
      const src = srcEl.value.trim()
      const dur = parseInt(durEl.value || '8', 10)
      if (!src) { srcEl.style.borderColor = '#c62828'; invalid = true } else { srcEl.style.borderColor = 'var(--line)' }
      if (t === 'image' && (!dur || dur < 1)) { durEl.style.borderColor = '#c62828'; invalid = true } else { durEl.style.borderColor = 'var(--line)' }
    })
    if (invalid) {
      out.textContent = 'Preencha os campos obrigatórios da playlist'
      out.style.color = '#c62828'
      saveBtn && saveBtn.classList.remove('loading')
      saveBtn && saveBtn.classList.add('error')
      saveBtn && (saveBtn.textContent = 'Erro')
      setTimeout(() => {
        if (!saveBtn) return
        saveBtn.classList.remove('error')
        saveBtn.disabled = false
        saveBtn.textContent = 'Salvar / Enviar'
      }, 1500)
      return
    }
    const sVal = document.getElementById('pl-global-start')?.value
    const eVal = document.getElementById('pl-global-end')?.value
    if (sVal && eVal) {
      const sDate = new Date(sVal)
      const eDate = new Date(eVal)
      if (eDate > sDate) {
        const sISO = sDate.toISOString()
        const eISO = eDate.toISOString()
        items = items.map((it) => ({ ...it, start_at: sISO, end_at: eISO }))
      } else {
        out.textContent = 'Fim deve ser maior que início (global)'
        out.style.color = '#c62828'
        const gs = document.getElementById('pl-global-start'); const ge = document.getElementById('pl-global-end')
        if (gs) gs.style.borderColor = '#c62828'
        if (ge) ge.style.borderColor = '#c62828'
        saveBtn && (saveBtn.disabled = false)
        saveBtn && saveBtn.classList.remove('loading')
        saveBtn && (saveBtn.textContent = 'Salvar / Enviar')
        return
      }
    }
    const fixed = { enabled: fixedEnabled.checked, item: fixedEnabled.checked ? { type: fixedType.value, src: fixedSrc.value.trim(), duration: 8 } : null }
    const ac = new AbortController()
    const tm = setTimeout(() => ac.abort(), 8000)
    const nameInput = document.getElementById('pl-name')
    const name = (nameInput?.value || '').trim()
    const body = { items, fixed }
    if (name.length >= 3 && name.length <= 64) body.name = name
    const r = await fetch(`/api/playlists/${tvId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ac.signal })
    clearTimeout(tm)
    let j = null
    try { j = await r.json() } catch { j = { ok: r.ok } }
    if (!r.ok) {
      out.textContent = (j && j.error) || 'Falha ao salvar'
      out.style.color = '#c62828'
      saveBtn && saveBtn.classList.remove('loading')
      saveBtn && saveBtn.classList.add('error')
      saveBtn && (saveBtn.textContent = 'Erro')
      setTimeout(() => {
        if (!saveBtn) return
        saveBtn.classList.remove('error')
        saveBtn.disabled = false
        saveBtn.textContent = 'Salvar / Enviar'
      }, 1500)
      return
    }
    out.textContent = 'Playlist/Conteúdo fixo salvo e enviado.'
    out.style.color = '#2e7d32'
    saveBtn && saveBtn.classList.remove('loading')
    saveBtn && saveBtn.classList.add('success')
    saveBtn && (saveBtn.textContent = 'Salvo!')
    setTimeout(() => {
      if (!saveBtn) return
      saveBtn.classList.remove('success')
      saveBtn.disabled = false
      saveBtn.textContent = 'Salvar / Enviar'
    }, 1200)
  } catch (e) {
    out && (out.textContent = 'Tempo excedido ou erro ao salvar')
    out && (out.style.color = '#c62828')
    saveBtn && saveBtn.classList.remove('loading')
    saveBtn && saveBtn.classList.add('error')
    saveBtn && (saveBtn.textContent = 'Erro')
    setTimeout(() => {
      if (!saveBtn) return
      saveBtn.classList.remove('error')
      saveBtn.disabled = false
      saveBtn.textContent = 'Salvar / Enviar'
    }, 1500)
  }
}

;(function initPlaylist() {
  const itemsDiv = document.getElementById('pl-items')
  itemsDiv?.addEventListener('dragover', (e) => {
    e.preventDefault()
    const dragging = document.querySelector('.playlist-item.dragging')
    if (!dragging) return
    const after = getDragAfterElement(itemsDiv, e.clientY)
    if (after == null) itemsDiv.appendChild(dragging)
    else itemsDiv.insertBefore(dragging, after)
  })
  document.getElementById('btn-save')?.addEventListener('click', savePlaylist)
  const tvSelect = document.getElementById('pl-tv')
  tvSelect?.addEventListener('change', () => loadPlaylist(tvSelect.value))
  const tvMulti = document.getElementById('pl-tv-multi')
  const chips = document.getElementById('pl-tv-chips')
  const assignBtn = document.getElementById('btn-assign-tvs')
  tvMulti?.addEventListener('change', ()=>{
    if(!chips) return
    chips.innerHTML = ''
    ;[...tvMulti.selectedOptions].forEach(o=>{
      const chip = document.createElement('span')
      chip.className = 'chip'
      chip.innerHTML = `<span>${o.textContent}</span><button class="remove" title="Remover">×</button>`
      chip.querySelector('.remove').onclick = ()=>{ o.selected=false; chip.remove() }
      chips.appendChild(chip)
    })
  })
  assignBtn?.addEventListener('click', async ()=>{
    const tvIds = [...tvMulti.selectedOptions].map(o=>o.value)
    if(!tvIds.length){ alert('Selecione ao menos uma TV'); return }
    const out = document.getElementById('pl-status')
    const fixedEnabled = document.getElementById('fixed-enabled')
    const fixedSrc = document.getElementById('fixed-src')
    const fixedType = document.getElementById('fixed-type')
    let items = collectItems()
    const sVal = document.getElementById('pl-global-start')?.value
    const eVal = document.getElementById('pl-global-end')?.value
    if (sVal && eVal) {
      const sDate = new Date(sVal)
      const eDate = new Date(eVal)
      if (eDate > sDate) {
        const sISO = sDate.toISOString()
        const eISO = eDate.toISOString()
        items = items.map((it) => ({ ...it, start_at: sISO, end_at: eISO }))
      } else { out.textContent='Fim deve ser maior que início (global)'; out.style.color='#c62828'; return }
    }
    const fixed = { enabled: fixedEnabled.checked, item: fixedEnabled.checked ? { type: fixedType.value, src: fixedSrc.value.trim(), duration: 8 } : null }
    const name = (document.getElementById('pl-name')?.value || '').trim()
    const body = { items, fixed }
    if (name.length >= 3 && name.length <= 64) body.name = name
    let ok = 0
    for(const id of tvIds){ const r = await fetch(`/api/playlists/${id}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }); if(r.ok) ok++ }
    out.textContent = ok===tvIds.length ? 'Playlist atribuída às TVs selecionadas.' : 'Algumas TVs falharam na atribuição.'
    out.style.color = ok===tvIds.length ? '#2e7d32' : '#c62828'
  })
  buildTVSelect()
})()
