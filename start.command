#!/bin/bash
# Double-click to launch Drone Show Simulator on macOS.
# First run installs dependencies (needs Node.js 22+ and an internet connection).
cd "$(dirname "$0")" || exit 1

# Finder-launched scripts don't load your shell profile, so add the usual Node locations.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
fi

fail() {
  echo
  echo "$1"
  read -r -p "Press Return to close."
  exit 1
}

command -v npm >/dev/null 2>&1 || fail "Node.js is not installed. Install the LTS version from https://nodejs.org and try again."

if [ ! -d node_modules ]; then
  echo "Installing dependencies. This only happens the first time..."
  npm install || fail "Installing dependencies failed. See the messages above."
fi

if [ ! -d node_modules/electron/dist ]; then
  echo "Downloading Electron..."
  node node_modules/electron/install.js || fail "Downloading Electron failed. See the messages above."
fi

echo "Starting Drone Show Simulator..."
npm start || fail "The app stopped with an error. See the messages above."
