// server/public/painel/js/dashboard.js
import { deleteTV } from './tvs.js'

export async function updateKPIs() {
  const tvs = await (await fetch('/api/tvs')).json()
  document.getElementById('kpi-total').textContent = tvs.length
  const now = Date.now()
  const ativas = tvs.filter((t) => t.lastContact && now - t.lastContact < 60000).length
  document.getElementById('kpi-ativas').textContent = ativas
  document.getElementById('kpi-off').textContent = tvs.length - ativas
  try {
    const logs = await (await fetch('/api/logs?tail=200')).text()
    const pend = (logs.match(/PAIR_REQUEST/g) || []).length - (logs.match(/PAIR_APPROVED/g) || []).length
    document.getElementById('kpi-pend').textContent = Math.max(pend, 0)
  } catch {
    document.getElementById('kpi-pend').textContent = 0
  }
  const grid = document.getElementById('dash-tvs')
  if (!grid) return
  grid.innerHTML = ''
  tvs.forEach((t) => {
    const last = t.lastContact ? new Date(t.lastContact).toLocaleString() : '-'
    const card = document.createElement('div')
    card.className = 'tv-card'
    card.innerHTML = `<b>${t.name}</b><div class="muted">${t.location}${t.group ? ' • ' + t.group : ''}</div><div class="muted">Último contato: ${last}</div><div class="muted">Tocando: ${t.nowPlaying || '-'}</div>`
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

;(async function initDashboard() {
  await updateKPIs()
  setInterval(updateKPIs, 5000)
})()