#!/bin/bash
set -e

# ─── Configuración ────────────────────────────────────────────────────────────
PORT="${PORT:-2322}"
DATA_DIR="${DATA_DIR:-/photon/data}"
PHOTON_DUMP_VERSION="${PHOTON_DUMP_VERSION:-1.0}"   # versión del DUMP de datos (major.minor)
JAVA_OPTS="${JAVA_OPTS:--Xmx2G}"
COUNTRY_CODE="${COUNTRY_CODE:-cl}"        # código ISO para filtrar al importar

BASE="https://download1.graphhopper.com/public"

# wget/curl con User-Agent de navegador (el servidor bloquea UAs por defecto)
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"

url_exists() { curl -fsSL -A "$UA" --head "$1" -o /dev/null 2>/dev/null; }
download()   { wget -q --user-agent="$UA" -O "$1" "$2"; }

# ─── Preparación ──────────────────────────────────────────────────────────────
mkdir -p "$DATA_DIR"

if [ -d "$DATA_DIR/photon_data" ]; then
    echo "[photon] Base de datos encontrada — omitiendo descarga."
else
    echo "[photon] Buscando datos para Chile (versión ${PHOTON_DUMP_VERSION})..."

    # Candidatos en orden de preferencia (de más pequeño a más grande)
    declare -a CANDIDATES=(
        # 1. Extract específico de Chile (si existe)
        "${BASE}/south-america/chile/photon-dump-chile-${PHOTON_DUMP_VERSION}-latest.jsonl.zst"
        # 2. Ruta antigua (puede seguir activa)
        "${BASE}/extracts/by-country-code/${COUNTRY_CODE}/photon-dump-${COUNTRY_CODE}-${PHOTON_DUMP_VERSION}-latest.jsonl.zst"
        # 3. Dump de todo Sudamérica (más grande, ~1-2 GB, se filtra por país al importar)
        "${BASE}/south-america/photon-dump-south-america-${PHOTON_DUMP_VERSION}-latest.jsonl.zst"
    )

    DUMP_URL=""
    for url in "${CANDIDATES[@]}"; do
        echo "[photon] Verificando: $url"
        if url_exists "$url"; then
            DUMP_URL="$url"
            echo "[photon] ✓ Encontrado."
            break
        fi
    done

    if [ -z "$DUMP_URL" ]; then
        echo "[photon] ERROR: No se encontró ningún dump para Chile con versión ${PHOTON_DUMP_VERSION}."
        echo "[photon] Verifica las URLs disponibles en: ${BASE}/"
        exit 1
    fi

    echo "[photon] Descargando: $DUMP_URL"
    echo "[photon] (Puede tardar 10-30 min en el primer arranque)"
    cd "$DATA_DIR"
    download photon-dump.jsonl.zst "$DUMP_URL"

    echo "[photon] Importando datos (country_code=${COUNTRY_CODE})..."
    zstd --stdout -d photon-dump.jsonl.zst | \
        java $JAVA_OPTS -jar /photon/photon.jar \
            -nominatim-import -import-file - \
            -country-codes "$COUNTRY_CODE" \
            -data-dir "$DATA_DIR"

    rm -f photon-dump.jsonl.zst
    echo "[photon] Importación completada."
fi

# ─── Arrancar Photon ──────────────────────────────────────────────────────────
echo "[photon] Iniciando en puerto $PORT..."
exec java $JAVA_OPTS -jar /photon/photon.jar \
    -listen-port "$PORT" \
    -data-dir "$DATA_DIR"
