// server/server.js
// v2.5 — Backend Express com comentários pedagógicos linha a linha nas seções críticas.
// Objetivo: servir painel, player, API de playlists/TVs, upload de mídia e comandos remotos.
// Mantém recursos: crossfade (no front), restart remoto, uptime, preview.

import express from 'express'
import cors from 'cors'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { nanoid } from 'nanoid'
import dotenv from 'dotenv'

// Carrega variáveis de ambiente do arquivo .env (se existir)
dotenv.config()

// Resolve __dirname no contexto ES Modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Instancia o app Express e define a porta (padrão 3000)
const app = express()
const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '0.0.0.0'

// Pastas do projeto
const DATA_DIR = path.join(__dirname, 'data')
const PUBLIC_DIR = path.join(__dirname, 'public')
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads')

// Garante que as pastas existem
for (const d of [DATA_DIR, PUBLIC_DIR, UPLOADS_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
}

// Helpers de leitura/gravação de JSON "pequenos" (persistência baseada em arquivos)
function readJSON(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'))
  } catch {
    return fallback
  }
}
function writeJSON(file, obj) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(obj, null, 2), 'utf-8')
}
function logLine(line) {
  fs.appendFileSync(path.join(DATA_DIR, 'logs.log'), `[${new Date().toISOString()}] ${line}
`, 'utf-8')
}

// Middlewares básicos
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Servir arquivos estáticos (painel, player, uploads)
app.use('/uploads', express.static(UPLOADS_DIR, { setHeaders: (res) => res.set('Cache-Control', 'no-store') }))
app.use('/', express.static(PUBLIC_DIR))

// Configura upload com multer (salva diretamente em /public/uploads)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}_` + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')),
})
const upload = multer({ storage })

// -------------------- Codes (pareamento) --------------------
app.post('/api/pair/request', (req, res) => {
  const { tvId: bodyTvId } = req.body || {}
  const tvs = readJSON('tvs.json', { tvs: [] })
  const codes = readJSON('codes.json', { pending: {} })
  let tvId = bodyTvId || nanoid(8)
  const gen = () => {
    const n = Math.floor(100000 + Math.random() * 900000).toString()
    return n.slice(0, 3) + '-' + n.slice(3)
  }
  let used = new Set([
    ...Object.values(codes.pending).map((p) => p.code),
    ...tvs.tvs.map((t) => t.lastCode).filter(Boolean),
  ])
  let code = gen()
  while (used.has(code)) code = gen()
  codes.pending[tvId] = { code, createdAt: Date.now() }
  writeJSON('codes.json', codes)
  logLine(`PAIR_REQUEST tv=${tvId} code=${code}`)
  res.json({ tvId, code, expiresAt: Date.now() + 10 * 60 * 1000 })
})

app.get('/api/pair/status', (req, res) => {
  const tvId = req.query.tvId
  if (!tvId) return res.status(400).json({ error: 'tvId obrigatório' })
  const tvs = readJSON('tvs.json', { tvs: [] })
  const codes = readJSON('codes.json', { pending: {} })
  const tv = tvs.tvs.find((t) => t.id === tvId)
  if (tv) return res.json({ approved: true })
  const p = codes.pending[tvId]
  if (!p) return res.json({ approved: false })
  if (Date.now() - p.createdAt > 10 * 60 * 1000) {
    delete codes.pending[tvId]
    writeJSON('codes.json', codes)
    logLine(`CODE_EXPIRED tv=${tvId} code=${p.code}`)
    return res.json({ approved: false, expired: true })
  }
  res.json({ approved: false, code: p.code, expiresAt: p.createdAt + 10 * 60 * 1000 })
})

// -------------------- TVs --------------------
app.post('/api/tvs/approve', (req, res) => {
  const { tvId: bodyTvId, code: bodyCode, name, location } = req.body
  if (!name || !location) return res.status(400).json({ error: 'Payload inválido' })
  const codes = readJSON('codes.json', { pending: {} })
  const tvs = readJSON('tvs.json', { tvs: [] })
  let tvId = bodyTvId
  if (!tvId && bodyCode) {
    tvId = Object.keys(codes.pending).find((id) => codes.pending[id]?.code === bodyCode)
  }
  if (!tvId) return res.status(400).json({ error: 'Código inválido' })
  const p = codes.pending[tvId]
  if (!p) return res.status(400).json({ error: 'Código expirado' })
  if (Date.now() - p.createdAt > 10 * 60 * 1000) {
    delete codes.pending[tvId]
    writeJSON('codes.json', codes)
    logLine(`CODE_EXPIRED tv=${tvId} code=${p.code}`)
    return res.status(400).json({ error: 'Código expirado' })
  }
  const exists = tvs.tvs.find((t) => t.id === tvId)
  if (!exists) {
    tvs.tvs.push({ id: tvId, name, location, createdAt: Date.now(), lastContact: null, nowPlaying: null, lastCode: p.code, onlineSince: null })
  } else {
    exists.name = name
    exists.location = location
    exists.lastCode = p.code
  }
  writeJSON('tvs.json', tvs)
  delete codes.pending[tvId]
  writeJSON('codes.json', codes)
  const pls = readJSON('playlists.json', { playlists: {} })
  if (!pls.playlists[tvId]) pls.playlists[tvId] = { items: [], fixed: { enabled: false, item: null }, updatedAt: Date.now() }
  writeJSON('playlists.json', pls)
  logLine(`PAIR_APPROVED tv=${tvId} name="${name}" location="${location}" code=${p.code}`)
  res.json({ ok: true, tvId })
})

