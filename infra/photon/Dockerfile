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
ARG PHOTON_VERSION=1.0.0
RUN wget -q \
    "https://github.com/komoot/photon/releases/download/${PHOTON_VERSION}/photon-${PHOTON_VERSION}.jar" \
    -O photon.jar && \
    echo "Photon ${PHOTON_VERSION} descargado."

# Copiar script de arranque
COPY start.sh .
RUN chmod +x start.sh

# Puerto por defecto de photon
EXPOSE 2322

CMD ["./start.sh"]
