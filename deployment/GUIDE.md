# 🚀 Guide de Déploiement OVH

## Prérequis

- **VPS OVH** : Ubuntu 22.04+ (minimum 2GB RAM, 20GB SSD)
- **Nom de domaine** (optionnel, sinon accès via IP)

---

## Installation Rapide (5 minutes)

### 1. Connexion au VPS

```bash
ssh root@VOTRE_IP_VPS
```

### 2. Cloner le projet

```bash
cd /var/www
git clone https://github.com/VOTRE_USER/blockchain.git
cd blockchain
```

### 3. Configurer les variables

```bash
cp .env.example .env
nano .env  # Modifier DOMAIN et autres variables
```

### 4. Lancer le déploiement

```bash
chmod +x deployment/deploy.sh
sudo ./deployment/deploy.sh
```

**C'est tout !** Le script installe tout automatiquement.

---

## Vérification

```bash
# État des services
pm2 status

# Logs en temps réel
pm2 logs

# Tester les endpoints (depuis le VPS)
curl http://localhost:3000  # Frontend
curl http://localhost:3001/stats  # Indexer
```

**Accès depuis l'extérieur** : `http://VOTRE_IP_VPS`

---

## Activer HTTPS (SSL)

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d votre-domaine.com
```

---

## Commandes Utiles

| Commande | Description |
|----------|-------------|
| `pm2 status` | État des services |
| `pm2 logs` | Voir les logs |
| `pm2 restart all` | Redémarrer tout |
| `pm2 stop all` | Arrêter tout |
| `sudo systemctl restart nginx` | Redémarrer Nginx |

---

## Mise à Jour du Code

```bash
cd /var/www/blockchain
git pull
npm install --prefix frontend
npm install --prefix indexer
npm run build --prefix frontend
npm run build --prefix indexer
pm2 restart all
```

---

## Dépannage

### Erreur "port already in use"
```bash
pm2 stop all
lsof -i :3000  # Trouver le process
kill -9 <PID>
pm2 start ecosystem.config.js
```

### Nginx ne répond pas
```bash
sudo nginx -t  # Tester la config
sudo systemctl status nginx
sudo systemctl restart nginx
```

### Voir les erreurs
```bash
pm2 logs --err
tail -f /var/log/nginx/error.log
```
