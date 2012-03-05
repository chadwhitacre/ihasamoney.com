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
        out = ("&nbsp;" * 6) + "0" + ("&nbsp;" * 3)
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

def gentxns(txns):
    curdate = 0000, 00, 00
    for row in txns:

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

        category = row['category'] # This comes out as a single string or None,
                                   # not (e.g.) a list of strings, if there is 
                                   # only one category. And our UI assures that
                                   # there is only one category.

        if category is None:
            category = "uncategorized"

        yield row['id'], amount, row['description'], date, category


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
    categories = [(-1, 'uncategorized')]
    categories += [(x['id'], x['category']) for x in get_categories(email)]

    transactions = list(db.fetchall("""

        SELECT id
             , email
             , date
             , amount
             , description
             , (  SELECT categories.category
                    FROM categories
                    JOIN categorizations
                      ON categorizations.category_id = categories.id
                   WHERE categorizations.transaction_id = transactions.id
                ) as category -- a single category, it turns out
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
    summary['uncategorized'] = commaize(uncategorized_sum)

    return categories, transactions, summary


# Fake Data
# =========
# Anonymous gets a bunch of fake data to play with.

class Transactions(list):

    id = 0
    this_month = date.today().month
    def add_transaction(self, date, amount, payee, type, category):
        category = "uncategorized" if date.month == self.this_month else category
        self.append({ "id": self.id
                    , "date": date
                    , "amount": decimal.Decimal(amount)
                    , "description": payee + " " + type
                    , "category": category
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
        { "food":          0.101,
          "housing":       0.278,
          "utilities":     0.056,
          "clothing":      0.031,
          "transportation":0.144,
          "health":        0.047,
          "entertainment": 0.044,
          "gifts":         0.020,
          "education":     0.016,
          "fees":          0.026 }


    # How much do people spend per transaction?  This is taken from
    # the category_summaries table in the live database.

    avg_txn_amts = \
        { "transportation":-70.77,
          "clothing":      -58.31,
          "education":     -62.64,
          "entertainment": -30.10,
          "fees":          -20.95,
          "food":          -25.52,
          "gifts":         -18.84,
          "health":        -73.05,
          "mortgage":      -1168.49,
          "rent":          -643.30,
          "utilities":     -90.81 }


    # For now, just throw in some merchant names for each category. Later
    # this should come from the merchant_summaries table.

    top_merchants = \
        { "transportation":["Chevron", "Jiffy Lube", "Union 76", "Arco", 
                            "Shell", "Pep Boys"],
          "clothing":      ["Nordstrom", "Banana Republic", "Macy's", 
                            "The Gap", "Kenneth Cole", "J. Crew"],
          "education":     ["Tuition", "Amazon.com", "Registration", 
                            "The Crucible", "Campus Books"],
          "entertainment": ["AMC Theaters", "Amazon.com", "Netflix", 
                            "iTunes Music Store", "Rhapsody", 
                            "Metreon Theaters"],
          "fees":          ["Bank Fee", "Overlimit Fee", "Late Fee", 
                            "Interest Fee", "Monthly Fee", "Annual Fee"],
          "food":          ["Safeway", "Starbucks", "In-N-Out Burger", 
                            "Trader Joe's", "Whole Foods", "Olive Garden"],
          "gifts":         ["Amazon.com", "Nordstrom", "Neiman-Marcus", 
                            "Apple Store", "K&L Wines"],
          "health":        ["Dr. Phillips", "Dr. Jackson", "Walgreen's", 
                            "Wal-Mart", "Dr. Roberts", "Dr. Martins"],
          "mortgage":      ["Mortgage Payment"],
          "rent":          ["Rent Payment"],
          "utilities":     ["AT&T", "Verizon", "PG&E", "Comcast", "Brinks", ""]
         }


    # Make up a positive balance.

    balance = "%.02f" % generate_amt(1000)

    def generate_transaction(transactions, category, type, date=None):
        if date is None:
            days_ago = timedelta(days=random.randint(0, days))
            date = (end_date - days_ago)
        
        amount = generate_amt(avg_txn_amts[category])
        txn_amt = decimal.Decimal("%.02f" % amount)
        
        merchant = random.choice(top_merchants[category])
        
        transactions.add_transaction(date, txn_amt, merchant, type, category)
        return txn_amt

    categories = spending_pcts.keys()
    categories.remove("housing")
    categories.append("income")
    categories.append("uncategorized")
    summary = dict([(t, 0) for t in categories])


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
                                    , category="income"
                                     )
    summary["income"] = commaize(income_amount)


    # Then deal with housing

    housing_category = random.choice(["rent", "mortgage"])

    housing_days_ago = 0

    while housing_days_ago < days:
        housing_days_ago += 30
        last_housing = (end_date - timedelta(days=housing_days_ago))
        amount = generate_transaction(transactions, housing_category, "DEBIT")
        total_spending -= abs(amount)


    # Now deal with the rest of the categories
   
    housing_spending = total_spending
    for category in categories:
        if category in ["income"]:
            continue
        category_spending = total_spending * decimal.Decimal(spending_pcts.get(category, 0))
        category_amount = 0
        while category_spending > 0 and total_spending > 0:
            amount = generate_transaction(transactions, category, "DEBIT")
            category_amount += amount
            category_spending   -= abs(amount)
            total_spending -= abs(amount)
        summary[category] = commaize(decimal.Decimal("%.02f" % category_amount))
    categories.append(housing_category)
    summary[housing_category] = commaize(decimal.Decimal("-%.02f" % housing_spending))

    
    # And lastly, summarize transactions.

    uncat = [t['amount'] for t in transactions if t['category'] == "uncategorized"]
    summary["uncategorized"] = commaize(sum(uncat))


    # Prep our return structure.

    categories.remove("uncategorized")
    categories.remove("income")
    categories = ["uncategorized", "income"] + sorted(categories)
    transactions = sorted(transactions, key=lambda t: t["date"], reverse=True)
    balance = decimal.Decimal(balance) + total_spending

    return (categories, transactions, summary, balance)
