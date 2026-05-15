#!/bin/bash
set -e

# ─── Configuración ────────────────────────────────────────────────────────────
# Railway inyecta PORT; photon lo necesita como argumento.
# Si no viene de Railway, usamos 2322 (puerto por defecto de photon).
PORT="${PORT:-2322}"

# Directorio donde se monta el volumen de Railway
DATA_DIR="${DATA_DIR:-/photon/data}"

# Versión de dump a usar (debe coincidir con la versión del JAR)
PHOTON_VERSION="${PHOTON_VERSION:-1.0}"

# Base URL del servidor de descargas de GraphHopper
BASE_URL="${DOWNLOAD_BASE_URL:-https://download1.graphhopper.com/public/south-america/chile}"

# Opciones de JVM (ajustar según el plan de Railway)
JAVA_OPTS="${JAVA_OPTS:--Xmx2G}"

# ─── Preparación ──────────────────────────────────────────────────────────────
mkdir -p "$DATA_DIR"

# Si ya existe la base de datos (volumen persistido), saltar la descarga
if [ -d "$DATA_DIR/photon_data" ]; then
    echo "[photon] Base de datos encontrada en $DATA_DIR/photon_data — omitiendo descarga."
else
    echo "[photon] No se encontró base de datos. Iniciando descarga de datos para Chile..."

    # 1. Intentar con DB dump (el más fácil: descomprimir y listo)
    DB_URL="${BASE_URL}/photon-db-cl-${PHOTON_VERSION}-latest.tar.bz2"
    echo "[photon] Verificando DB dump en: $DB_URL"

    if curl --output /dev/null --silent --head --fail "$DB_URL"; then
        echo "[photon] Descargando DB dump (~pocos GB, puede tardar varios minutos)..."
        cd "$DATA_DIR"
        wget -O - "$DB_URL" | pbzip2 -cd | tar x
        echo "[photon] DB dump extraído correctamente."

    else
        # 2. Fallback: JSON dump + importar con photon
        JSON_URL="${BASE_URL}/photon-dump-cl-${PHOTON_VERSION}-latest.jsonl.zst"
        echo "[photon] DB dump no disponible. Usando JSON dump: $JSON_URL"
        echo "[photon] Este proceso puede tardar entre 10 y 30 minutos..."

        cd "$DATA_DIR"
        wget -O photon-dump-cl.jsonl.zst "$JSON_URL"

        echo "[photon] Importando datos (esto puede tardar)..."
        zstd --stdout -d photon-dump-cl.jsonl.zst | \
            java $JAVA_OPTS -jar /photon/photon.jar \
                -nominatim-import -import-file -

        rm -f photon-dump-cl.jsonl.zst
        echo "[photon] Importación completada."
    fi
fi

# ─── Arrancar Photon ──────────────────────────────────────────────────────────
echo "[photon] Iniciando servidor en puerto $PORT..."
cd "$DATA_DIR"

exec java $JAVA_OPTS -jar /photon/photon.jar \
    -listen-port "$PORT"
