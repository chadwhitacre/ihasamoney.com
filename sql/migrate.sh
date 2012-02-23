#!/bin/sh
set -e
cd "`dirname $0`"
echo "sudo password, then postgres password ..."
sudo -u postgres psql -d ihasamoney < schema.sql 
echo "and again ..."
echo "BEGIN; SELECT migrate(); COMMIT;" | sudo -u postgres psql -d ihasamoney
