@echo off
cd /d "%~dp0"
echo Open Chrome at http://localhost:8000/login.html
echo Press Ctrl+C to stop Carebidge.
node serve.mjs
pause
