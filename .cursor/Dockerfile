# Cursor Cloud base image for HUDeck (L0–L2a toolchain).
# Do not COPY the project — Cursor checks out the workspace separately.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=C.UTF-8

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    unzip \
    zip \
    python3 \
    xvfb \
    libgtk-3-0 \
    libwebkit2gtk-4.1-0 \
    libnss3 \
    libxss1 \
    libasound2t64 \
    && rm -rf /var/lib/apt/lists/*

# Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*
