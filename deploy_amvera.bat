@echo off
cd /d C:\Users\User\Documents\GitHub\Spider0

echo ===== Проверка git =====
git status

echo ===== Добавляем изменения =====
git add .

echo ===== Коммит =====
git commit -m "deploy to amvera"

echo ===== Отправка в Amvera =====
git push amvera main

echo ===== ГОТОВО =====
pause