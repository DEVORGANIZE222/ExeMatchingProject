#!/bin/sh
set -e

# Default to Docker Compose internal service addresses if environment variables are not supplied
export IDENTITY_SERVICE_URL=${IDENTITY_SERVICE_URL:-http://identity-semester:8080}
export GROUP_MATCHING_SERVICE_URL=${GROUP_MATCHING_SERVICE_URL:-http://group-matching:8080}
export MENTOR_SERVICE_URL=${MENTOR_SERVICE_URL:-http://mentor:8080}

# Strip any trailing slashes to ensure consistent concatenation with $request_uri
export IDENTITY_SERVICE_URL=$(echo "$IDENTITY_SERVICE_URL" | sed 's:/*$::')
export GROUP_MATCHING_SERVICE_URL=$(echo "$GROUP_MATCHING_SERVICE_URL" | sed 's:/*$::')
export MENTOR_SERVICE_URL=$(echo "$MENTOR_SERVICE_URL" | sed 's:/*$::')

echo "=========================================================="
echo " Starting EXE Nginx API Gateway"
echo " - Identity Service:       $IDENTITY_SERVICE_URL"
echo " - Group Matching Service: $GROUP_MATCHING_SERVICE_URL"
echo " - Mentor Service:         $MENTOR_SERVICE_URL"
echo "=========================================================="

# Only replace our upstream service URLs, preserving all Nginx internal variables ($host, $request_uri, etc.)
envsubst '${IDENTITY_SERVICE_URL} ${GROUP_MATCHING_SERVICE_URL} ${MENTOR_SERVICE_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

exec nginx -g 'daemon off;'
