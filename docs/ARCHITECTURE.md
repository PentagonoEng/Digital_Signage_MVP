
# Arquitetura (v2.5) — Digital Signage Panel

**Data:** 2025-11-04 13:37

## Visão Geral
- **Frontend Painel**: `/server/public/painel` — SPA simples em HTML/CSS/JS.
- **Player (Display)**: `/server/public/display` — toca imagens/vídeos, faz crossfade de dupla camada.
- **Backend (Node/Express)**: `/server/server.js` — APIs de TVs, playlists, uploads, comandos e logs.
- **Persistência**: arquivos JSON em `/server/data` (tvs.json, playlists.json, codes.json, commands.json, logs.log).

## Fluxo Alto Nível
Painel → API (salva playlist) → Player (consulta playlist e toca) → Heartbeat → Painel (monitoramento).

## Decisões de Projeto
- **Crossfade em dupla camada** para evitar tela preta (camada A/B).
- **Regra de uniformização de duração** (imagens) e **modo conteúdo fixo** quando houver uma única imagem.
- **Comandos remotos** (reload) via polling simples.
- Preparado para **Docker** e **lock de versões** (.nvmrc, ENV.example).

