@echo off
cd /d C:\Users\User\Documents\GitHub\Spider0

echo ==== Проверка git ====
git status

echo ==== Текущие remote ====
git remote -v

echo ==== Удаляем старый amvera remote, если был ====
git remote remove amvera 2>nul

echo ==== Добавляем новый amvera remote ====
git remote add amvera https://git.ms0.amvera.ru/spider0/spider0

echo ==== Проверяем remote ====
git remote -v

pause