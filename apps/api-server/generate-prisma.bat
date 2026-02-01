@echo off
cd /d "%~dp0"
call npm install
call node_modules\.bin\prisma.cmd generate --schema=prisma/schema.prisma
echo Prisma client generated successfully!
