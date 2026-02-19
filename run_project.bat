@echo off
echo Starting Project...

:: 1. Start Hardhat Node
echo [1/4] Starting Hardhat Node...
start "Hardhat Node" cmd /k "cd contracts && npx hardhat node"
timeout /t 5

:: 2. Start Indexer Service (Must be running to receive contract addresses)
echo [2/4] Starting Indexer Service...
start "Indexer Service" cmd /k "cd indexer && npm run dev"
timeout /t 5

:: 3. Deploy Contracts (Will notify Indexer)
echo [3/4] Deploying Smart Contracts...
start "Deploying" cmd /c "cd contracts && npx hardhat run scripts/deploy.ts --network localhost && pause"
timeout /t 10

:: 4. Start Frontend
echo [4/4] Starting Frontend...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ====================================================
echo   PROJECT STARTED SUCCESSFULLY!
echo ====================================================
echo   Frontend: http://localhost:3000
echo   Indexer:  http://localhost:3001
echo   Node:     http://127.0.0.1:8545
echo ====================================================
echo.
