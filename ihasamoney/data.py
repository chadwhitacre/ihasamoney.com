import decimal 
import random

from datetime import date
from datetime import timedelta
from ihasamoney import db


months = ["", "Jan", "Feb","Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep",
        "Oct", "Nov", "Dec"]

def commaize(amount):
    """Given a 2-decimal number, return it with commas padded to 11.
    """
    if isinstance(amount, decimal.Decimal):
        amount = "%.02f" % amount
    if amount == 0:
        out = ("&nbsp;" * 7) + "0" + ("&nbsp;" * 3)
    else:
        negative = amount.startswith('-')
        if negative:
            amount = amount[1:]
        if len(amount) <= 6: # 100.00, no comma needed
            out = amount
        else:
            whole, fraction = amount.split('.')
            whole = list(whole)
            out = '.' + fraction
            i = 1 
            while whole:
                out = whole.pop() + out
                if i % 3 == 0:
                    out = ',' + out
                i += 1
        if negative:
            out = "-" + out
        out = out.lstrip(',')
    out = ((11 - len(out)) * "&nbsp;") + out # this fits up to -999,999.99
    return out

def gentxns(txns, cid=None):
    curdate = 0000, 00, 00
    for row in txns:
        
        if row['cid'] is None:
            row['cid'] = -1 # uncategorized
        # This comes out as a single int or None, not (e.g.) a list of ints, if
        # there is only one category. And our UI assures that there is only one
        # category.
        if cid is not None and row['cid'] != cid:
            continue


        # red hot, baby!
        d = row['date']
        year, month, day = d.year, d.month, d.day
        if (year, month, day) == curdate:
            date = ('<td class="date year"><span class="hide">%04d</span></td>'
                    '<td class="date month"><span class="hide">%s</span></td>'
                    '<td class="date day"><span class="hide">%02d</span></td>')
        elif (year, month) == curdate[:2]:
            date = ('<td class="date year"><span class="hide">%04d</span></td>'
                    '<td class="date month"><span class="hide">%s</span></td>'
                    '<td class="date day">%02d</td>')
        elif (year,) == curdate[:1]:
            date = ('<td class="date year"><span class="hide">%04d</span></td>'
                    '<td class="date month">%s</td>'
                    '<td class="date day">%02d</td>')
        else:
            date = ('<td class="date year">%04d</td>'
                    '<td class="date month">%s</td>'
                    '<td class="date day">%02d</td>')
        date %= (year, months[month], day)
        date = date.replace('>0', '>&nbsp;')
        date = date.replace(' 0', '&nbsp;&nbsp;')
        curdate = (year, month, day)

        amount = commaize(str(row['amount']))

        if cid is None:
            yield row['id'], amount, row['description'], date, row['cid']
        else:
            yield row['id'], amount, row['description'], date


# Real Data
# =========
# Actual customers get actual data. It's only fair.

def get_categories(email):
    categories = """\
            
        SELECT id, category
          FROM categories 
         WHERE email = %s 
      ORDER BY category ASC

    """
    return db.fetchall(categories, (email,))

def get(email):
    """Return data for the given user.
    """
    categories = [(-1, 'Uncategorized')]
    categories += [(x['id'], x['category']) for x in get_categories(email)]

    transactions = list(db.fetchall("""

        SELECT id
             , email
             , date
             , amount
             , description
             , (  SELECT categories.id
                    FROM categories
                    JOIN categorizations
                      ON categorizations.category_id = categories.id
                   WHERE categorizations.transaction_id = transactions.id
                ) as cid -- a single category, it turns out
          FROM transactions 
         WHERE email=%s 
      ORDER BY date DESC
      
        """, (email,)))

    sums = db.fetchall("""
        
        SELECT categories.category      AS category
             , sum(transactions.amount) AS sum
          FROM transactions 
          JOIN categorizations 
            ON categorizations.transaction_id = transactions.id 
          JOIN categories 
            ON categories.id = categorizations.category_id 
         WHERE transactions.email = %s
      GROUP BY category
      ORDER BY category

            """, (email,))
    summary = dict([(category, commaize(0)) for id, category in categories])
    for row in sums:
        summary[row['category']] = commaize(row['sum'])

    uncategorized = db.fetchone("""
        
        SELECT sum(transactions.amount) AS sum
          FROM transactions 
     LEFT JOIN categorizations 
            ON transactions.id = categorizations.transaction_id
         WHERE transactions.email = %s
           AND categorizations.id is NULL

            """, (email,))

    uncategorized_sum = uncategorized['sum']
    if uncategorized_sum is None:
        uncategorized_sum = 0
    summary['Uncategorized'] = commaize(uncategorized_sum)

    return categories, transactions, summary


# Fake Data
# =========
# Anonymous gets a bunch of fake data to play with.

class Transactions(list):

    id = 0
    this_month = date.today().month
    def add_transaction(self, date, amount, payee, type, cid):
        cid = -1 if date.month == self.this_month else cid
        self.append({ "id": self.id
                    , "date": date
                    , "amount": decimal.Decimal(amount)
                    , "description": payee + " " + type
                    , "cid": cid 
                     })
        self.id += 1


