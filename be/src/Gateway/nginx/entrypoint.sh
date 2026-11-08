#!/bin/sh
set -e

# Automatically detect system DNS resolver from /etc/resolv.conf
SYSTEM_RESOLVER=$(grep -E '^nameserver' /etc/resolv.conf | awk '{print $2}' | tr '\n' ' ' | sed 's/ *$//')
export DNS_RESOLVER=${DNS_RESOLVER:-${SYSTEM_RESOLVER:-127.0.0.11}}

# Default to Docker Compose internal service addresses if environment variables are not supplied
export IDENTITY_SERVICE_URL=${IDENTITY_SERVICE_URL:-http://identity-semester:8080}
export GROUP_MATCHING_SERVICE_URL=${GROUP_MATCHING_SERVICE_URL:-http://group-matching:8080}
export MENTOR_SERVICE_URL=${MENTOR_SERVICE_URL:-http://mentor:8080}

# Strip any trailing slashes to ensure consistent concatenation with $request_uri
export IDENTITY_SERVICE_URL=$(echo "$IDENTITY_SERVICE_URL" | sed 's:/*$::')
export GROUP_MATCHING_SERVICE_URL=$(echo "$GROUP_MATCHING_SERVICE_URL" | sed 's:/*$::')
export MENTOR_SERVICE_URL=$(echo "$MENTOR_SERVICE_URL" | sed 's:/*$::')

# Extract target Host header and TLS SNI name (e.g., identity-semester-xxxx.onrender.com or identity-semester:8080)
export IDENTITY_HOST=$(echo "$IDENTITY_SERVICE_URL" | sed -E 's|^https?://||; s|/.*$||')
export GROUP_MATCHING_HOST=$(echo "$GROUP_MATCHING_SERVICE_URL" | sed -E 's|^https?://||; s|/.*$||')
export MENTOR_HOST=$(echo "$MENTOR_SERVICE_URL" | sed -E 's|^https?://||; s|/.*$||')

echo "=========================================================="
echo " Starting EXE Nginx API Gateway"
echo " - DNS Resolver:           $DNS_RESOLVER"
echo " - Identity Service:       $IDENTITY_SERVICE_URL (Host: $IDENTITY_HOST)"
echo " - Group Matching Service: $GROUP_MATCHING_SERVICE_URL (Host: $GROUP_MATCHING_HOST)"
echo " - Mentor Service:         $MENTOR_SERVICE_URL (Host: $MENTOR_HOST)"
echo "=========================================================="

# Replace only our variables, preserving Nginx internal variables ($host, $request_uri, etc.)
envsubst '${DNS_RESOLVER} ${IDENTITY_SERVICE_URL} ${IDENTITY_HOST} ${GROUP_MATCHING_SERVICE_URL} ${GROUP_MATCHING_HOST} ${MENTOR_SERVICE_URL} ${MENTOR_HOST}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

exec nginx -g 'daemon off;'
