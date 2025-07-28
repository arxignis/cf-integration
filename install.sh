#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Arxignis Proxy Installation${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Check requirements
echo -e "${YELLOW}Checking requirements...${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed.${NC}"
    echo -e "${BLUE}Please install Node.js from https://nodejs.org/ and try again.${NC}"
    exit 1
fi

# Check Node.js version (minimum v16)
node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 16 ]; then
    echo -e "${RED}Error: Node.js version 16 or higher is required.${NC}"
    echo -e "${BLUE}Current version: $(node -v)${NC}"
    echo -e "${BLUE}Please upgrade Node.js and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v) is installed${NC}"

# Check if npm/npx is available
if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: npx is not available. Please ensure npm is properly installed.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ npx is available${NC}"

# Check if Wrangler is installed globally or available via npx
if ! npx wrangler --version &> /dev/null; then
    echo -e "${YELLOW}Wrangler is not installed. Installing Wrangler...${NC}"
    npm install -g wrangler
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install Wrangler. Please install it manually:${NC}"
        echo -e "${BLUE}npm install -g wrangler${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Wrangler installed successfully${NC}"
else
    echo -e "${GREEN}✓ Wrangler is available${NC}"
fi

echo ""

# Check if wrangler.jsonc exists
if [ ! -f "wrangler.jsonc" ]; then
    echo -e "${RED}Error: wrangler.jsonc not found. Please run this script from the proxy directory.${NC}"
    exit 1
fi

# Function to update wrangler.jsonc
update_wrangler() {
    local key=$1
    local value=$2

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/\"$key\": \"<[^>]*>\"/\"$key\": \"$value\"/g" wrangler.jsonc
    else
        # Linux
        sed -i "s/\"$key\": \"<[^>]*>\"/\"$key\": \"$value\"/g" wrangler.jsonc
    fi
}

# Function to update Prometheus headers
update_prometheus_headers() {
    local auth_key=$1
    local dataset=$2

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/\"Authorization\": \"Bearer <[^>]*>\"/\"Authorization\": \"Bearer $auth_key\"/g" wrangler.jsonc
        sed -i '' "s/\"X-Axiom-Dataset\": \"<[^>]*>\"/\"X-Axiom-Dataset\": \"$dataset\"/g" wrangler.jsonc
    else
        # Linux
        sed -i "s/\"Authorization\": \"Bearer <[^>]*>\"/\"Authorization\": \"Bearer $auth_key\"/g" wrangler.jsonc
        sed -i "s/\"X-Axiom-Dataset\": \"<[^>]*>\"/\"X-Axiom-Dataset\": \"$dataset\"/g" wrangler.jsonc
    fi
}

# Function to update KV namespace ID
update_kv_namespace_id() {
    local namespace_id=$1

    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/\"id\": \"<[^>]*>\"/\"id\": \"$namespace_id\"/g" wrangler.jsonc
    else
        # Linux
        sed -i "s/\"id\": \"<[^>]*>\"/\"id\": \"$namespace_id\"/g" wrangler.jsonc
    fi
}

# 1. Ask for mode (monitor or block)
echo -e "${YELLOW}1. Which mode do you want to use?${NC}"
echo -e "   - monitor: Only monitor traffic without blocking"
echo -e "   - block: Monitor and block malicious traffic"
read -p "Enter mode (default: block): " mode
mode=${mode:-block}

if [[ "$mode" != "monitor" && "$mode" != "block" ]]; then
    echo -e "${RED}Invalid mode. Using default: block${NC}"
    mode="block"
fi

update_wrangler "MODE" "$mode"
echo -e "${GREEN}✓ Mode set to: $mode${NC}"
echo ""

# 2. Ask for Arxignis API key
echo -e "${YELLOW}2. Do you have an Arxignis API key?${NC}"
read -p "Enter 'yes' if you have one, or 'no' to get one: " has_api_key

if [[ "$has_api_key" == "yes" || "$has_api_key" == "y" ]]; then
    read -p "Enter your Arxignis API key: " arxignis_api_key
    if [ ! -z "$arxignis_api_key" ]; then
        update_wrangler "ARXIGNIS_API_KEY" "$arxignis_api_key"
        echo -e "${GREEN}✓ Arxignis API key configured${NC}"
    else
        echo -e "${RED}API key cannot be empty${NC}"
    fi
else
    echo -e "${BLUE}Please visit https://arxignis.com and register to get your API key.${NC}"
    echo -e "${BLUE}After getting your API key, run this script again or manually update wrangler.jsonc${NC}"
