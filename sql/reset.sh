#!/bin/sh
set -e
cd "`dirname $0`"
echo "sudo password, then postgres password ..."
sudo -u postgres psql < 0000.sql 
echo "postgres password again ..."
sudo -u postgres psql -d ihazmoney < 0001.sql 
echo "and again ..."
sudo -u postgres psql -d ihazmoney < 0002.sql 
