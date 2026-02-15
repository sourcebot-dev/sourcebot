#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Sourcebot Prerequisites Installer${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Track what needs to be installed
NEEDS_INSTALL=()

# Check Homebrew
echo -e "${YELLOW}Checking for Homebrew...${NC}"
if ! command_exists brew; then
    echo -e "${RED}✗ Homebrew is not installed${NC}"
    echo -e "${YELLOW}Installing Homebrew...${NC}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for Apple Silicon Macs
    if [[ $(uname -m) == "arm64" ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    
    if command_exists brew; then
        echo -e "${GREEN}✓ Homebrew installed successfully${NC}\n"
    else
        echo -e "${RED}Failed to install Homebrew. Please install manually from https://brew.sh${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Homebrew is installed${NC}\n"
fi

# Check Node.js
echo -e "${YELLOW}Checking for Node.js (version 24+)...${NC}"
if ! command_exists node; then
    echo -e "${RED}✗ Node.js is not installed${NC}"
    NEEDS_INSTALL+=("node@24")
else
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 24 ]; then
        echo -e "${RED}✗ Node.js version $NODE_VERSION is installed, but version 24+ is required${NC}"
        NEEDS_INSTALL+=("node@24")
    else
        echo -e "${GREEN}✓ Node.js $(node -v) is installed${NC}"
    fi
fi

# Check Go
echo -e "${YELLOW}Checking for Go...${NC}"
if ! command_exists go; then
    echo -e "${RED}✗ Go is not installed${NC}"
    NEEDS_INSTALL+=("go")
else
    echo -e "${GREEN}✓ Go $(go version | awk '{print $3}') is installed${NC}"
fi

# Check Docker
echo -e "${YELLOW}Checking for Docker...${NC}"
if ! command_exists docker; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    echo -e "${YELLOW}Note: Docker Desktop needs to be installed manually or via Homebrew${NC}"
    NEEDS_INSTALL+=("docker")
else
    echo -e "${GREEN}✓ Docker $(docker --version | awk '{print $3}' | tr -d ',') is installed${NC}"
fi

# Check universal-ctags
echo -e "${YELLOW}Checking for universal-ctags...${NC}"
if ! command_exists ctags; then
    echo -e "${RED}✗ ctags is not installed${NC}"
    NEEDS_INSTALL+=("universal-ctags")
else
    # Check if it's universal-ctags or BSD ctags
    CTAGS_VERSION=$(ctags --version 2>&1 | head -n1)
    if [[ $CTAGS_VERSION == *"Universal Ctags"* ]]; then
        echo -e "${GREEN}✓ universal-ctags is installed${NC}"
    else
        echo -e "${RED}✗ BSD ctags is installed, but universal-ctags is required${NC}"
        NEEDS_INSTALL+=("universal-ctags")
    fi
fi

echo ""

# Install missing packages
if [ ${#NEEDS_INSTALL[@]} -gt 0 ]; then
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}Installing missing packages...${NC}"
    echo -e "${YELLOW}========================================${NC}\n"
    
    for package in "${NEEDS_INSTALL[@]}"; do
        echo -e "${YELLOW}Installing $package...${NC}"
        
        if [ "$package" == "docker" ]; then
            echo -e "${BLUE}Installing Docker Desktop via Homebrew...${NC}"
            brew install --cask docker
            echo -e "${YELLOW}Note: You may need to open Docker Desktop manually after installation${NC}"
        else
            brew install "$package"
        fi
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ $package installed successfully${NC}\n"
        else
            echo -e "${RED}✗ Failed to install $package${NC}\n"
        fi
    done
    
    # If node was installed, update PATH for current session
    if [[ " ${NEEDS_INSTALL[@]} " =~ " node@24 " ]]; then
        export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
    fi
fi

# Install corepack and yarn
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Installing Node.js global packages...${NC}"
echo -e "${YELLOW}========================================${NC}\n"

if command_exists node; then
    echo -e "${YELLOW}Installing corepack...${NC}"
    npm install -g corepack
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ corepack installed successfully${NC}\n"
    else
        echo -e "${RED}✗ Failed to install corepack${NC}\n"
    fi
    
    echo -e "${YELLOW}Installing yarn...${NC}"
    npm install --global yarn
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ yarn installed successfully${NC}\n"
    else
        echo -e "${RED}✗ Failed to install yarn${NC}\n"
    fi
else
    echo -e "${RED}✗ Node.js is not available. Please install Node.js first.${NC}\n"
fi

# Final verification
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Final Verification${NC}"
echo -e "${BLUE}========================================${NC}\n"

ALL_GOOD=true

# Check all prerequisites again
if command_exists node; then
    echo -e "${GREEN}✓ Node.js: $(node -v)${NC}"
else
    echo -e "${RED}✗ Node.js: Not found${NC}"
    ALL_GOOD=false
fi

if command_exists go; then
    echo -e "${GREEN}✓ Go: $(go version | awk '{print $3}')${NC}"
else
    echo -e "${RED}✗ Go: Not found${NC}"
    ALL_GOOD=false
fi

if command_exists docker; then
    echo -e "${GREEN}✓ Docker: $(docker --version | awk '{print $3}' | tr -d ',')${NC}"
else
    echo -e "${RED}✗ Docker: Not found${NC}"
    ALL_GOOD=false
fi

if command_exists ctags && [[ $(ctags --version 2>&1 | head -n1) == *"Universal Ctags"* ]]; then
    echo -e "${GREEN}✓ universal-ctags: $(ctags --version 2>&1 | head -n1 | awk '{print $3}')${NC}"
else
    echo -e "${RED}✗ universal-ctags: Not found${NC}"
    ALL_GOOD=false
fi

if command_exists corepack; then
    echo -e "${GREEN}✓ corepack: installed${NC}"
else
    echo -e "${RED}✗ corepack: Not found${NC}"
    ALL_GOOD=false
fi

if command_exists yarn; then
    echo -e "${GREEN}✓ yarn: $(yarn --version)${NC}"
else
    echo -e "${RED}✗ yarn: Not found${NC}"
    ALL_GOOD=false
fi

echo ""

if $ALL_GOOD; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ All prerequisites are installed!${NC}"
    echo -e "${GREEN}========================================${NC}\n"
    echo -e "${BLUE}Next steps:${NC}"
    echo -e "1. Start Docker Desktop if it's not running"
    echo -e "2. Run: ${YELLOW}make${NC} to build zoekt and install dependencies"
    echo -e "3. Run: ${YELLOW}docker compose -f docker-compose-dev.yml up -d${NC} to start PostgreSQL and Redis"
    echo -e "4. Run: ${YELLOW}yarn dev:prisma:migrate:dev${NC} to generate the database schema"
    echo -e "5. Create ${YELLOW}.env.development.local${NC} and configure your environment variables"
    echo -e "6. Create ${YELLOW}config.json${NC} with your repository configuration"
    echo -e "7. Run: ${YELLOW}yarn dev${NC} to start Sourcebot\n"
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}Some prerequisites are missing${NC}"
    echo -e "${RED}========================================${NC}\n"
    echo -e "${YELLOW}Please check the errors above and try running this script again.${NC}"
    echo -e "${YELLOW}You may need to restart your terminal for PATH changes to take effect.${NC}\n"
    exit 1
fi
