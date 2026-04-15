# Sistema de Prospección

CRM de prospección: Apify (scraping) → Claude (scoring + mensajes) → dashboard Kanban.

## Local
```
cp .env.example .env   # completar APIFY_TOKEN y ANTHROPIC_API_KEY
npm install
npm start              # http://localhost:3100
```

## Deploy en Easypanel (VPS Hostinger)
1. Push este repo a GitHub.
2. En Easypanel → **Create App → From GitHub** → seleccionar repo.
3. Build: **Dockerfile** (detectado auto).
4. Variables de entorno: `APIFY_TOKEN`, `ANTHROPIC_API_KEY`, `PORT=3100`.
5. **Volumen persistente** → mount `/app/data` (para SQLite).
6. Dominio → exponer puerto 3100.

## Flujo
1. **Nueva campaña** → Apify scrape → leads en DB.
2. **Calificar pendientes** → Claude asigna score 1-10 + mensaje sugerido; score < 4 = descartado.
3. **Abrir chat + copiar** → copia mensaje al portapapeles y abre el perfil en una pestaña nueva; pegás con Ctrl+V.
4. **Marcar enviado** → lead pasa a "Mensaje enviado" con timestamp.
5. Scheduler horario detecta leads sin respuesta, genera follow-ups y los mueve a "Follow-up pendiente".
