#!/bin/bash
# =================================================
# Script de Déploiement OVH VPS - Blockchain Project
# =================================================
# Usage: chmod +x deploy.sh && ./deploy.sh
#
# Ce script installe et configure tout automatiquement:
# - Node.js 20
# - Nginx
# - PM2
# - Tous les services du projet

set -e  # Arrêter en cas d'erreur

echo "=========================================="
echo "  DÉPLOIEMENT BLOCKCHAIN PROJECT"
echo "=========================================="

# Couleurs pour le terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables
PROJECT_DIR=$(pwd)
DOMAIN=${DOMAIN:-""}

# Vérifier qu'on est root ou sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Erreur: Exécutez ce script avec sudo${NC}"
    echo "Usage: sudo ./deploy.sh"
    exit 1
fi

# ===========================================
# 1. MISE À JOUR SYSTÈME
# ===========================================
echo -e "\n${YELLOW}[1/7] Mise à jour du système...${NC}"
apt update && apt upgrade -y

# ===========================================
# 2. INSTALLATION NODE.JS 20
# ===========================================
echo -e "\n${YELLOW}[2/7] Installation de Node.js 20...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# ===========================================
# 3. INSTALLATION PM2
# ===========================================
echo -e "\n${YELLOW}[3/7] Installation de PM2...${NC}"
npm install -g pm2
pm2 startup systemd -u $SUDO_USER --hp /home/$SUDO_USER

# ===========================================
# 4. INSTALLATION NGINX
# ===========================================
echo -e "\n${YELLOW}[4/7] Installation de Nginx...${NC}"
apt install -y nginx

# ===========================================
# 5. INSTALLATION DES DÉPENDANCES
# ===========================================
echo -e "\n${YELLOW}[5/7] Installation des dépendances du projet...${NC}"

# Créer le dossier logs
mkdir -p logs

# Contracts
echo "  → Installation contracts..."
cd "$PROJECT_DIR/contracts"
npm install

# Indexer
echo "  → Installation indexer..."
cd "$PROJECT_DIR/indexer"
npm install
npm run build

# Frontend
echo "  → Installation frontend..."
cd "$PROJECT_DIR/frontend"
npm install
npm run build

cd "$PROJECT_DIR"

# ===========================================
# 6. CONFIGURATION NGINX
# ===========================================
echo -e "\n${YELLOW}[6/7] Configuration de Nginx...${NC}"

# Copier la config
cp deployment/nginx.conf /etc/nginx/sites-available/blockchain

# Remplacer le domaine si spécifié
if [ -n "$DOMAIN" ]; then
    sed -i "s/votre-domaine.com/$DOMAIN/g" /etc/nginx/sites-available/blockchain
fi

# Activer le site
ln -sf /etc/nginx/sites-available/blockchain /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Tester et recharger Nginx
nginx -t
systemctl reload nginx

# ===========================================
# 7. LANCEMENT DES SERVICES
# ===========================================
echo -e "\n${YELLOW}[7/7] Démarrage des services...${NC}"

# Copier .env si nécessaire
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${YELLOW}⚠ Fichier .env créé. Pensez à le configurer!${NC}"
fi

# Démarrer avec PM2
pm2 start ecosystem.config.js
pm2 save

# Attendre que Hardhat démarre
echo "Attente du démarrage de Hardhat..."
sleep 10

# Déployer les contrats
echo "Déploiement des smart contracts..."
cd "$PROJECT_DIR/contracts"
npx hardhat run scripts/deploy.ts --network localhost || true

cd "$PROJECT_DIR"

# ===========================================
# RÉSUMÉ
# ===========================================
echo -e "\n${GREEN}=========================================="
echo "  ✅ DÉPLOIEMENT TERMINÉ!"
echo "==========================================${NC}"
echo ""
echo "Services lancés:"
pm2 status
echo ""
echo "Accès:"
if [ -n "$DOMAIN" ]; then
    echo "  → Site: http://$DOMAIN"
else
    echo "  → Site: http://$(curl -s ifconfig.me)"
fi
echo "  → Frontend: http://localhost:3000"
echo "  → Indexer:  http://localhost:3001"
echo "  → Hardhat:  http://localhost:8545"
echo ""
echo "Commandes utiles:"
echo "  pm2 status      - Voir l'état des services"
echo "  pm2 logs        - Voir les logs"
echo "  pm2 restart all - Redémarrer tous les services"
echo ""

# SSL (optionnel)
if [ -n "$DOMAIN" ]; then
    echo -e "${YELLOW}Pour activer HTTPS:${NC}"
    echo "  apt install certbot python3-certbot-nginx"
    echo "  certbot --nginx -d $DOMAIN"
fi
