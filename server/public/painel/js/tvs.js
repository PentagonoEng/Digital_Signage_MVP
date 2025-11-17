// server/public/painel/js/tvs.js
export async function deleteTV(id) {
  if (!confirm('Remover esta TV?')) return
  const r = await fetch(`/api/tvs/${id}`, { method: 'DELETE' })
  if (!r.ok) {
    alert('Falha ao remover TV')
    return
  }
  await loadTVs()
}

export function msToHMS(ms) {
  const s = Math.floor(ms / 1000)
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const se = String(s % 60).padStart(2, '0')
  return `${h}:${m}:${se}`
}

export async function loadTVs() {
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
    tr.innerHTML = `<td>${t.name}</td><td>${t.location}${t.group ? ' • ' + t.group : ''}</td><td>${uptime}</td><td>${t.nowPlaying || '-'}</td><td class="small-prev">${prev}</td><td></td>`
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

;(async function initTVs() {
  await loadTVs()
})()