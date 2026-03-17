#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <host>"
  exit 1
fi

host=$1

cleanup() {
  echo "Stopping test users..."
  kill $u1 $u2 $u3
  exit 0
}
trap cleanup SIGINT

execute_curl() {
  echo $(eval "curl -s -o /dev/null -w \"%{http_code}\" $1")
}

login() {
  response=$(curl -s -X PUT $host/api/auth \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\", \"password\":\"$2\"}")
  token=$(echo $response | jq -r '.token')
  echo $token
}

echo "Starting Active User Debug Test..."

# -----------------------------
# USER 1: Constant activity
# -----------------------------
while true; do
  token=$(login "d@jwt.com" "diner")
  echo "[User1] login" $( [ -z "$token" ] && echo "FAIL" || echo "OK" )

  while true; do
    result=$(execute_curl "$host/api/order/menu -H \"Authorization: Bearer $token\"")
    echo "[User1] ping $result"
    sleep 10
  done
done &
u1=$!

# -----------------------------
# USER 2: Logs in, then stops
# -----------------------------
while true; do
  token=$(login "f@jwt.com" "franchisee")
  echo "[User2] login" $( [ -z "$token" ] && echo "FAIL" || echo "OK" )

  result=$(execute_curl "$host/api/order/menu -H \"Authorization: Bearer $token\"")
  echo "[User2] single request $result"

  echo "[User2] going idle..."
  sleep 400   # > 5 min window → should drop out

done &
u2=$!

wait $u1 $u2