FROM eclipse-temurin:21-jre-jammy

WORKDIR /photon

# Instalar herramientas necesarias para descargar y descomprimir datos
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    bzip2 \
    pbzip2 \
    zstd \
    && rm -rf /var/lib/apt/lists/*

# Descargar el JAR de photon desde GitHub Releases
# curl -fsSL sigue redirects (necesario para el CDN de GitHub)
ARG PHOTON_JAR_VERSION=1.1.0
RUN curl -fsSL \
    "https://github.com/komoot/photon/releases/download/${PHOTON_JAR_VERSION}/photon-${PHOTON_JAR_VERSION}.jar" \
    -o photon.jar && \
    echo "Photon JAR ${PHOTON_JAR_VERSION} descargado."

# Copiar script de arranque
COPY start.sh .
RUN chmod +x start.sh

# Puerto por defecto de photon
EXPOSE 2322

CMD ["./start.sh"]
