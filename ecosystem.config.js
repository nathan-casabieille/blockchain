/**
 * PM2 Ecosystem Configuration
 * Gère automatiquement les 3 services du projet
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 stop all
 *   pm2 restart all
 *   pm2 logs
 */

module.exports = {
    apps: [
        // 1. Hardhat Node (Blockchain locale)
        {
            name: 'hardhat',
            cwd: './contracts',
            script: 'npx',
            args: 'hardhat node',
            env: {
                NODE_ENV: 'production'
            },
            // Attendre que le node soit prêt avant les autres services
            wait_ready: true,
            listen_timeout: 10000,
            // Logs
            error_file: './logs/hardhat-error.log',
            out_file: './logs/hardhat-out.log',
            merge_logs: true,
            // Restart policy
            autorestart: true,
            max_restarts: 10,
            restart_delay: 5000
        },

        // 2. Indexer Service (API + Event Listener)
        {
            name: 'indexer',
            cwd: './indexer',
            script: 'npm',
            args: 'run start',
            env: {
                NODE_ENV: 'production',
                PORT: 3001,
                RPC_URL: 'http://127.0.0.1:8545'
            },
            // Dépend du Hardhat node
            wait_ready: true,
            listen_timeout: 5000,
            // Logs
            error_file: './logs/indexer-error.log',
            out_file: './logs/indexer-out.log',
            merge_logs: true,
            // Restart policy
            autorestart: true,
            max_restarts: 10,
            restart_delay: 3000
        },

        // 3. Frontend (Next.js)
        {
            name: 'frontend',
            cwd: './frontend',
            script: 'npm',
            args: 'run start',
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            },
            // Logs
            error_file: './logs/frontend-error.log',
            out_file: './logs/frontend-out.log',
            merge_logs: true,
            // Restart policy  
            autorestart: true,
            max_restarts: 10,
            restart_delay: 3000
        }
    ]
};
