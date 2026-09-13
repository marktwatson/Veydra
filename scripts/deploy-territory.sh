#!/bin/bash

# Multi-Instance Territory Deployment Script for Supabase
# Usage: ./scripts/deploy-territory.sh <SUPABASE_PROJECT_REF>

if [ -z "$1" ]; then
  echo "Error: Please provide a Supabase Project Reference ID."
  echo "Usage: ./scripts/deploy-territory.sh <SUPABASE_PROJECT_REF>"
  exit 1
fi

PROJECT_REF=$1

echo "🚀 Deploying to Supabase Project: $PROJECT_REF..."

# 1. Link Supabase project
echo "🔗 Linking Supabase project..."
npx supabase link --project-ref "$PROJECT_REF"

# 2. Push Database Schema & Migrations
echo "🗄️ Applying Database Schema..."
npx supabase db push

# 3. Deploy all Edge Functions
echo "⚡ Deploying Edge Functions..."
FUNCTIONS=("crm-webhook" "daily-reminders" "process-notifications" "stripe-checkout" "stripe-invoices" "stripe-onboard" "stripe-payout" "stripe-portal" "stripe-webhook")

for fn in "${FUNCTIONS[@]}"; do
  echo "  └─ Deploying $fn..."
  npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
done

echo "✅ Deployment complete for $PROJECT_REF!"
