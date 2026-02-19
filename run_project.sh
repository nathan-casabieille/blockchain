#!/bin/bash
echo "Starting Project..."

# Kill all background jobs when script exits
cleanup() {
  echo ""
  echo "Shutting down..."
  for pid in $(jobs -p); do kill "$pid" 2>/dev/null; done
  exit 0
}
trap cleanup SIGINT SIGTERM

# 1. Start Hardhat Node
echo "[1/4] Starting Hardhat Node..."
(cd contracts && npx hardhat node) &
sleep 5

# 2. Start Indexer Service (Must be running to receive contract addresses)
echo "[2/4] Starting Indexer Service..."
(cd indexer && npm run dev) &
sleep 5

# 3. Deploy Contracts (Will notify Indexer)
echo "[3/4] Deploying Smart Contracts..."
(cd contracts && npx hardhat run scripts/deploy.ts --network localhost) &
sleep 10

# 4. Start Frontend
echo "[4/4] Starting Frontend..."
(cd frontend && npm run dev) &

echo ""
echo "======================================================"
echo "  PROJECT STARTED SUCCESSFULLY!"
echo "======================================================"
echo "  Frontend: http://localhost:3000"
echo "  Indexer:  http://localhost:3001"
echo "  Node:     http://127.0.0.1:8545"
echo "======================================================"
echo ""
echo "Press Ctrl+C to stop all services."
echo ""

wait
