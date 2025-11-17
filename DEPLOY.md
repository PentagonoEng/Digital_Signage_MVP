
# DEPLOY (v2.5)

- Configure `.env` de produção.
- Monte volumes para `/server/data` e `/server/public/uploads`.
- Use `docker compose` para subir rapidez e isolamento.
- Exponha porta 3000 atrás de um reverse proxy (Nginx) com TLS.
