#!/bin/bash
# Generate a secure CCP_AUTH_TOKEN and optionally update .env

TOKEN=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)

echo "Generated token: $TOKEN"
echo ""

# Check if .env exists
if [ -f ".env" ]; then
  read -p "Update .env with this token? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    if grep -q "^CCP_AUTH_TOKEN=" .env; then
      # Replace existing token
      sed -i '' "s/^CCP_AUTH_TOKEN=.*/CCP_AUTH_TOKEN=$TOKEN/" .env
      echo "Updated CCP_AUTH_TOKEN in .env"
    else
      # Add token
      echo "CCP_AUTH_TOKEN=$TOKEN" >> .env
      echo "Added CCP_AUTH_TOKEN to .env"
    fi
  fi
else
  echo "No .env file found. Create one with:"
  echo "  cp .env.example .env"
  echo ""
  echo "Then add this line:"
  echo "  CCP_AUTH_TOKEN=$TOKEN"
fi
