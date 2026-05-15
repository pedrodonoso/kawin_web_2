#!/bin/bash
set -e

# ─── Configuración ────────────────────────────────────────────────────────────
PORT="${PORT:-2322}"
DATA_DIR="${DATA_DIR:-/photon/data}"
PHOTON_DUMP_VERSION="${PHOTON_DUMP_VERSION:-1.0}"
COUNTRY_CODE="${COUNTRY_CODE:-cl}"

# Memoria para el servidor en runtime (menor)
JAVA_OPTS="${JAVA_OPTS:--Xmx2G}"
# Memoria para el import (más exigente — subir si sigue muriendo)
IMPORT_JAVA_OPTS="${IMPORT_JAVA_OPTS:--Xmx4G}"

BASE="https://download1.graphhopper.com/public"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
SENTINEL="$DATA_DIR/.import_complete"

url_exists() { curl -fsSL -A "$UA" --head "$1" -o /dev/null 2>/dev/null; }
download()   { wget -q --show-progress --user-agent="$UA" -O "$1" "$2"; }

# ─── Preparación ──────────────────────────────────────────────────────────────
mkdir -p "$DATA_DIR"

if [ -f "$SENTINEL" ]; then
    echo "[photon] Import previo completado — omitiendo descarga."
else
    # Limpiar datos parciales de un import fallido anterior
    if [ -d "$DATA_DIR/photon_data" ]; then
        echo "[photon] Detectado photon_data sin sentinel — borrando import incompleto..."
        rm -rf "$DATA_DIR/photon_data"
    fi

    # DUMP_URL puede sobreescribirse directamente via variable de entorno
    # para evitar la detección automática y usar un dump más pequeño.
    # Ej: DUMP_URL=https://download1.graphhopper.com/public/south-america/chile/photon-dump-chile-1.0-latest.jsonl.zst
    if [ -z "$DUMP_URL" ]; then
        echo "[photon] Buscando dump para Chile (versión ${PHOTON_DUMP_VERSION})..."

        declare -a CANDIDATES=(
            "${BASE}/south-america/chile/photon-dump-chile-${PHOTON_DUMP_VERSION}-latest.jsonl.zst"
            "${BASE}/extracts/by-country-code/${COUNTRY_CODE}/photon-dump-${COUNTRY_CODE}-${PHOTON_DUMP_VERSION}-latest.jsonl.zst"
            "${BASE}/south-america/photon-dump-south-america-${PHOTON_DUMP_VERSION}-latest.jsonl.zst"
        )

        for url in "${CANDIDATES[@]}"; do
            echo "[photon] Verificando: $url"
            if url_exists "$url"; then
                DUMP_URL="$url"
                echo "[photon] ✓ Encontrado."
                break
            fi
        done
    else
        echo "[photon] Usando DUMP_URL forzada: $DUMP_URL"
    fi

    if [ -z "$DUMP_URL" ]; then
        echo "[photon] ERROR: No se encontró ningún dump. Verifica: ${BASE}/"
        exit 1
    fi

    echo "[photon] Descargando: $DUMP_URL"
    cd "$DATA_DIR"
    download photon-dump.jsonl.zst "$DUMP_URL"

    echo "[photon] Importando con ${IMPORT_JAVA_OPTS} (puede tardar 10-30 min)..."
    zstd --stdout -d photon-dump.jsonl.zst | \
        java $IMPORT_JAVA_OPTS -jar /photon/photon.jar \
            import \
            -import-file - \
            -country-codes "$COUNTRY_CODE" \
            -languages es,en \
            -data-dir "$DATA_DIR"

    rm -f photon-dump.jsonl.zst
    touch "$SENTINEL"
    echo "[photon] Import completado."
fi

# ─── Arrancar Photon ──────────────────────────────────────────────────────────
echo "[photon] Iniciando en puerto $PORT..."
exec java $JAVA_OPTS -jar /photon/photon.jar \
    serve \
    -port "$PORT" \
    -listen-ip 0.0.0.0 \
    -data-dir "$DATA_DIR"
