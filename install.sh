#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check for reset flag
if [ "$1" = "--reset" ]; then
    reset_configuration
    exit 0
fi

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Arxignis Installation${NC}"
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

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}jq is not installed. Installing jq...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install jq
        else
            echo -e "${RED}Error: jq is required but not installed. Please install jq manually:${NC}"
            echo -e "${BLUE}brew install jq${NC}"
            exit 1
        fi
    else
        # Linux
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y jq
        elif command -v yum &> /dev/null; then
            sudo yum install -y jq
        elif command -v dnf &> /dev/null; then
            sudo dnf install -y jq
        else
            echo -e "${RED}Error: jq is required but not installed. Please install jq manually.${NC}"
            exit 1
        fi
    fi
    echo -e "${GREEN}✓ jq installed successfully${NC}"
else
    echo -e "${GREEN}✓ jq is available${NC}"
fi

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

# Check if original template exists and create wrangler.jsonc if needed
if [ ! -f "original_wrangler.jsonc" ]; then
    echo -e "${RED}Error: original_wrangler.jsonc template not found. Please run this script from the proxy directory.${NC}"
    exit 1
fi

# Create wrangler.jsonc from template if it doesn't exist
if [ ! -f "wrangler.jsonc" ]; then
    echo -e "${BLUE}Creating wrangler.jsonc from template...${NC}"
    cp original_wrangler.jsonc wrangler.jsonc
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to create wrangler.jsonc from template${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ wrangler.jsonc created from template${NC}"
else
    echo -e "${BLUE}Using existing wrangler.jsonc${NC}"
fi

# Temporary storage file for answers
TEMP_FILE=".install_answers"

# Function to save answer to temporary file
save_answer() {
    local key=$1
    local value=$2
    echo "$key=$value" >> "$TEMP_FILE"
}

# Function to get saved answer
get_saved_answer() {
    local key=$1
    if [ -f "$TEMP_FILE" ]; then
        # Use awk for more robust key-value extraction
        awk -F'=' -v key="$key" '$1 == key {print substr($0, length(key) + 2)}' "$TEMP_FILE" | tail -1
    fi
}

# Function to clear temporary answers
clear_temp_answers() {
    if [ -f "$TEMP_FILE" ]; then
        rm "$TEMP_FILE"
    fi
}

# Function to reset configuration
reset_configuration() {
    echo -e "${YELLOW}Resetting configuration...${NC}"
    if [ -f "wrangler.jsonc" ]; then
        rm wrangler.jsonc
    fi
    if [ -f "original_wrangler.jsonc" ]; then
        cp original_wrangler.jsonc wrangler.jsonc
        echo -e "${GREEN}✓ Configuration reset to template${NC}"
    else
        echo -e "${RED}Template file not found${NC}"
    fi
}

# Function to update wrangler.jsonc
update_wrangler() {
    local key=$1
    local value=$2

    # Use jq to update the vars object in the JSON file
    jq --arg k "$key" --arg v "$value" '.vars[$k] = $v' wrangler.jsonc > wrangler.jsonc.tmp && mv wrangler.jsonc.tmp wrangler.jsonc
}

# Function to update Prometheus headers
update_prometheus_headers() {
    local auth_key=$1
    local dataset=$2

    # Use jq to update the Prometheus headers in the vars object
    jq --arg auth "Bearer $auth_key" --arg dataset "$dataset" \
       '.vars.PROMETHEUS_HEADERS.Authorization = $auth | .vars.PROMETHEUS_HEADERS."X-Axiom-Dataset" = $dataset' \
       wrangler.jsonc > wrangler.jsonc.tmp && mv wrangler.jsonc.tmp wrangler.jsonc
}

# Function to update KV namespace ID
update_kv_namespace_id() {
    local namespace_id=$1

    # Use jq to update the KV namespace ID in the JSON file
    jq --arg id "$namespace_id" '.kv_namespaces[0].id = $id' wrangler.jsonc > wrangler.jsonc.tmp && mv wrangler.jsonc.tmp wrangler.jsonc
}

# Function to update account ID (root level)
update_account_id() {
    local account_id=$1

    # Use jq to update the account_id at the root level
    jq --arg id "$account_id" '.account_id = $id' wrangler.jsonc > wrangler.jsonc.tmp && mv wrangler.jsonc.tmp wrangler.jsonc
}

# 1. Ask for mode (monitor or block)
saved_mode=$(get_saved_answer "mode")
if [ ! -z "$saved_mode" ]; then
    echo -e "${YELLOW}1. Which mode do you want to use?${NC}"
    echo -e "   - monitor: Only monitor traffic without blocking"
    echo -e "   - block: Monitor and block malicious traffic"
    echo -e "${BLUE}Previous answer: $saved_mode${NC}"
    read -p "Enter mode (default: $saved_mode): " mode
    mode=${mode:-$saved_mode}
else
    echo -e "${YELLOW}1. Which mode do you want to use?${NC}"
    echo -e "   - monitor: Only monitor traffic without blocking"
    echo -e "   - block: Monitor and block malicious traffic"
    read -p "Enter mode (default: monitor): " mode
    mode=${mode:-monitor}
fi

if [[ "$mode" != "monitor" && "$mode" != "block" ]]; then
    echo -e "${RED}Invalid mode. Using default: block${NC}"
    mode="block"
fi

if [[ "$mode" == "monitor" ]]; then
    echo -e "${BLUE}Note: In monitor mode, the proxy will only monitor traffic and not block malicious traffic.${NC}"
fi

save_answer "mode" "$mode"
update_wrangler "MODE" "$mode"
echo -e "${GREEN}✓ Mode set to: $mode${NC}"
echo ""

# 2. Ask for Arxignis API key
saved_has_api_key=$(get_saved_answer "has_api_key")
saved_arxignis_api_key=$(get_saved_answer "arxignis_api_key")

if [ ! -z "$saved_has_api_key" ]; then
    echo -e "${YELLOW}2. Do you have an Arxignis API key?${NC}"
    echo -e "${BLUE}Previous answer: $saved_has_api_key${NC}"
    read -p "Enter 'yes' if you have one, or 'no' to get one (default: $saved_has_api_key): " has_api_key
    has_api_key=${has_api_key:-$saved_has_api_key}
else
    echo -e "${YELLOW}2. Do you have an Arxignis API key?${NC}"
    read -p "Enter 'yes' if you have one, or 'no' to get one: " has_api_key
fi

save_answer "has_api_key" "$has_api_key"

if [[ "$has_api_key" == "yes" || "$has_api_key" == "y" ]]; then
    if [ ! -z "$saved_arxignis_api_key" ]; then
        echo -e "${BLUE}Previous API key found${NC}"
        read -s -p "Enter your Arxignis API key (default: use previous): " arxignis_api_key
        echo ""
        arxignis_api_key=${arxignis_api_key:-$saved_arxignis_api_key}
    else
        read -s -p "Enter your Arxignis API key: " arxignis_api_key
        echo ""
    fi

    if [ ! -z "$arxignis_api_key" ]; then
        save_answer "arxignis_api_key" "$arxignis_api_key"
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
saved_has_turnstile=$(get_saved_answer "has_turnstile")
saved_turnstile_site_key=$(get_saved_answer "turnstile_site_key")
saved_turnstile_secret_key=$(get_saved_answer "turnstile_secret_key")

if [ ! -z "$saved_has_turnstile" ]; then
    echo -e "${YELLOW}3. Do you have Cloudflare Turnstile site key and secret key?${NC}"
    echo -e "${BLUE}Previous answer: $saved_has_turnstile${NC}"
    read -p "Enter 'yes' if you have them, or 'no' to create a new one (default: $saved_has_turnstile): " has_turnstile
    has_turnstile=${has_turnstile:-$saved_has_turnstile}
else
    echo -e "${YELLOW}3. Do you have Cloudflare Turnstile site key and secret key?${NC}"
    read -p "Enter 'yes' if you have them, or 'no' to create a new one: " has_turnstile
fi

save_answer "has_turnstile" "$has_turnstile"

turnstile_keys_provided=false
if [[ "$has_turnstile" == "yes" || "$has_turnstile" == "y" ]]; then
    if [ ! -z "$saved_turnstile_site_key" ] && [ ! -z "$saved_turnstile_secret_key" ]; then
        echo -e "${BLUE}Previous Turnstile keys found${NC}"
        read -p "Enter your Turnstile site key (default: use previous): " turnstile_site_key
        turnstile_site_key=${turnstile_site_key:-$saved_turnstile_site_key}
        read -s -p "Enter your Turnstile secret key (default: use previous): " turnstile_secret_key
        echo ""
        turnstile_secret_key=${turnstile_secret_key:-$saved_turnstile_secret_key}
    else
        read -p "Enter your Turnstile site key: " turnstile_site_key
        read -s -p "Enter your Turnstile secret key: " turnstile_secret_key
        echo ""
    fi

    if [ ! -z "$turnstile_site_key" ] && [ ! -z "$turnstile_secret_key" ]; then
        save_answer "turnstile_site_key" "$turnstile_site_key"
        save_answer "turnstile_secret_key" "$turnstile_secret_key"
        update_wrangler "TURNSTILE_SITE_KEY" "$turnstile_site_key"
        update_wrangler "TURNSTILE_SECRET_KEY" "$turnstile_secret_key"
        turnstile_keys_provided=true
        echo -e "${GREEN}✓ Turnstile keys configured${NC}"
    else
        echo -e "${RED}Both site key and secret key are required${NC}"
    fi
else
    echo -e "${BLUE}Turnstile widget will be created automatically in step 7${NC}"
fi
echo ""

# 4. Ask for Prometheus metrics
saved_enable_metrics=$(get_saved_answer "enable_metrics")
saved_axiom_auth=$(get_saved_answer "axiom_auth")
saved_axiom_dataset=$(get_saved_answer "axiom_dataset")

if [ ! -z "$saved_enable_metrics" ]; then
    echo -e "${YELLOW}4. Do you want to enable Prometheus metrics?${NC}"
    echo -e "   Note: In Installation, only Axiom provider is supported"
    echo -e "${BLUE}Previous answer: $saved_enable_metrics${NC}"
    read -p "Enter 'yes' to enable metrics, or 'no' to skip (default: $saved_enable_metrics): " enable_metrics
    enable_metrics=${enable_metrics:-$saved_enable_metrics}
else
    echo -e "${YELLOW}4. Do you want to enable Prometheus metrics?${NC}"
    echo -e "   Note: In Installation, only Axiom provider is supported"
    read -p "Enter 'yes' to enable metrics, or 'no' to skip: " enable_metrics
fi

save_answer "enable_metrics" "$enable_metrics"

if [[ "$enable_metrics" == "yes" || "$enable_metrics" == "y" ]]; then
    echo -e "${BLUE}Enabling Prometheus metrics with Axiom provider...${NC}"

    if [ ! -z "$saved_axiom_auth" ] && [ ! -z "$saved_axiom_dataset" ]; then
        echo -e "${BLUE}Previous Axiom credentials found${NC}"
        read -s -p "Enter your Axiom authorization token (default: use previous): " axiom_auth
        echo ""
        axiom_auth=${axiom_auth:-$saved_axiom_auth}
        read -p "Enter your Axiom dataset name (default: use previous): " axiom_dataset
        axiom_dataset=${axiom_dataset:-$saved_axiom_dataset}
    else
        read -s -p "Enter your Axiom authorization token: " axiom_auth
        echo ""
        read -p "Enter your Axiom dataset name: " axiom_dataset
    fi

    if [ ! -z "$axiom_auth" ] && [ ! -z "$axiom_dataset" ]; then
        save_answer "axiom_auth" "$axiom_auth"
        save_answer "axiom_dataset" "$axiom_dataset"
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

# 5. Cloudflare API Token Setup
echo -e "${YELLOW}5. Cloudflare API Token Setup${NC}"

# Ask for Cloudflare API token
saved_has_cf_token=$(get_saved_answer "has_cf_token")
saved_cf_api_token=$(get_saved_answer "cf_api_token")

if [ ! -z "$saved_has_cf_token" ]; then
    echo -e "${YELLOW}Do you have a Cloudflare API token?${NC}"
    echo -e "${BLUE}Previous answer: $saved_has_cf_token${NC}"
    read -p "Enter 'yes' if you have one, or 'no' to get one (default: $saved_has_cf_token): " has_cf_token
    has_cf_token=${has_cf_token:-$saved_has_cf_token}
else
    echo -e "${YELLOW}Do you have a Cloudflare API token?${NC}"
    read -p "Enter 'yes' if you have one, or 'no' to get one: " has_cf_token
fi

save_answer "has_cf_token" "$has_cf_token"

if [[ "$has_cf_token" == "yes" || "$has_cf_token" == "y" ]]; then
    if [ ! -z "$saved_cf_api_token" ]; then
        echo -e "${BLUE}Previous API token found${NC}"
        read -s -p "Enter your Cloudflare API token (default: use previous): " cf_api_token
        echo ""
        cf_api_token=${cf_api_token:-$saved_cf_api_token}
    else
        read -s -p "Enter your Cloudflare API token: " cf_api_token
        echo ""
    fi

    if [ ! -z "$cf_api_token" ]; then
        save_answer "cf_api_token" "$cf_api_token"
        # Set the API token for Wrangler using environment variable
        export CLOUDFLARE_API_TOKEN="$cf_api_token"
        echo -e "${GREEN}✓ Cloudflare API token configured${NC}"
        echo -e "${BLUE}Note: API token will be used for this session. For permanent setup, add CLOUDFLARE_API_TOKEN to your environment.${NC}"
    else
        echo -e "${RED}API token cannot be empty${NC}"
    fi
else
    echo -e "${BLUE}Opening Cloudflare API token creation page...${NC}"
    echo -e "${BLUE}Please create a token with the following permissions:${NC}"
    echo -e "${YELLOW}- Account Settings (Read)${NC}"
    echo -e "${YELLOW}- Challenge Widgets (Edit)${NC}"
    echo -e "${YELLOW}- User Details (Read)${NC}"
    echo -e "${YELLOW}- Workers KV Storage (Edit)${NC}"
    echo -e "${YELLOW}- Workers Routes (Edit)${NC}"
    echo -e "${YELLOW}- Workers Scripts (Edit)${NC}"
    echo -e "${YELLOW}- Zone (Read)${NC}"
    echo -e "${YELLOW}- DNS (Read)${NC}"

    # Cloudflare API token creation URL with required permissions
    CF_TOKEN_URL="https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22account_settings%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22challenge_widgets%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22user_details%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22workers_kv_storage%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_routes%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22workers_scripts%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22zone%22%2C%22type%22%3A%22read%22%7D%2C%20%7B%22key%22%3A%20%22dns%22%2C%20%22type%22%3A%22read%22%7D%2C%20%7B%22key%22%3A%22memberships%22%2C%22type%22%3A%22read%22%7D%5D&name=Arxignis-API-Token"

    # Open browser with the provided URL
    if command -v open &> /dev/null; then
        open "$CF_TOKEN_URL"
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$CF_TOKEN_URL"
    else
        echo -e "${BLUE}Please manually open this URL in your browser:${NC}"
        echo -e "${YELLOW}$CF_TOKEN_URL${NC}"
    fi

    echo ""
    echo -e "${YELLOW}After creating the token, please restart this script and your previous answers will be restored.${NC}"
    exit 0
fi
echo ""

# 6. Ask for Cloudflare Account ID
saved_cf_account_id=$(get_saved_answer "cf_account_id")

if [ ! -z "$saved_cf_account_id" ]; then
    echo -e "${YELLOW}6. Cloudflare Account ID${NC}"
    echo -e "${BLUE}Previous Account ID: $saved_cf_account_id${NC}"
    read -p "Enter your Cloudflare Account ID (default: $saved_cf_account_id): " cf_account_id
    cf_account_id=${cf_account_id:-$saved_cf_account_id}
else
    echo -e "${YELLOW}6. Cloudflare Account ID${NC}"
    read -p "Enter your Cloudflare Account ID: " cf_account_id
fi

if [ ! -z "$cf_account_id" ]; then
    save_answer "cf_account_id" "$cf_account_id"
    # Update wrangler.jsonc with account ID
    update_account_id "$cf_account_id"
    echo -e "${GREEN}✓ Cloudflare Account ID configured: $cf_account_id${NC}"
else
    echo -e "${RED}Account ID cannot be empty${NC}"
    exit 1
fi
echo ""

# 7. Domain and Turnstile Setup
echo -e "${YELLOW}7. Domain and Turnstile Setup${NC}"

# Ask for domain
saved_domain=$(get_saved_answer "domain")

if [ ! -z "$saved_domain" ]; then
    echo -e "${BLUE}Previous domain: $saved_domain${NC}"
    read -p "Enter your domain (e.g., example.com) (default: $saved_domain): " domain
    domain=${domain:-$saved_domain}
else
    read -p "Enter your domain (e.g., example.com): " domain
fi

if [ -z "$domain" ]; then
    echo -e "${RED}Domain cannot be empty${NC}"
    exit 1
fi

save_answer "domain" "$domain"

# Check if Turnstile keys were already provided
if [ "$turnstile_keys_provided" = true ]; then
    echo -e "${BLUE}Turnstile keys already provided, skipping widget creation${NC}"
else
    echo -e "${BLUE}Creating Turnstile widget for domain: $domain${NC}"

    # Create Turnstile widget using Cloudflare API
    turnstile_response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$cf_account_id/challenges/widgets" \
        -H 'Content-Type: application/json' \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -d "{
              \"domains\": [
                \"$domain\"
              ],
              \"mode\": \"managed\",
              \"name\": \"Arxignis Protection\",
              \"clearance_level\": \"no_clearance\"
            }")

    # Check if the API call was successful
    if echo "$turnstile_response" | jq -e '.success == true' > /dev/null 2>&1; then
        # Extract site key and secret key from response using jq
        site_key=$(echo "$turnstile_response" | jq -r '.result.sitekey')
        secret_key=$(echo "$turnstile_response" | jq -r '.result.secret')

        if [ ! -z "$site_key" ] && [ "$site_key" != "null" ] && [ ! -z "$secret_key" ] && [ "$secret_key" != "null" ]; then
            # Update wrangler.jsonc with Turnstile keys
            update_wrangler "TURNSTILE_SITE_KEY" "$site_key"
            update_wrangler "TURNSTILE_SECRET_KEY" "$secret_key"
            echo -e "${GREEN}✓ Turnstile widget created successfully${NC}"
            echo -e "${GREEN}✓ Site Key: $site_key${NC}"
            echo -e "${GREEN}✓ Secret Key: $secret_key${NC}"
        else
            echo -e "${RED}Failed to extract Turnstile keys from response${NC}"
            echo -e "${BLUE}Debug - Site key: '$site_key'${NC}"
            echo -e "${BLUE}Debug - Secret key: '$secret_key'${NC}"
            echo -e "${BLUE}Response: $turnstile_response${NC}"
            exit 1
        fi
    else
        echo -e "${RED}Failed to create Turnstile widget${NC}"
        echo -e "${BLUE}Response: $turnstile_response${NC}"
        echo -e "${BLUE}Please check your API token permissions and try again${NC}"
        exit 1
    fi
