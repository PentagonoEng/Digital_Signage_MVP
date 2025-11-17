// server/public/painel/js/pairing.js
import { buildTVSelect } from './playlist.js'
import { updateKPIs } from './dashboard.js'
import { loadTVs } from './tvs.js'

const approveBtn = document.getElementById('btn-approve')
const pairSelect = document.getElementById('pair-select')

async function refreshPending() {
  const pendingBox = document.getElementById('pair-pending')
  const list = await (await fetch('/api/pending')).json()
  pairSelect.innerHTML = `<option value="">Selecione...</option>` + list.map((i) => `<option value="${i.tvId}">${i.code} — ${i.tvId}</option>`).join('')
  pendingBox.innerHTML = list.map((i) => `<div class="pending-row"><b>${i.code}</b> <span class="muted">TV ${i.tvId}</span> <span class="muted">expira ${(new Date(i.expiresAt)).toLocaleTimeString()}</span></div>`).join('')
}

approveBtn?.addEventListener('click', async () => {
  const sel = pairSelect?.value
  const name = document.getElementById('pair-name').value.trim()
  const location = document.getElementById('pair-location').value.trim()
  const group = document.getElementById('pair-group').value.trim()
  const out = document.getElementById('pair-result')
  out.textContent = ''
  if (!sel || !name || !location) {
    out.textContent = 'Selecione uma pendência e preencha nome/local.'
    out.style.color = '#e98b16'
    return
  }
  const r = await fetch('/api/pair/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tvId: sel, name, location, group }),
  })
  const j = await r.json()
  if (!r.ok) {
    out.textContent = j.error || 'Falha ao aprovar'
    out.style.color = '#c62828'
    return
  }
  out.textContent = `Aprovado! TV ID: ${j.tvId}`
  out.style.color = '#2e7d32'
  await buildTVSelect()
  await updateKPIs()
  await loadTVs()
  await refreshPending()
})

;(async function initPairing() {
  await refreshPending()
  setInterval(refreshPending, 3000)
})()