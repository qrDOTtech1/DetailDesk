FROM node:20-slim

# MMTRADE V1 (Steven 04/08) : DetailDesk et le bot Polymarket partagent
# desormais le MEME service Railway (meme git, meme deploiement, meme DB) --
# decision explicite de l'utilisateur plutot que 2 services separes.
# Ce Dockerfile installe Node (Next.js) ET Python (bot) dans la meme image.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Next.js (DetailDesk) ─────────────────────────────────
# npm install PAS npm ci (Steven 04/08) : le lock file est regenere sous
# Windows (poste de dev), le build tourne sous Linux -- certains paquets
# optionnels (@emnapi/*, deps natives specifiques a la plateforme) different
# entre les deux, donc "ci" (qui exige une parite stricte lock<->platform)
# echoue systematiquement ici, meme lock file "a jour" cote Windows. "install"
# resout correctement pour la plateforme de build reelle, sans cette exigence
# impossible a tenir entre 2 OS differents. Deja arrive au moins 1 fois avant
# cette session (voir git log "Fix lock file drift again").
# COPY . . AVANT npm install (Steven 04/08) : le postinstall du package
# (prisma generate) a besoin de prisma/schema.prisma present sur le disque
# au moment ou npm install s'execute -- copier seulement package.json/
# package-lock.json d'abord (pattern classique pour le cache de layer) le
# fait echouer ici puisque le schema n'existe pas encore a cette etape.
# On perd un peu de cache Docker (tout changement invalide npm install),
# correction avant optimisation.
COPY . .
RUN npm install
RUN npm run build

# ── Bot Python (MMTRADE V1, ex-GHOST) ────────────────────
RUN python3 -m venv /opt/mmtrade-venv
ENV PATH="/opt/mmtrade-venv/bin:$PATH"
RUN pip install --no-cache-dir -r ghost-bot/requirements.txt h2

RUN mkdir -p /app/ghost-bot/data

ENV PYTHONUNBUFFERED=1
EXPOSE 3000

# Le bot tourne en arriere-plan (127.0.0.1:8787, jamais expose publiquement
# -- seul le port Next.js $PORT est route par Railway) ; Next.js reste le
# process PRINCIPAL au premier plan pour que Railway suive sa sante.
CMD ["sh", "start.sh"]
