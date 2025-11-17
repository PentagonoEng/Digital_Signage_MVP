// server/public/painel/js/uploads.js
export async function loadUploads() {
  const list = await (await fetch('/api/uploads')).json()
  const mediaGrid = document.getElementById('media-grid')
  if (!mediaGrid) return
  mediaGrid.innerHTML = ''
  list.slice().reverse().forEach((m) => {
    const el = document.createElement('div')
    el.className = 'thumb'
    el.innerHTML = `<span class="thumb-name">${m.name}</span><div class="thumb-actions"><button class="prev" title="Pré-visualizar">👁</button><button class="add" title="Adicionar à playlist">➕</button><button class="del action-danger" title="Remover do banco">🗑</button></div>`
    el.querySelector('.prev').onclick = () => {
      const v = document.getElementById('preview-video')
      const i = document.getElementById('preview-img')
      v.style.display = 'none'
      i.style.display = 'none'
      const isImg = /\.(png|jpe?g|gif|webp)$/i.test(m.name)
      if (isImg) { i.src = m.url; i.style.display = 'block' } else { v.src = m.url; v.style.display = 'block'; v.play() }
      const status = document.getElementById('prev-status')
      if (status) status.textContent = isImg ? 'Visualizando imagem' : 'Visualizando vídeo'
    }
    el.querySelector('.del').onclick = async () => {
      if (!confirm('Remover este arquivo?')) return
      await fetch(`/api/uploads/${encodeURIComponent(m.name)}`, { method: 'DELETE' })
      await loadUploads()
    }
    el.querySelector('.add').onclick = () => {
      const itemsDiv = document.getElementById('pl-items')
      if (!itemsDiv) return
      const isImg = /\.(png|jpe?g|gif|webp)$/i.test(m.name)
      const row = document.createElement('div')
      row.className = 'playlist-item'
      row.draggable = true
      row.innerHTML = `
        <div class="row">
          <div><label>Tipo</label>
            <select class="i-type">
              <option value="image" ${isImg ? 'selected' : ''}>Imagem</option>
              <option value="video" ${!isImg ? 'selected' : ''}>Vídeo</option>
            </select>
          </div>
          <div><label>Ativo</label><input type="checkbox" class="i-enabled" checked /></div>
          <div style="grid-column:1/3"><label>Fonte (URL público)</label><input class="i-src" value="${m.url}" placeholder="/uploads/arquivo.mp4"/></div>
          <div><label>Duração (s) — imagens</label><input type="number" class="i-duration" min="1" value="${isImg ? 8 : ''}"/></div>
          <div><label>Start (ISO opcional)</label><input class="i-start" placeholder=""/></div>
          <div><label>End (ISO opcional)</label><input class="i-end" placeholder=""/></div>
          <div style="grid-column:1/3;display:flex;gap:8px"><button class="btn-del action-danger">Remover</button></div>
        </div>`
      row.querySelector('.btn-del').onclick = () => row.remove()
      itemsDiv.appendChild(row)
    }
    mediaGrid.appendChild(el)
  })
}

;(function initUploads() {
  const btnUpload = document.getElementById('btn-upload')
  const fileInput = document.getElementById('file-input')
  btnUpload?.addEventListener('click', async () => {
    const files = fileInput.files
    if (!files || !files.length) return
    for (const f of files) {
      const fd = new FormData()
      fd.append('file', f)
      await fetch('/api/upload', { method: 'POST', body: fd })
    }
    await loadUploads()
  })
  loadUploads()
})()