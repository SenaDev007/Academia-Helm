#!/bin/bash
# Start chrome headless with CDP for agent-browser
# Usage: ./start-chrome-headless.sh [port]
PORT="${1:-9222}"
CHROME_BIN="/home/z/.agent-browser/browsers/chrome-150.0.7871.115/chrome"

# Kill existing chrome
pkill -f "remote-debugging-port=$PORT" 2>/dev/null
sleep 1

# Start chrome (kept alive via setsid)
setsid $CHROME_BIN \
  --headless=new \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --disable-extensions \
  --disable-software-rasterizer \
  --remote-debugging-port=$PORT \
  --window-size=1280,900 \
  about:blank > /tmp/chrome-cdp.log 2>&1 &

CHROME_PID=$!
disown

# Wait for chrome to be ready
for i in {1..15}; do
  if curl -s "http://127.0.0.1:$PORT/json/version" > /dev/null 2>&1; then
    echo "✓ Chrome ready on port $PORT (PID $CHROME_PID)"
    exit 0
  fi
  sleep 1
done

echo "✗ Chrome failed to start"
exit 1
