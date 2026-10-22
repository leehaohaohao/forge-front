@echo off
wsl.exe -d Ubuntu-24.04 --cd /home/lihao/projects/forge-front -- env PATH=/home/lihao/.local/bin:/usr/local/bin:/usr/bin:/bin /home/lihao/.local/bin/npm run dev
