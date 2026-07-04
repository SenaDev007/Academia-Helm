#!/bin/bash
# Détection d'Aurore AKPOVI (auroretheodoraa@gmail.com) sur les tenants
# On teste /apply avec son email sur chaque job :
#   - 409 Conflict → l'email existe, on a trouvé le tenant + job
#   - 201/200      → candidature créée (à ÉVITER pour ne pas polluer)
#   - 400/422      → validation error (le body est incomplet mais l'email peut quand même être vérifié)

set -e

EMAIL="auroretheodoraa@gmail.com"

# Tenant: Academia Helm
TENANT_AH="4246cd3c-518a-44bb-a5e0-4109b8eca372"
# Tenant: CSPEB
TENANT_CSPEB="59b8c348-ae5f-4d67-8fbd-af6aefa1f394"

echo "=== Recherche d'Aurore sur Academia Helm ==="
# Liste les jobs Academia Helm
JOBS_AH=$(curl -s "https://api.academiahelm.com/api/hr/recruitment/jobs?tenantId=$TENANT_AH" -m 10 | python3 -c "import sys,json; [print(j['id']+'|'+j['title']) for j in json.load(sys.stdin)]")

echo "$JOBS_AH" | while IFS='|' read -r jid jtitle; do
  echo ""
  echo "--- Test job: $jtitle ($jid) ---"
  response=$(curl -s -w "\n__HTTP_CODE__%{http_code}" -X POST "https://api.academiahelm.com/api/hr/recruitment/apply" \
    -F "firstName=Aurore" \
    -F "lastName=AKPOVI" \
    -F "email=$EMAIL" \
    -F "phone=00000000" \
    -F "tenantId=$TENANT_AH" \
    -F "jobId=$jid" \
    -m 20)
  http_code=$(echo "$response" | grep "__HTTP_CODE__" | sed 's/.*__HTTP_CODE__//')
  body=$(echo "$response" | sed 's/__HTTP_CODE__.*//' | head -c 500)
  echo "HTTP: $http_code"
  echo "Body: $body"
  
  if [ "$http_code" = "409" ]; then
    echo "✅ Aurore trouvée sur Academia Helm, job: $jid"
  fi
done

echo ""
echo "=== Recherche d'Aurore sur CSPEB ==="
JOBS_CSPEB=$(curl -s "https://api.academiahelm.com/api/hr/recruitment/jobs?tenantId=$TENANT_CSPEB" -m 10 | python3 -c "import sys,json; [print(j['id']+'|'+j['title']) for j in json.load(sys.stdin)]")

echo "$JOBS_CSPEB" | while IFS='|' read -r jid jtitle; do
  echo ""
  echo "--- Test job: $jtitle ($jid) ---"
  response=$(curl -s -w "\n__HTTP_CODE__%{http_code}" -X POST "https://api.academiahelm.com/api/hr/recruitment/apply" \
    -F "firstName=Aurore" \
    -F "lastName=AKPOVI" \
    -F "email=$EMAIL" \
    -F "phone=00000000" \
    -F "tenantId=$TENANT_CSPEB" \
    -F "jobId=$jid" \
    -m 20)
  http_code=$(echo "$response" | grep "__HTTP_CODE__" | sed 's/.*__HTTP_CODE__//')
  body=$(echo "$response" | sed 's/__HTTP_CODE__.*//' | head -c 500)
  echo "HTTP: $http_code"
  echo "Body: $body"
  
  if [ "$http_code" = "409" ]; then
    echo "✅ Aurore trouvée sur CSPEB, job: $jid"
  fi
done