app.get('/api/tvs', (req, res) => res.json(readJSON('tvs.json', { tvs: [] }).tvs))
app.get('/api/tvs/:id/status', (req, res) => {
  const tvs = readJSON('tvs.json', { tvs: [] })
  const exists = !!tvs.tvs.find((t) => t.id === req.params.id)
  res.json({ exists })
})
app.get('/api/pending', (req, res) => {
  const codes = readJSON('codes.json', { pending: {} })
  const list = Object.entries(codes.pending).map(([tvId, p]) => ({ tvId, code: p.code, expiresAt: p.createdAt + 10 * 60 * 1000 })).filter((i) => i.expiresAt > Date.now())
  res.json(list)
})

app.post('/api/pair/approve', (req, res) => {
  const { tvId, name, location, group } = req.body
  if (!tvId || !name || !location) return res.status(400).json({ error: 'Payload inválido' })
  const codes = readJSON('codes.json', { pending: {} })
  const p = codes.pending[tvId]
  if (!p) return res.status(400).json({ error: 'Código expirado' })
  if (Date.now() - p.createdAt > 10 * 60 * 1000) {
    delete codes.pending[tvId]
    writeJSON('codes.json', codes)
    logLine(`CODE_EXPIRED tv=${tvId} code=${p.code}`)
    return res.status(400).json({ error: 'Código expirado' })
  }
  const tvs = readJSON('tvs.json', { tvs: [] })
  let tv = tvs.tvs.find((t) => t.id === tvId)
  if (!tv) {
    tv = { id: tvId, name, location, group: group || null, createdAt: Date.now(), lastContact: null, nowPlaying: null, lastCode: p.code, onlineSince: null }
    tvs.tvs.push(tv)
  } else {
    tv.name = name
    tv.location = location
    tv.group = group || null
    tv.lastCode = p.code
  }
  writeJSON('tvs.json', tvs)
  delete codes.pending[tvId]
  writeJSON('codes.json', codes)
  const pls = readJSON('playlists.json', { playlists: {} })
  if (!pls.playlists[tvId]) pls.playlists[tvId] = { items: [], fixed: { enabled: false, item: null }, updatedAt: Date.now() }
  writeJSON('playlists.json', pls)
  logLine(`PAIR_APPROVED tv=${tvId} name="${name}" location="${location}" group="${group || '-'}" code=${p.code}`)
  res.json({ ok: true, tvId })
})

app.post('/api/tvs/:id/heartbeat', (req, res) => {
  const { id } = req.params
  const { nowPlaying } = req.body || {}
  const tvs = readJSON('tvs.json', { tvs: [] })
  const tv = tvs.tvs.find((t) => t.id === id)
  if (!tv) return res.status(404).json({ error: 'TV não encontrada' })
  const now = Date.now()
  if (!tv.lastContact || now - tv.lastContact > 120000) tv.onlineSince = now
  tv.lastContact = now
  tv.nowPlaying = nowPlaying || tv.nowPlaying || null
  writeJSON('tvs.json', tvs)
  logLine(`HEARTBEAT tv=${id} nowPlaying=${nowPlaying || '-'}`)
  res.json({ ok: true })
})

app.delete('/api/tvs/:id', (req, res) => {
  const { id } = req.params
  const tvs = readJSON('tvs.json', { tvs: [] })
  const idx = tvs.tvs.findIndex((t) => t.id === id)
  if (idx < 0) return res.status(404).json({ error: 'TV não encontrada' })
  const [removed] = tvs.tvs.splice(idx, 1)
  writeJSON('tvs.json', tvs)
  const pls = readJSON('playlists.json', { playlists: {} })
  delete pls.playlists[id]
  writeJSON('playlists.json', pls)
  logLine(`TV_REMOVED id=${id} name="${removed.name}"`)
  res.json({ ok: true })
})

