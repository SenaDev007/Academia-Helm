#!/bin/bash
# Script pour ajouter les nouvelles variables d'environnement au fichier .env

ENV_FILE=".env"

# Vérifier si le fichier .env existe
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Le fichier .env n'existe pas. Créez-le d'abord."
    exit 1
fi

# Vérifier si les variables existent déjà
if grep -q "FEDAPAY_API_KEY" "$ENV_FILE"; then
    echo "✅ Les variables FedaPay sont déjà présentes dans .env"
else
    echo "" >> "$ENV_FILE"
    echo "# ============================================================================" >> "$ENV_FILE"
    echo "# CONFIGURATION FEDAPAY" >> "$ENV_FILE"
    echo "# ============================================================================" >> "$ENV_FILE"
    echo "FEDAPAY_API_KEY=" >> "$ENV_FILE"
    echo "FEDAPAY_WEBHOOK_SECRET=" >> "$ENV_FILE"
    echo "FEDAPAY_API_URL=https://api.fedapay.com" >> "$ENV_FILE"
    echo "✅ Variables FedaPay ajoutées"
fi

if grep -q "EMAIL_PROVIDER" "$ENV_FILE"; then
    echo "✅ Les variables Email sont déjà présentes dans .env"
else
    echo "" >> "$ENV_FILE"
    echo "# ============================================================================" >> "$ENV_FILE"
    echo "# CONFIGURATION EMAIL (NODEMAILER)" >> "$ENV_FILE"
    echo "# ============================================================================" >> "$ENV_FILE"
    echo "EMAIL_PROVIDER=mock" >> "$ENV_FILE"
    echo "SMTP_HOST=smtp.gmail.com" >> "$ENV_FILE"
    echo "SMTP_PORT=587" >> "$ENV_FILE"
    echo "SMTP_USER=" >> "$ENV_FILE"
    echo "SMTP_PASSWORD=" >> "$ENV_FILE"
    echo "SMTP_SECURE=false" >> "$ENV_FILE"
    echo "SMTP_FROM=noreply@academia-hub.com" >> "$ENV_FILE"
    echo "✅ Variables Email ajoutées"
fi

if grep -q "WHATSAPP_PROVIDER" "$ENV_FILE"; then
    echo "✅ Les variables WhatsApp sont déjà présentes dans .env"
else
    echo "" >> "$ENV_FILE"
    echo "# ============================================================================" >> "$ENV_FILE"
    echo "# CONFIGURATION WHATSAPP" >> "$ENV_FILE"
    echo "# ============================================================================" >> "$ENV_FILE"
    echo "WHATSAPP_PROVIDER=mock" >> "$ENV_FILE"
    echo "WHATSAPP_BUSINESS_API_URL=https://graph.facebook.com/v18.0" >> "$ENV_FILE"
    echo "WHATSAPP_BUSINESS_ACCESS_TOKEN=" >> "$ENV_FILE"
    echo "WHATSAPP_BUSINESS_PHONE_NUMBER_ID=" >> "$ENV_FILE"
    echo "WHATSAPP_GATEWAY_URL=" >> "$ENV_FILE"
    echo "WHATSAPP_GATEWAY_API_KEY=" >> "$ENV_FILE"
    echo "✅ Variables WhatsApp ajoutées"
fi

if grep -q "SMS_PROVIDER" "$ENV_FILE"; then
    echo "✅ Les variables SMS sont déjà présentes dans .env"
else
    echo "" >> "$ENV_FILE"
    echo "# ============================================================================" >> "$ENV_FILE"
    echo "# CONFIGURATION SMS (TWILIO)" >> "$ENV_FILE"
    echo "# ============================================================================" >> "$ENV_FILE"
    echo "SMS_PROVIDER=mock" >> "$ENV_FILE"
    echo "TWILIO_ACCOUNT_SID=" >> "$ENV_FILE"
    echo "TWILIO_AUTH_TOKEN=" >> "$ENV_FILE"
    echo "TWILIO_PHONE_NUMBER=+22961234567" >> "$ENV_FILE"
    echo "TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886" >> "$ENV_FILE"
    echo "SMS_GATEWAY_URL=" >> "$ENV_FILE"
    echo "SMS_GATEWAY_API_KEY=" >> "$ENV_FILE"
    echo "✅ Variables SMS ajoutées"
fi

if grep -q "FRONTEND_URL" "$ENV_FILE"; then
    echo "✅ FRONTEND_URL est déjà présent dans .env"
else
    echo "" >> "$ENV_FILE"
    echo "# ============================================================================" >> "$ENV_FILE"
    echo "# CONFIGURATION APPLICATION" >> "$ENV_FILE"
    echo "# ============================================================================" >> "$ENV_FILE"
    echo "FRONTEND_URL=http://localhost:3001" >> "$ENV_FILE"
    echo "✅ FRONTEND_URL ajouté"
fi

echo ""
echo "✅ Toutes les variables d'environnement ont été ajoutées au fichier .env"
echo "📝 N'oubliez pas de remplir les valeurs pour la production !"
