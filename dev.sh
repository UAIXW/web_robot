#!/bin/bash
# Robotik 统一启动脚本
# 用法: ./dev.sh [all|server|admin|knowledge|vue|react]
# 默认启动 server + admin

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 端口配置
PORT_SERVER=8787
PORT_ADMIN=5173
PORT_KNOWLEDGE=5176
PORT_VUE=5174
PORT_REACT=5175

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

kill_port() {
  local port=$1
  local name=$2
  local pids=$(lsof -ti:$port 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo -e "${YELLOW}⚠  端口 ${port} 被占用,正在释放...${NC}"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
    echo -e "${GREEN}✓  端口 ${port} 已释放${NC}"
  fi
}

start_server() {
  echo -e "${CYAN}▶ 启动 robotik-server (port ${PORT_SERVER})${NC}"
  kill_port $PORT_SERVER "robotik-server"
  cd "$ROOT_DIR/robotik-server"
  npm run start:dev > /tmp/robotik-server.log 2>&1 &
  echo $! > /tmp/robotik-server.pid
  echo -e "${GREEN}✓ robotik-server PID=$(cat /tmp/robotik-server.pid) → http://localhost:${PORT_SERVER}${NC}"
  echo -e "  Swagger: http://localhost:${PORT_SERVER}/docs"
  echo -e "  日志: tail -f /tmp/robotik-server.log"
}

start_admin() {
  echo -e "${CYAN}▶ 启动 robotik-admin (port ${PORT_ADMIN})${NC}"
  kill_port $PORT_ADMIN "robotik-admin"
  cd "$ROOT_DIR/robotik-admin"
  npm run dev > /tmp/robotik-admin.log 2>&1 &
  echo $! > /tmp/robotik-admin.pid
  echo -e "${GREEN}✓ robotik-admin PID=$(cat /tmp/robotik-admin.pid) → http://localhost:${PORT_ADMIN}${NC}"
  echo -e "  日志: tail -f /tmp/robotik-admin.log"
}

start_knowledge() {
  echo -e "${CYAN}▶ 启动 apps/knowledge (port ${PORT_KNOWLEDGE})${NC}"
  kill_port $PORT_KNOWLEDGE "knowledge-app"
  cd "$ROOT_DIR/apps/knowledge"
  npm run dev > /tmp/robotik-knowledge.log 2>&1 &
  echo $! > /tmp/robotik-knowledge.pid
  echo -e "${GREEN}✓ knowledge app PID=$(cat /tmp/robotik-knowledge.pid) → http://localhost:${PORT_KNOWLEDGE}${NC}"
}

start_vue() {
  echo -e "${CYAN}▶ 启动 apps/examples/vue3 (port ${PORT_VUE})${NC}"
  kill_port $PORT_VUE "vue3-example"
  cd "$ROOT_DIR/apps/examples/vue3"
  npm run dev > /tmp/robotik-vue.log 2>&1 &
  echo $! > /tmp/robotik-vue.pid
  echo -e "${GREEN}✓ vue3 example PID=$(cat /tmp/robotik-vue.pid) → http://localhost:${PORT_VUE}${NC}"
}

start_react() {
  echo -e "${CYAN}▶ 启动 apps/examples/react (port ${PORT_REACT})${NC}"
  kill_port $PORT_REACT "react-example"
  cd "$ROOT_DIR/apps/examples/react"
  npm run dev > /tmp/robotik-react.log 2>&1 &
  echo $! > /tmp/robotik-react.pid
  echo -e "${GREEN}✓ react example PID=$(cat /tmp/robotik-react.pid) → http://localhost:${PORT_REACT}${NC}"
}

stop_all() {
  echo -e "${YELLOW}■ 停止所有服务...${NC}"
  for name in server admin knowledge vue react; do
    local pidfile="/tmp/robotik-${name}.pid"
    if [ -f "$pidfile" ]; then
      local pid=$(cat "$pidfile")
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        echo -e "${GREEN}✓ ${name} (PID=${pid}) 已停止${NC}"
      fi
      rm -f "$pidfile"
    fi
  done
  echo -e "${GREEN}✓ 全部已停止${NC}"
}

show_status() {
  echo -e "${CYAN}═══ Robotik 服务状态 ═══${NC}"
  local names=("robotik-server" "robotik-admin" "knowledge-app" "vue3-example" "react-example")
  local ports=($PORT_SERVER $PORT_ADMIN $PORT_KNOWLEDGE $PORT_VUE $PORT_REACT)
  for i in "${!names[@]}"; do
    name="${names[$i]}"
    port="${ports[$i]}"
    pid=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
      echo -e "${GREEN}● ${name}  →  http://localhost:${port}  (PID=${pid})${NC}"
    else
      echo -e "${RED}○ ${name}  →  端口 ${port} 未启动${NC}"
    fi
  done
}

case "${1:-all}" in
  server)
    start_server
    ;;
  admin)
    start_admin
    ;;
  knowledge)
    start_knowledge
    ;;
  vue)
    start_vue
    ;;
  react)
    start_react
    ;;
  all)
    start_server
    sleep 2
    start_admin
    ;;
  stop)
    stop_all
    ;;
  status)
    show_status
    ;;
  *)
    echo "用法: ./dev.sh [all|server|admin|knowledge|vue|react|stop|status]"
    echo ""
    echo "  all        启动 server + admin (默认)"
    echo "  server     启动后端服务    → :8787"
    echo "  admin      启动管理后台    → :5173"
    echo "  knowledge  启动知识库应用  → :5176"
    echo "  vue        启动 Vue3 示例  → :5174"
    echo "  react      启动 React 示例 → :5175"
    echo "  stop       停止所有服务"
    echo "  status     查看服务状态"
    exit 1
    ;;
esac
