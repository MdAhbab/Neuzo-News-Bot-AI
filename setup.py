#!/usr/bin/env python3
"""
Neuzo Setup Script
Automates the complete installation and configuration of the Neuzo news bot system.
"""

import subprocess
import sys
import os
import platform
from pathlib import Path

class Colors:
    """ANSI color codes for terminal output"""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_step(message):
    """Print a step header"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{message}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}\n")

def print_success(message):
    """Print success message"""
    print(f"{Colors.OKGREEN}✓ {message}{Colors.ENDC}")

def print_error(message):
    """Print error message"""
    print(f"{Colors.FAIL}✗ {message}{Colors.ENDC}")

def print_warning(message):
    """Print warning message"""
    print(f"{Colors.WARNING}⚠ {message}{Colors.ENDC}")

def print_info(message):
    """Print info message"""
    print(f"{Colors.OKCYAN}ℹ {message}{Colors.ENDC}")

def run_command(command, shell=True, check=True, capture_output=False):
    """Run a shell command and return the result"""
    try:
        if capture_output:
            result = subprocess.run(command, shell=shell, check=check, 
                                   capture_output=True, text=True)
            return result.stdout.strip()
        else:
            subprocess.run(command, shell=shell, check=check)
            return True
    except subprocess.CalledProcessError as e:
        return False

def check_python_version():
    """Check if Python version is 3.13+"""
    print_step("Step 1: Checking Python Version")
    
    version = sys.version_info
    if version.major == 3 and version.minor >= 13:
        print_success(f"Python {version.major}.{version.minor}.{version.micro} detected")
        return True
    else:
        print_error(f"Python 3.13+ required, found {version.major}.{version.minor}.{version.micro}")
        print_info("Download Python 3.13+ from: https://www.python.org/downloads/")
        return False

def check_node_version():
    """Check if Node.js is installed"""
    print_step("Step 2: Checking Node.js Version")
    
    version = run_command("node --version", capture_output=True)
    if version:
        print_success(f"Node.js {version} detected")
        return True
    else:
        print_error("Node.js not found")
        print_info("Download Node.js from: https://nodejs.org/")
        return False

def check_mysql():
    """Check if MySQL is running"""
    print_step("Step 3: Checking MySQL Server")
    
    is_windows = platform.system() == "Windows"
    
    if is_windows:
        result = run_command("Get-Service MySQL80 -ErrorAction SilentlyContinue", 
                           shell=True, check=False, capture_output=True)
        if result and "Running" in result:
            print_success("MySQL server is running")
            return True
    else:
        result = run_command("systemctl is-active mysql", 
                           shell=True, check=False, capture_output=True)
        if result and "active" in result:
            print_success("MySQL server is running")
            return True
    
    print_error("MySQL server not running or not found")
    print_info("Install MySQL 8.0+ from: https://dev.mysql.com/downloads/")
    print_info("Make sure MySQL service is started")
    return False

def create_virtual_environment():
    """Create Python virtual environment"""
    print_step("Step 4: Creating Virtual Environment")
    
    venv_path = Path(".venv")
    
    if venv_path.exists():
        print_warning("Virtual environment already exists, skipping creation")
        return True
    
    print_info("Creating virtual environment...")
    if run_command(f"{sys.executable} -m venv .venv"):
        print_success("Virtual environment created")
        return True
    else:
        print_error("Failed to create virtual environment")
        return False

def install_python_dependencies():
    """Install Python dependencies from requirements.txt"""
    print_step("Step 5: Installing Python Dependencies")
    
    is_windows = platform.system() == "Windows"
    pip_path = ".venv\\Scripts\\pip.exe" if is_windows else ".venv/bin/pip"
    
    if not Path(pip_path).exists():
        print_error(f"pip not found at {pip_path}")
        return False
    
    print_info("Installing dependencies (this may take 2-3 minutes)...")
    if run_command(f'"{pip_path}" install -r backend/requirements.txt'):
        print_success("Python dependencies installed")
        return True
    else:
        print_error("Failed to install Python dependencies")
        return False

def install_frontend_dependencies():
    """Install Node.js dependencies for frontend"""
    print_step("Step 6: Installing Frontend Dependencies")
    
    frontend_path = Path("Frontend")
    if not frontend_path.exists():
        print_error("Frontend directory not found")
        return False
    
    os.chdir(frontend_path)
    print_info("Installing npm packages (this may take 2-3 minutes)...")
    
    result = run_command("npm install")
    os.chdir("..")
    
    if result:
        print_success("Frontend dependencies installed")
        return True
    else:
        print_error("Failed to install frontend dependencies")
        return False

def setup_configuration():
    """Setup configuration file"""
    print_step("Step 7: Configuring Application")
    
    config_path = Path("backend/config.yaml")

    if config_path.exists():
        print_warning("backend/config.yaml already exists")
        response = input("Do you want to keep existing configuration? (y/n): ").lower()
        if response == 'y':
            print_info("Keeping existing configuration")
            return True
    
    print_info("Please provide the following information:")
    
    # Get MySQL password
    mysql_password = input("MySQL root password (default: root): ").strip()
    if not mysql_password:
        mysql_password = "root"
    
    # Get NewsAPI key
    print_info("\nGet your free NewsAPI key from: https://newsapi.org/register")
    newsapi_key = input("NewsAPI key: ").strip()
    
    if not newsapi_key:
        print_warning("No NewsAPI key provided. The local crawler will be used "
                      "unless you add a key later in backend/config.yaml")
        newsapi_key = "YOUR_NEWSAPI_KEY_HERE"

    # Create backend/config.yaml
    config_content = f"""# Neuzo Configuration File