def fake():
    """Return sum dayz of fake data.
    """
    categories = []
    transactions = Transactions()
    summary = []

    def generate_amt(base_amt):
        return random.uniform((base_amt * 0.6), (base_amt * 1.4))


    # How long should this statement be?

    days = 90
    end_date = date.today()


    # How much spending should the statement represent?

    income = 85000
    take_home_pay = income * .6
    paycheck_amt = "%.02f" % (take_home_pay / 26)
    daily_income = take_home_pay / 365


    # Assume that people spend their whole income.  At least.

    total_spending = decimal.Decimal(daily_income * days)


    # How do people usually spend their money?  Taken from
    # http://www.billshrink.com/blog/consumer-income-spending/
    # The feess number is made up, but seemed appropriate.

    spending_pcts = \
        { "Food":          0.101,
          "Housing":       0.278,
          "Utilities":     0.056,
          "Clothing":      0.031,
          "Transportation":0.144,
          "Health":        0.047,
          "Entertainment": 0.044,
          "Gifts":         0.020,
          "Education":     0.016,
          "Fees":          0.026 }


    # How much do people spend per transaction?  This is taken from
    # the category_summaries table in the live database.

    avg_txn_amts = \
        { "Transportation":-70.77,
          "Clothing":      -58.31,
          "Education":     -62.64,
          "Entertainment": -30.10,
          "Fees":          -20.95,
          "Food":          -25.52,
          "Gifts":         -18.84,
          "Health":        -73.05,
          "Mortgage":      -1168.49,
          "Rent":          -643.30,
          "Utilities":     -90.81 }


    # For now, just throw in some merchant names for each category. Later
    # this should come from the merchant_summaries table.

    top_merchants = \
        { "Transportation":["Chevron", "Jiffy Lube", "Union 76", "Arco", 
                            "Shell", "Pep Boys"],
          "Clothing":      ["Nordstrom", "Banana Republic", "Macy's", 
                            "The Gap", "Kenneth Cole", "J. Crew"],
          "Education":     ["Tuition", "Amazon.com", "Registration", 
                            "The Crucible", "Campus Books"],
          "Entertainment": ["AMC Theaters", "Amazon.com", "Netflix", 
                            "iTunes Music Store", "Rhapsody", 
                            "Metreon Theaters"],
          "Fees":          ["Bank Fee", "Overlimit Fee", "Late Fee", 
                            "Interest Fee", "Monthly Fee", "Annual Fee"],
          "Food":          ["Safeway", "Starbucks", "In-N-Out Burger", 
                            "Trader Joe's", "Whole Foods", "Olive Garden"],
          "Gifts":         ["Amazon.com", "Nordstrom", "Neiman-Marcus", 
                            "Apple Store", "K&L Wines"],
          "Health":        ["Dr. Phillips", "Dr. Jackson", "Walgreen's", 
                            "Wal-Mart", "Dr. Roberts", "Dr. Martins"],
          "Mortgage":      ["Mortgage Payment"],
          "Rent":          ["Rent Payment"],
          "Utilities":     ["AT&T", "Verizon", "PG&E", "Comcast", "Brinks", ""]
         }


    # Make up a positive balance.

    balance = "%.02f" % generate_amt(1000)

    def generate_transaction(transactions, cid, category, type, date=None):
        if date is None:
            days_ago = timedelta(days=random.randint(0, days))
            date = (end_date - days_ago)
        
        amount = generate_amt(avg_txn_amts[category])
        txn_amt = decimal.Decimal("%.02f" % amount)
        
        merchant = random.choice(top_merchants[category])
        
        transactions.add_transaction(date, txn_amt, merchant, type, cid)
        return txn_amt

    categories = list(enumerate(spending_pcts.keys()))

    categories.remove((6, "Housing"))
    categories.append((10, "Income"))
    categories.append((-1, "Uncategorized"))
    summary = dict([(t[1], 0) for t in categories])


    # First deal with income

    pay_days_ago = 0
    income_amount = 0

    while pay_days_ago < days:
        pay_days_ago += 15
        payday = (end_date - timedelta(days=pay_days_ago))
        income_amount += decimal.Decimal(paycheck_amt)
        transactions.add_transaction( date=payday
                                    , amount=paycheck_amt
                                    , payee="Payroll"
                                    , type="DEP"
                                    , cid=10
                                     )
    summary["Income"] = commaize(income_amount)


    # Then deal with housing

    housing_category = random.choice(["Rent", "Mortgage"])
    housing_days_ago = 0
    housing_spending = decimal.Decimal(0)
    while housing_days_ago < days:
        housing_days_ago += 30
        last_housing = (end_date - timedelta(days=housing_days_ago))
        amount = generate_transaction(transactions, 6, housing_category, "DEBIT")
        total_spending -= abs(amount)
        housing_spending += amount


    # Now deal with the rest of the categories
   
    for cid, category in categories:
        if category in ["Income"]:
            continue
        category_spending = total_spending * decimal.Decimal(spending_pcts.get(category, 0))
        category_amount = 0
        while category_spending > 0 and total_spending > 0:
            amount = generate_transaction(transactions, cid, category, "DEBIT")
            category_amount += amount
            category_spending -= abs(amount)
            total_spending -= abs(amount)
        summary[category] = commaize(decimal.Decimal("%.02f" % category_amount))
    categories.append((6, housing_category))
    summary[housing_category] = commaize(housing_spending)

    
    # And lastly, summarize uncategorized transactions.

    uncat = [t['amount'] for t in transactions if t['cid'] == -1]
    summary["Uncategorized"] = commaize(sum(uncat))


    # Prep our return structure.

    categories.remove((-1, "Uncategorized"))
    categories = [(-1, "Uncategorized")] + sorted(categories, key=lambda c: c[1])
    transactions = sorted(transactions, key=lambda t: t["date"], reverse=True)
    balance = decimal.Decimal(balance) + total_spending

    return (categories, transactions, summary, balance)