// -------------------- Playlists --------------------
function normalizeItems(items) {
  const enforce = String(process.env.ENFORCE_UNIFORM_DURATION || 'true') === 'true'
  const defDur = parseInt(process.env.UNIFORM_DURATION_SECONDS || '8', 10)
  const allowed = new Set(['image', 'video'])
  const filtered = items.filter((it) => it && allowed.has(it.type) && typeof it.src === 'string' && it.src.trim().length > 0)
  return filtered.map((it) => ({
    ...it,
    enabled: it.enabled !== false,
    duration: it.type === 'image' ? (enforce ? defDur : (it.duration || defDur)) : it.duration,
  }))
}

app.get('/api/playlists/:tvId', (req, res) => {
  res.set('Cache-Control', 'no-store')
  const tvId = req.params.tvId
  const assigns = readJSON('playlist_assignments.json', { assignments: {} })
  const lib = readJSON('playlist_lib.json', { playlists: {} })
  const assigned = assigns.assignments[tvId]
  if (assigned && lib.playlists[assigned]) {
    const pl = lib.playlists[assigned]
    return res.json({ items: pl.items || [], fixed: pl.fixed || { enabled: false, item: null }, updatedAt: pl.updatedAt || 0, name: pl.name || null, playlistId: assigned })
  }
  const pls = readJSON('playlists.json', { playlists: {} })
  const p = pls.playlists[tvId]
  if (p) return res.json({ items: p.items || [], fixed: p.fixed || { enabled: false, item: null }, updatedAt: p.updatedAt || 0, name: p.name || null })
  res.json({ items: [], fixed: { enabled: false, item: null }, updatedAt: 0 })
})

app.get('/api/playlists/:tvId/updatedAt', (req, res) => {
  const assigns = readJSON('playlist_assignments.json', { assignments: {} })
  const lib = readJSON('playlist_lib.json', { playlists: {} })
  const id = assigns.assignments[req.params.tvId]
  if (id && lib.playlists[id]) return res.json({ updatedAt: lib.playlists[id].updatedAt || 0 })
  const pls = readJSON('playlists.json', { playlists: {} })
  const p = pls.playlists[req.params.tvId]
  res.json({ updatedAt: p ? p.updatedAt || 0 : 0 })
})

app.get('/api/playlist-lib', (req, res) => {
  const lib = readJSON('playlist_lib.json', { playlists: {} })
  const list = Object.entries(lib.playlists).map(([id, p]) => ({ id, name: p.name || 'Sem nome', updatedAt: p.updatedAt || 0 }))
  res.json(list)
})
app.post('/api/playlist-lib', (req, res) => {
  const { name } = req.body || {}
  const id = nanoid(8)
  const lib = readJSON('playlist_lib.json', { playlists: {} })
  lib.playlists[id] = { name: name || 'Nova Playlist', items: [], fixed: { enabled: false, item: null }, updatedAt: Date.now() }
  writeJSON('playlist_lib.json', lib)
  logLine(`PLAYLIST_LIB_CREATED id=${id} name="${lib.playlists[id].name}"`)
  res.json({ ok: true, id })
})
app.get('/api/playlist-lib/:id', (req, res) => {
  const lib = readJSON('playlist_lib.json', { playlists: {} })
  const p = lib.playlists[req.params.id]
  res.json(p || { name: null, items: [], fixed: { enabled: false, item: null }, updatedAt: 0 })
})
app.put('/api/playlist-lib/:id', (req, res) => {
  const { name, items, fixed } = req.body || {}
  const lib = readJSON('playlist_lib.json', { playlists: {} })
  const cur = lib.playlists[req.params.id] || { name: 'Playlist', items: [], fixed: { enabled: false, item: null }, updatedAt: 0 }
  lib.playlists[req.params.id] = { name: name ?? cur.name, items: Array.isArray(items) ? items : cur.items, fixed: fixed ?? cur.fixed, updatedAt: Date.now() }
  writeJSON('playlist_lib.json', lib)
  logLine(`PLAYLIST_LIB_SAVED id=${req.params.id} items=${lib.playlists[req.params.id].items.length}`)
  res.json({ ok: true })
})
app.delete('/api/playlist-lib/:id', (req, res) => {
  const lib = readJSON('playlist_lib.json', { playlists: {} })
  delete lib.playlists[req.params.id]
  writeJSON('playlist_lib.json', lib)
  logLine(`PLAYLIST_LIB_REMOVED id=${req.params.id}`)
  res.json({ ok: true })
})

app.get('/api/playlist-assignments', (req, res) => {
  const a = readJSON('playlist_assignments.json', { assignments: {} })
  res.json(a)
})
app.post('/api/playlist-assignments', (req, res) => {
  const { tvIds, playlistId } = req.body || {}
  if (!Array.isArray(tvIds) || !playlistId) return res.status(400).json({ error: 'Payload inválido' })
  const a = readJSON('playlist_assignments.json', { assignments: {} })
  for (const tv of tvIds) a.assignments[tv] = playlistId
  writeJSON('playlist_assignments.json', a)
  logLine(`PLAYLIST_ASSIGNED id=${playlistId} tvs=${tvIds.length}`)
  res.json({ ok: true })
})

