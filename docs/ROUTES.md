
# Rotas (v2.5)

## Backend (REST)
- `POST /api/codes/request` — solicita código de pareamento.
- `GET /api/codes/:code/status` — status do pareamento.
- `POST /api/tvs/approve` — aprova TV.
- `GET /api/tvs` — lista TVs.
- `POST /api/tvs/:id/heartbeat` — heartbeat com nowPlaying.
- `DELETE /api/tvs/:id` — remove TV.
- `GET /api/playlists/:tvId` — obtém playlist/fixed.
- `GET /api/playlists/:tvId/updatedAt` — obtém timestamp de atualização.
- `POST /api/playlists/:tvId` — salva playlist/fixed (normaliza durações; converte single-image em fixed se ativado).
- `POST /api/upload` — upload de mídia.
- `GET /api/uploads` — lista mídias enviadas.
- `DELETE /api/uploads/:name` — remove mídia.
- `POST /api/commands/:tvId` — define comando (ex.: reload=true).
- `GET /api/commands/:tvId` — lê comandos (one-shot reload).
- `GET /api/logs` — tail de logs.

## Frontend
- `/painel/index.html` — SPA do painel.
- `/display/index.html` — player (página da TV).