fi
echo ""

# 3. Ask for Turnstile keys
echo -e "${YELLOW}3. Do you have Cloudflare Turnstile site key and secret key?${NC}"
read -p "Enter 'yes' if you have them, or 'no' for setup instructions: " has_turnstile

if [[ "$has_turnstile" == "yes" || "$has_turnstile" == "y" ]]; then
    read -p "Enter your Turnstile site key: " turnstile_site_key
    read -p "Enter your Turnstile secret key: " turnstile_secret_key

    if [ ! -z "$turnstile_site_key" ] && [ ! -z "$turnstile_secret_key" ]; then
        update_wrangler "TURNSTILE_SITE_KEY" "$turnstile_site_key"
        update_wrangler "TURNSTILE_SECRET_KEY" "$turnstile_secret_key"
        echo -e "${GREEN}✓ Turnstile keys configured${NC}"
    else
        echo -e "${RED}Both site key and secret key are required${NC}"
    fi
else
    echo -e "${BLUE}Please visit https://docs.arxignis.com and follow the documentation to set up Cloudflare Turnstile.${NC}"
    echo -e "${BLUE}After setting up Turnstile, run this script again or manually update wrangler.jsonc${NC}"
fi
echo ""

# 4. Ask for Prometheus metrics
echo -e "${YELLOW}4. Do you want to enable Prometheus metrics?${NC}"
echo -e "   Note: In Installation, only Axiom provider is supported"
read -p "Enter 'yes' to enable metrics, or 'no' to skip: " enable_metrics

if [[ "$enable_metrics" == "yes" || "$enable_metrics" == "y" ]]; then
    echo -e "${BLUE}Enabling Prometheus metrics with Axiom provider...${NC}"

    read -p "Enter your Axiom authorization token: " axiom_auth
    read -p "Enter your Axiom dataset name: " axiom_dataset

    if [ ! -z "$axiom_auth" ] && [ ! -z "$axiom_dataset" ]; then
        update_wrangler "PERFORMANCE_METRICS" "true"
        update_prometheus_headers "$axiom_auth" "$axiom_dataset"
        echo -e "${GREEN}✓ Prometheus metrics enabled with Axiom${NC}"
    else
        echo -e "${RED}Both authorization token and dataset name are required${NC}"
        update_wrangler "PERFORMANCE_METRICS" "false"
    fi
else
    update_wrangler "PERFORMANCE_METRICS" "false"
    echo -e "${BLUE}Prometheus metrics disabled${NC}"
fi
echo ""

# 5. Wrangler login and KV namespace setup
echo -e "${YELLOW}5. Cloudflare Workers Setup${NC}"

# Check if user is logged in to Wrangler
echo -e "${BLUE}Checking Wrangler login status...${NC}"
if npx wrangler whoami &> /dev/null; then
    echo -e "${GREEN}✓ Already logged in to Cloudflare Workers${NC}"
else
    echo -e "${YELLOW}You need to log in to Cloudflare Workers${NC}"
    echo -e "${BLUE}This will open your browser for authentication...${NC}"
    npx wrangler login
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to log in to Cloudflare Workers. Please try again.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Successfully logged in to Cloudflare Workers${NC}"
fi

# Create KV namespace
echo -e "${BLUE}Creating KV namespace...${NC}"
kv_output=$(npx wrangler kv namespace create ax_cache 2>&1)
if [ $? -eq 0 ]; then
    # Extract the namespace ID from the output
    namespace_id=$(echo "$kv_output" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
    if [ ! -z "$namespace_id" ]; then
        update_kv_namespace_id "$namespace_id"
        echo -e "${GREEN}✓ KV namespace created with ID: $namespace_id${NC}"
        echo -e "${GREEN}✓ KV namespace ID updated in wrangler.jsonc${NC}"
    else
        echo -e "${RED}Failed to extract namespace ID from output${NC}"
        echo -e "${BLUE}Please manually update the AX_CACHE_ID in wrangler.jsonc${NC}"
    fi
else
    echo -e "${RED}Failed to create KV namespace:${NC}"
    echo "$kv_output"
    echo -e "${BLUE}Please manually create the KV namespace and update wrangler.jsonc${NC}"
fi
echo ""

# 6. Final steps
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "1. Install dependencies: ${YELLOW}pnpm install${NC}"
echo -e "2. Deploy to Cloudflare Workers: ${YELLOW}npx wrangler deploy${NC}"
echo ""
echo -e "${BLUE}For more information, visit: https://docs.arxignis.com${NC}"