app.post('/api/playlists/:tvId', (req, res) => {
  const { items, fixed, name } = req.body
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Payload inválido: items[] obrigatório' })
  const pls = readJSON('playlists.json', { playlists: {} })
  let newItems = normalizeItems(items)
  // Validação de janelas por item
  newItems = newItems.filter((it) => {
    const s = it.start_at ? Date.parse(it.start_at) : null
    const e = it.end_at ? Date.parse(it.end_at) : null
    if (s && e && e < s) return false
    return true
  })

  // Regra: se houver apenas UMA imagem e SINGLE_IMAGE_AS_FIXED=true, publica como conteúdo fixo.
  const singleAsFixed = String(process.env.SINGLE_IMAGE_AS_FIXED || 'true') === 'true'
  let next = { items: newItems, fixed: fixed || { enabled: false, item: null }, updatedAt: Date.now() }
  const images = newItems.filter((i) => i.type === 'image')
  if (singleAsFixed && newItems.length === 1 && images.length === 1) {
    next = { items: [], fixed: { enabled: true, item: { type: 'image', src: images[0].src, duration: images[0].duration || 8 } }, updatedAt: Date.now() }
  }
  if (typeof name === 'string') {
    const s = name.trim()
    if (s.length >= 3 && s.length <= 64) next.name = s
  }

  pls.playlists[req.params.tvId] = next
  writeJSON('playlists.json', pls)
  logLine(`PLAYLIST_SAVED tv=${req.params.tvId} items=${next.items.length} fixed=${next.fixed && next.fixed.enabled ? 'on' : 'off'}`)
  res.json({ ok: true })
})

// -------------------- Uploads --------------------
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo recebido' })
  const url = `/uploads/${req.file.filename}`
  logLine(`UPLOAD filename=${req.file.originalname} -> ${url}`)
  res.json({ url, filename: req.file.filename })
})

app.get('/api/uploads', (req, res) => {
  const files = fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR).filter((n) => !n.startsWith('.')) : []
  const list = files.map((n) => ({ name: n, url: `/uploads/${n}` }))
  res.json(list)
})

app.delete('/api/uploads/:name', (req, res) => {
  const name = req.params.name
  const p = path.join(UPLOADS_DIR, name)
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'Arquivo não encontrado' })
  fs.unlinkSync(p)
  logLine(`UPLOAD_REMOVED name=${name}`)
  res.json({ ok: true })
})

// -------------------- Commands (controle remoto) --------------------
app.post('/api/commands/:tvId', (req, res) => {
  const { tvId } = req.params
  const { reload } = req.body || {}
  const cmds = readJSON('commands.json', { cmd: {} })
  if (!cmds.cmd[tvId]) cmds.cmd[tvId] = {}
  if (typeof reload === 'boolean') cmds.cmd[tvId].reload = reload
  writeJSON('commands.json', cmds)
  logLine(`CMD_SET tv=${tvId} reload=${reload}`)
  res.json({ ok: true })
})

app.get('/api/commands/:tvId', (req, res) => {
  const { tvId } = req.params
  const cmds = readJSON('commands.json', { cmd: {} })
  const c = cmds.cmd[tvId] || {}
  if (c.reload) {
    cmds.cmd[tvId].reload = false // one-shot
    writeJSON('commands.json', cmds)
  }
  res.json(c)
})

// -------------------- Logs --------------------
app.get('/api/logs', (req, res) => {
  const tail = parseInt(req.query.tail || '500', 10)
  const p = path.join(DATA_DIR, 'logs.log')
  if (!fs.existsSync(p)) return res.type('text/plain').send('')
  const lines = fs.readFileSync(p, 'utf-8').trim().split('\n').slice(-tail).join('\n')
  res.type('text/plain').send(lines)
})

// Tarefas de limpeza: expira códigos de pareamento
setInterval(() => {
  const codes = readJSON('codes.json', { pending: {} })
  let changed = false
  for (const [c, i] of Object.entries(codes.pending)) {
    if (Date.now() - i.createdAt > 10 * 60 * 1000) {
      delete codes.pending[c]
      logLine(`CODE_EXPIRED_CLEANUP code=${c}`)
      changed = true
    }
  }
  if (changed) writeJSON('codes.json', codes)
}, 60000)

// Start
app.listen(PORT, HOST, () => {
  console.log(`Servidor em http://${HOST}:${PORT}`)
  logLine(`SERVER_START port=${PORT}`)
})
