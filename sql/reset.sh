#!/bin/sh
set -e
sudo -u postgres psql < 0000.sql 
sudo -u postgres psql -d ihazmoney < 0001.sql 
sudo -u postgres psql -d ihazmoney < 0002.sql 