# Secrets can be overridden via environment variables - see backend/.env.example

database:
  host: "localhost"
  port: 3306
  database: "neuzo_db"
  user: "root"
  password: "{mysql_password}"
  pool_size: 5
  pool_recycle: 3600

news_api:
  api_key: "{newsapi_key}"

# newsapi | crawler | auto
news_pipeline:
  provider: "auto"

# Local LLM used only by the news crawler
ollama:
  enabled: true
  host: "http://localhost:11434"
  model: "gemma4:e4b"
  timeout_seconds: 60

session:
  expiry_hours: 24

time_window_hours: 1

nlp:
  model_name: "sentence-transformers/all-MiniLM-L6-v2"
  similarity_threshold: 0.7

document:
  output_dir: "output"

agents:
  max_news_items: 20
  verification_depth: 3
"""

    with open(config_path, "w") as f:
        f.write(config_content)

    print_success("Configuration file created")
    return True

def setup_database():
    """Setup MySQL database and import schema"""
    print_step("Step 8: Setting Up Database")
    
    import yaml

    # Load config
    with open("backend/config.yaml", "r") as f:
        config = yaml.safe_load(f)
    
    db_config = config['database']
    
    # Test MySQL connection
    print_info("Testing MySQL connection...")
    test_cmd = f'mysql -u {db_config["user"]} -p{db_config["password"]} -e "SELECT 1;"'
    
    if not run_command(test_cmd, check=False):
        print_error("Failed to connect to MySQL. Check your password in config.yaml")
        return False
    
    print_success("MySQL connection successful")
    
    # Create database
    print_info(f"Creating database '{db_config['database']}'...")
    create_db_cmd = f'mysql -u {db_config["user"]} -p{db_config["password"]} -e "CREATE DATABASE IF NOT EXISTS {db_config["database"]};"'
    
    if not run_command(create_db_cmd):
        print_error("Failed to create database")
        return False
    
    print_success("Database created")
    
    # Import schema
    print_info("Importing database schema...")
    schema_path = Path("backend/database_schema.sql")

    if not schema_path.exists():
        print_error("backend/database_schema.sql not found")
        return False

    import_cmd = f'mysql -u {db_config["user"]} -p{db_config["password"]} {db_config["database"]} < backend/database_schema.sql'
    
    if not run_command(import_cmd):
        print_error("Failed to import schema")
        return False
    
    print_success("Database schema imported")
    print_success("Sample data loaded (6 categories, 42 news sources)")
    
    return True

def create_output_directory():
    """Create output directory for generated documents"""
    print_step("Step 9: Creating Output Directory")

    output_dir = Path("backend/output")
    output_dir.mkdir(parents=True, exist_ok=True)

    print_success("Output directory ready")
    return True

def create_test_user():
    """Create the documented test account (test@neuzo.com / test123)"""
    print_step("Step 10: Creating Test User")

    is_windows = platform.system() == "Windows"
    python_path = ".venv\\Scripts\\python.exe" if is_windows else ".venv/bin/python"

    snippet = (
        "import sys; sys.path.insert(0, 'backend'); "
        "from models import User; "
        "uid = User.create('test@neuzo.com', 'test123', 'Test User'); "
        "print('created' if uid else 'exists')"
    )

    result = run_command(f'"{python_path}" -c "{snippet}"', check=False, capture_output=True)
    if result == 'created':
        print_success("Test user created (test@neuzo.com / test123)")
    elif result == 'exists':
        print_warning("Test user already exists, skipping")
    else:
        print_warning("Could not create test user automatically - sign up via the UI instead")
    return True

def print_completion_message():
    """Print setup completion message with next steps"""
    print_step("🎉 Setup Complete!")
    
    is_windows = platform.system() == "Windows"
    activate_cmd = ".venv\\Scripts\\Activate.ps1" if is_windows else "source .venv/bin/activate"
    
    print(f"""
{Colors.OKGREEN}Neuzo has been successfully installed!{Colors.ENDC}