fi

# Update routes in wrangler.jsonc
echo -e "${BLUE}Updating routes for domain: $domain${NC}"

# Function to update routes in wrangler.jsonc
update_routes() {
    local domain=$1

    # Use jq to update the routes array in the JSON file
    jq --arg domain "*.$domain/*" '.routes = [$domain]' wrangler.jsonc > wrangler.jsonc.tmp && mv wrangler.jsonc.tmp wrangler.jsonc
}

update_routes "$domain"
echo -e "${GREEN}✓ Routes updated for domain: $domain${NC}"
echo ""

# 8. Wrangler login and KV namespace setup
echo -e "${YELLOW}8. Cloudflare Workers Setup${NC}"

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

# Check if KV namespace already exists
echo -e "${BLUE}Checking for existing KV namespace...${NC}"
existing_namespaces=$(npx wrangler kv namespace list 2>/dev/null)
if [ $? -eq 0 ]; then
    # Check if ax_cache namespace already exists using jq for better parsing
    namespace_id=$(echo "$existing_namespaces" | jq -r '.[] | select(.title == "ax_cache") | .id' 2>/dev/null)
    if [ ! -z "$namespace_id" ] && [ "$namespace_id" != "null" ]; then
        update_kv_namespace_id "$namespace_id"
        echo -e "${GREEN}✓ Found existing KV namespace with ID: $namespace_id${NC}"
        echo -e "${GREEN}✓ KV namespace ID updated in wrangler.jsonc${NC}"
    else
        # Try to create new KV namespace
        echo -e "${BLUE}Creating new KV namespace...${NC}"
        kv_output=$(npx wrangler kv namespace create ax_cache 2>&1)
        if [ $? -eq 0 ]; then
            # Extract the namespace ID from the output using jq
            namespace_id=$(echo "$kv_output" | jq -r '.id // empty' 2>/dev/null || echo "$kv_output" | grep -o 'id = "[^"]*"' | cut -d'"' -f2)
            if [ ! -z "$namespace_id" ]; then
                update_kv_namespace_id "$namespace_id"
                echo -e "${GREEN}✓ KV namespace created with ID: $namespace_id${NC}"
                echo -e "${GREEN}✓ KV namespace ID updated in wrangler.jsonc${NC}"
            else
                echo -e "${RED}Failed to extract namespace ID from output${NC}"
                echo -e "${BLUE}Please manually update the AX_CACHE_ID in wrangler.jsonc${NC}"
            fi
        else
            # Check if the error is because namespace already exists
            if echo "$kv_output" | jq -e '.error // empty' 2>/dev/null | grep -q "already exists" || echo "$kv_output" | grep -q "already exists"; then
                echo -e "${YELLOW}KV namespace 'ax_cache' already exists, trying to find it...${NC}"
                # Try to list namespaces again and find the existing one
                existing_namespaces_retry=$(npx wrangler kv namespace list 2>/dev/null)
                if [ $? -eq 0 ]; then
                    namespace_id=$(echo "$existing_namespaces_retry" | jq -r '.[] | select(.title == "ax_cache") | .id' 2>/dev/null)
                    if [ ! -z "$namespace_id" ] && [ "$namespace_id" != "null" ]; then
                        update_kv_namespace_id "$namespace_id"
                        echo -e "${GREEN}✓ Found existing KV namespace with ID: $namespace_id${NC}"
                        echo -e "${GREEN}✓ KV namespace ID updated in wrangler.jsonc${NC}"
                    else
                        echo -e "${RED}Could not find existing KV namespace. Please check manually:${NC}"
                        echo -e "${BLUE}npx wrangler kv namespace list${NC}"
                        echo -e "${BLUE}Then update the AX_CACHE_ID in wrangler.jsonc${NC}"
                    fi
                else
                    echo -e "${RED}Failed to list KV namespaces after creation error${NC}"
                    echo -e "${BLUE}Please check manually: npx wrangler kv namespace list${NC}"
                fi
            else
                echo -e "${RED}Failed to create KV namespace:${NC}"
                echo "$kv_output"
                echo -e "${BLUE}Please manually create the KV namespace and update wrangler.jsonc${NC}"
            fi
        fi
    fi
else
    echo -e "${RED}Failed to list KV namespaces:${NC}"
    echo "$existing_namespaces"
    echo -e "${BLUE}Please check your Wrangler configuration and try again.${NC}"
fi
echo ""

# 9. Final steps
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Installation Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "1. Install dependencies: ${YELLOW}pnpm install${NC}"
echo -e "2. Deploy to Cloudflare Workers: ${YELLOW}npx wrangler deploy${NC}"
echo ""
echo -e "${BLUE}Additional options:${NC}"
echo -e "- Reset configuration: ${YELLOW}./install.sh --reset${NC}"
echo ""
echo -e "${BLUE}For more information, visit: https://docs.arxignis.com${NC}"

# Clean up temporary answers file
clear_temp_answers
