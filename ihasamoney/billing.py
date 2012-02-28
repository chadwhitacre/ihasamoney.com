import datetime

from aspen import json
from ihasamoney import db, get_next_bill_date
from samurai.processor import Processor


FAILURE = """\

    UPDATE customers
       SET payment_method_token=%s
         , day_of_month_to_bill=NULL
         , last_bill_result=%s 
         , next_bill_date=NULL
     WHERE session_token=%s;

"""

SUCCESS = """\

    UPDATE customers
       SET payment_method_token=%s 
         , last_bill_result=''
         , next_bill_date=%s
     WHERE session_token=%s;

"""

SUCCESS_WITH_DAY_OF_MONTH = """\

    UPDATE customers
       SET payment_method_token=%s 
         , day_of_month_to_bill=%s
         , last_bill_result=''
         , next_bill_date=%s
     WHERE session_token=%s;

"""


def get_next_bill_date(session, day_of_month):
    """Given a session dict, return a datetime.date.

    If day_of_month is None, we will use session['day_of_month_to_bill']. In
    either case we expect it to be an integer between 1 and 31, inclusive.

    This returns a date next month. If the desired day of the month doesn't
    exist for next month, return the last day of that month. Python handles
    leap years correctly. As I write this, tomorrow is February 29, 2012! :D

    """
    if day_of_month is None:
        day_of_month = session['day_of_month_to_bill'] # KeyError is a bug
    assert 1 <= day_of_month <= 31, day_of_month 

    # compute year and month
    today = datetime.date.today()
    year = today.year
    month = today.month
    if month == 12:
        year += 1
        month = 1

    # compute day by attempting to make a date
    day = day_of_month
    safety_belt = 5
    while safety_belt > 0:
        try:
            out = datetime.date(year, month, day)
            break
        except ValueError:
            day -= 1
            safety_belt -= 1
    assert safety_belt > 0, "date trouble: %s, %s, %s" % (year, month, day)

    return out

def bill(session, pmt, amount, day_of_month=None):
    """Given a session, a payment method token, and an amount, return a dict.

    If day_of_month is not None, then that will be set as the canonical day of
    the month on which this customer is to be billed. It is assumed to be an
    integer between 1 and 31 inclusive.

    This function mutates session, in order to keep it in sync with the
    database. In reality I don't expect to use this session downstream in the
    response cycle; a new one will be created on the next request.

    """
    assert day_of_month is None or 1 <= day_of_month <= 31, day_of_month 
    session_token = session['session_token']

    transaction = Processor.purchase(pmt, amount)
    if transaction.errors:
        errors_json = json.dumps(transaction.errors)
        db.execute(FAILURE, (pmt, errors_json, session_token))

        # Keep the payment_method_token, don't reset it to None/NULL: It's
        # useful for loading the previous (bad) credit card info from Samurai
        # in order to prepopulate the form.
        session['payment_method_token'] = pmt
        session['day_of_month_to_bill'] = None
        session['last_bill_result'] = errors_json
        session['next_bill_date'] = None

        out = dict(transaction.errors)
    else:
        next_bill_date = get_next_bill_date(session, day_of_month)
        if day_of_month is None:
            SQL = SUCCESS
            args = (pmt, next_bill_date, session_token)
        else:
            SQL = SUCCESS_WITH_DAY_OF_MONTH
            args = (pmt, day_of_month, next_bill_date, session_token)
        db.execute(SQL, args)

        session['payment_method_token'] = pmt
        session['day_of_month_to_bill'] = day_of_month
        session['last_bill_result'] = ''
        session['next_bill_date'] = next_bill_date

        out = dict()
    return out