{Colors.BOLD}Next Steps:{Colors.ENDC}

1. Start the Backend Server:
   {Colors.OKCYAN}# Activate virtual environment{Colors.ENDC}
   {activate_cmd}
   
   {Colors.OKCYAN}# Run Flask server{Colors.ENDC}
   python backend/api_server.py

2. Start the Frontend (in a new terminal):
   {Colors.OKCYAN}cd Frontend{Colors.ENDC}
   {Colors.OKCYAN}npm run dev{Colors.ENDC}

3. Access the Application:
   {Colors.OKCYAN}http://localhost:3000{Colors.ENDC}

4. Default Login Credentials:
   {Colors.OKCYAN}Email: test@neuzo.com{Colors.ENDC}
   {Colors.OKCYAN}Password: test123{Colors.ENDC}

{Colors.BOLD}Configuration:{Colors.ENDC}
- Edit {Colors.OKCYAN}backend/config.yaml{Colors.ENDC} to change settings
- Add your NewsAPI key, or rely on the local crawler (Ollama + gemma4:e4b)
- Database credentials are already configured

{Colors.BOLD}Documentation:{Colors.ENDC}
- Full documentation: {Colors.OKCYAN}README.md{Colors.ENDC}
- Database schema: {Colors.OKCYAN}backend/database_schema.sql{Colors.ENDC}

{Colors.WARNING}Important Notes:{Colors.ENDC}
- Make sure both backend (5000) and frontend (3000) servers are running
- NewsAPI free tier: 100 requests/day (the crawler has no quota)
- Reports are saved in the {Colors.OKCYAN}backend/output/{Colors.ENDC} directory

{Colors.OKGREEN}Happy news hunting with Neuzo! 🚀{Colors.ENDC}
""")

def main():
    """Main setup function"""
    # Anchor all relative paths to the repository root
    os.chdir(Path(__file__).resolve().parent)

    print(f"""
{Colors.HEADER}{Colors.BOLD}
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║              NEUZO SETUP & INSTALLATION                   ║
║          Agentic News Bot - Automated Installer           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
{Colors.ENDC}
""")
    
    # Check prerequisites
    if not check_python_version():
        sys.exit(1)
    
    if not check_node_version():
        sys.exit(1)
    
    if not check_mysql():
        print_warning("Continuing without MySQL check. Make sure it's running!")
        response = input("Continue anyway? (y/n): ").lower()
        if response != 'y':
            sys.exit(1)
    
    # Setup steps
    steps = [
        create_virtual_environment,
        install_python_dependencies,
        install_frontend_dependencies,
        setup_configuration,
        setup_database,
        create_output_directory,
        create_test_user
    ]
    
    for step in steps:
        if not step():
            print_error(f"\nSetup failed at: {step.__name__}")
            print_info("Please fix the error and run setup.py again")
            sys.exit(1)
    
    # Success!
    print_completion_message()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print_error("\n\nSetup cancelled by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"\n\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
