#!/bin/bash
set -e  # Arrêter en cas d'erreur

echo "=========================================="
echo "  DEPLOYMENT BLOCKCHAIN PROJECT"
echo "  Environment: PRODUCTION (Sepolia)"
echo "=========================================="

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Vérifier qu'on est dans le bon dossier
if [ ! -f "package.json" ] && [ ! -d "contracts" ]; then
    echo -e "${RED}Erreur: Exécutez ce script depuis la racine du projet${NC}"
    exit 1
fi

# 1. Vérifier les dépendances
echo -e "\n${YELLOW}[1/6] Vérification des dépendances...${NC}"
cd contracts && npm install
cd ../indexer && npm install && npm run build
cd ../frontend && npm install
cd ..

# 2. Vérifier le solde Sepolia
echo -e "\n${YELLOW}[2/6] Vérification du wallet Sepolia...${NC}"
echo "Private Key: ${PRIVATE_KEY:0:10}..."
echo "⚠️  Assurez-vous d'avoir du Sepolia ETH sur ce wallet"
echo "    Faucet: https://sepoliafaucet.com/"
read -p "Continuer ? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# 3. Déployer les contrats sur Sepolia
echo -e "\n${YELLOW}[3/6] Déploiement des contrats sur Sepolia...${NC}"
cd contracts
npx hardhat run scripts/deploy.ts --network sepolia

if [ $? -ne 0 ]; then
    echo -e "${RED}Erreur lors du déploiement${NC}"
    exit 1
fi

# 4. Vérifier la config générée
echo -e "\n${YELLOW}[4/6] Vérification de la configuration...${NC}"
if [ ! -f "../frontend/src/lib/contracts-config.json" ]; then
    echo -e "${RED}Erreur: contracts-config.json non généré${NC}"
    exit 1
fi

cat ../frontend/src/lib/contracts-config.json
echo ""

# 5. Build le frontend
echo -e "\n${YELLOW}[5/6] Build du frontend...${NC}"
cd ../frontend
npm run build

# 6. Démarrer avec PM2
echo -e "\n${YELLOW}[6/6] Démarrage des services avec PM2...${NC}"
cd ..

# Arrêter les anciens processus
pm2 delete all 2>/dev/null || true

# Démarrer indexer et frontend (pas besoin de Hardhat local)
pm2 start ecosystem.config.js --only indexer,frontend
pm2 save

echo -e "\n${GREEN}=========================================="
echo "  ✅ DÉPLOIEMENT TERMINÉ!"
echo "==========================================${NC}"
echo ""
echo "Services lancés:"
pm2 status
echo ""
echo "Accès:"
echo "  → Site: https://blockchainepitechprojet.fr"
echo "  → Frontend: https://blockchainepitechprojet.fr"
echo "  → Indexer API: https://blockchainepitechprojet.fr/api"
echo ""
echo "Réseau:"
echo "  → Sepolia Testnet (Chain ID: 11155111)"
echo ""
echo "Commandes utiles:"
echo "  pm2 logs       - Voir les logs"
echo "  pm2 restart all - Redémarrer"
echo "  pm2 stop all   - Arrêter"
echo ""
