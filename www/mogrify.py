#!/usr/bin/env python
import csv
import sys


# Use stdio.
# ==========
# So you would call this script like so:
#
#   ./mogrify < BANK.CSV > forIHasAMoney.csv
#
# Then you would upload forIHasAMoney.csv to IHasAMoney.com.

input = csv.reader(sys.stdin)
output = csv.writer(sys.stdout)


# Dispose of headers.
# ===================

headers = input.next()


# Reverse the transactions.
# =========================
# This way, we keep the ids consistent as long as transactions are only 
# appended to BANK.CSV.

rows = reversed(list(input))


# Convert the input CSV to IHasAMoney.com format.
# ===============================================
# The input format here is from www.citizensbank.com, which happens to be my 
# personal bank.

for i, row in enumerate(rows):
    i = str(i)
    assert len(i) <= 7
    id = "1" + i.zfill(7)
    month, day, year = row[1].split("/") 
    year = "20" + year # 2-digit year, really?
    date = year + month.zfill(2) + day.zfill(2)
    amount = row[4] 
    description = "%s (%s)" % (row[3], row[0])
    description = " ".join(description.split()) # fold multiple whitespace
    description = description.lower()
    output.writerow((id, date, amount, description))
