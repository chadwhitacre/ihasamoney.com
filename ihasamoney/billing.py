"""This module encapsulates billing logic and db access.

There are four pieces of information for each customer related to billing:

    payment_method_token    NULL - This customer has never been billed, even 
                                unsuccessfully.
                            'deadbeef' - This customer has been billed at least
                                once, possibly unsuccessfully. Samurai gives us
                                a so-called "pmt" no matter what garbage credit
                                card info we send to them. We keep it around so
                                that we can prepopulate the customer's payment 
                                details form even if it was unsuccessful last 
                                time around. We don't find out whether the pmt
                                is good until we actually try to charge against
                                it.

    day_of_month_to_bill    NULL - This customer has never been billed.
                            {1..31} - This customer, if to be billed, is to be 
                                billed on the given day each month (or the last
                                day of the month).

    last_bill_result        NULL - This customer is not currently being billed.
                            '' - This customer is in good standing.
                            <json> - A struct of errors encoded as JSON.

    next_bill_date          NULL - The customer is not scheduled to be billed.
                            < today - 
                            = today - The customer should be billed today.
                            > today - The customer is to be billed in the 
                                future.


Here are the possible states:

    payment_method_token day_of_month_to_bill last_bill_result next_bill_date
     ------------------   ------------------   --------------   ------------
           NULL                  NULL               NULL           NULL         payment form, no recurring
           NULL                  NULL               NULL           < today      ???
           NULL                  NULL               NULL           = today      ???
           NULL                  NULL               NULL           > today      ???
           NULL                  NULL               ''             NULL         ???
           NULL                  NULL               ''             < today      ???
           NULL                  NULL               ''             = today      ???
           NULL                  NULL               ''             > today      ???
           NULL                  NULL               <json>         NULL         ???
           NULL                  NULL               <json>         < today      ???
           NULL                  NULL               <json>         = today      ???
           NULL                  NULL               <json>         > today      ???
           NULL                  {1..31}            NULL           NULL         ???
           NULL                  {1..31}            NULL           < today      ???
           NULL                  {1..31}            NULL           = today      ???
           NULL                  {1..31}            NULL           > today      ???
           NULL                  {1..31}            ''             NULL         ???
           NULL                  {1..31}            ''             < today      ???
           NULL                  {1..31}            ''             = today      ???
           NULL                  {1..31}            ''             > today      ???
           NULL                  {1..31}            <json>         NULL         ???
           NULL                  {1..31}            <json>         < today      ???
           NULL                  {1..31}            <json>         = today      ???
           NULL                  {1..31}            <json>         > today      ???

    payment_method_token day_of_month_to_bill last_bill_result next_bill_date
     ------------------   ------------------   --------------   ------------
           'deadbeef'            NULL               NULL           NULL        
           'deadbeef'            NULL               NULL           < today
           'deadbeef'            NULL               NULL           = today
           'deadbeef'            NULL               NULL           > today
           'deadbeef'            NULL               ''             NULL   
           'deadbeef'            NULL               ''             < today
           'deadbeef'            NULL               ''             = today
           'deadbeef'            NULL               ''             > today
           'deadbeef'            NULL               <json>         NULL         yes 
           'deadbeef'            NULL               <json>         < today
           'deadbeef'            NULL               <json>         = today
           'deadbeef'            NULL               <json>         > today
           'deadbeef'            {1..31}            NULL           NULL    
           'deadbeef'            {1..31}            NULL           < today
           'deadbeef'            {1..31}            NULL           = today
           'deadbeef'            {1..31}            NULL           > today
           'deadbeef'            {1..31}            ''             NULL   
           'deadbeef'            {1..31}            ''             < today      yes 
           'deadbeef'            {1..31}            ''             = today      yes 
           'deadbeef'            {1..31}            ''             > today      yes 
           'deadbeef'            {1..31}            <json>         NULL   
           'deadbeef'            {1..31}            <json>         < today
           'deadbeef'            {1..31}            <json>         = today
           'deadbeef'            {1..31}            <json>         > today


Here are events affecting the system:

    - recurring billing
        customer is billed regularly
    - customer updates payment info
    - customer pauses billing
    - time marches on
        next_bill_date approaches, arrives, passes
        payment method token goes stale
            card expires
            available funds dry up
            address change
            etc.

"""
import datetime
import traceback

import ihasamoney
from aspen import json
from ihasamoney import db, log
from samurai.payment_method import PaymentMethod as SamuraiPaymentMethod
from samurai.processor import Processor


PAUSED = """\

    SELECT email, next_bill_date
      FROM customers 
     WHERE last_bill_result = NULL
       AND next_bill_date <= CURRENT_DATE 

"""

TURN_OFF_PAUSED = """\

    UPDATE customers 
       SET next_bill_date=NULL
     WHERE last_bill_result = NULL
       AND next_bill_date <= CURRENT_DATE 
 RETURNING email

"""

TO_BILL = """\

    SELECT email, payment_method_token, day_of_month_to_bill
      FROM customers
     WHERE last_bill_result = '' 
       AND next_bill_date <= CURRENT_DATE

"""

FAILURE = """\

    UPDATE customers
       SET payment_method_token=%s
         , last_bill_result=%s 
     WHERE email=%s

"""

SUCCESS = """\

    UPDATE customers
       SET payment_method_token=%s 
         , last_bill_result=''
         , next_bill_date=%s
     WHERE email=%s

"""

SUCCESS_WITH_DAY_OF_MONTH = """\

    UPDATE customers
       SET payment_method_token=%s 
         , day_of_month_to_bill=%s
         , last_bill_result=''
         , next_bill_date=%s
     WHERE email=%s

"""

PAUSE = """\

    UPDATE customers 
       SET last_bill_result=NULL 
     WHERE email=%s

"""

RESUME = """\

    UPDATE customers 
       SET payment_method_token=%s
         , last_bill_result=''
     WHERE email=%s

"""

def redact_pmt(session):
    """Given a session dict, redact the current pmt with Samurai.
    """
    pmt = session['payment_method_token'] 
    if pmt is not None:
        pm = PaymentMethod(pmt)
        if pm['payment_method_token']:
            pm._payment_method.redact()

def get_next_bill_date(day_of_month):
    """Given an int between 1 and 31, inclusive, return a datetime.date.

    This returns a date next month. If the desired day of the month doesn't
    exist for next month, return the last day of that month. Python handles
    leap years correctly. As I write this, tomorrow is February 29, 2012! :D

    """
    assert 1 <= day_of_month <= 31, day_of_month 

    # compute year and month
    today = datetime.date.today()
    year = today.year
    month = today.month
    if month == 12:
        year += 1
        month = 1
    else:
        month += 1

    # compute day by attempting to make a date
    day = day_of_month
    safety_belt = 5 # XXX tighten this up, but not without tests
    while safety_belt > 0:
        try:
            out = datetime.date(year, month, day)
            break
        except ValueError:
            day -= 1
            safety_belt -= 1
    assert safety_belt > 0, "date trouble: %s, %s, %s" % (year, month, day)

    return out


def do_daily_billing_run(amount):
    """Do a daily billing run. This is run with heroku scheduler.

    Customers to bill are those with a next_bill_date <= today and
    last_bill_result = '' (i.e., they've been billed at least once without
    errors and are scheduled to be billed again).

    If next_bill_date is <= today and last_bill_result is NULL, then that means
    the customer paused their billing, and we should set next_bill_date to NULL
    so that they are no longer billed nor seen as a potential to be billed (we
    kept next_bill_date intact until now in case they wanted to resume billing
    before the month was up). Do that before billing people, obviously, so we
    don't bill people with paused billing. That's kind of scary, actually.

    """
    print ("The following customers have paused their billing:")
    for customer in ihasamoney.db.fetchall(PAUSED):
        print " ", customer['email'], customer['next_bill_date']

    print
    print ("The following customers had paused their billing and it's now "
           "turned off:")
    for customer in ihasamoney.db.fetchall(TURN_OFF_PAUSED):
        print " ", customer['email']

    print
    print ("The following customers would be billed %s if we were billing them yet:" % str(amount))
    for customer in ihasamoney.db.fetchall(TO_BILL):
        pmt = customer['payment_method_token']
        print " ", customer['email'].ljust(36), pmt, amount
        try:
            errors = bill(customer, pmt, amount)
            if errors:
                print "billing failed: ", str(errors)
        except:
            print traceback.format_exc()
    

def bill(session, pmt, amount, day_of_month=None, redact=False):
    """Given a session, a payment method token, and an amount, return a dict.

    If day_of_month is None, then we expect 'day_of_month_to_bill' in session.
    Otherwise, day_of_month will be set as the canonical day of the month on
    which this customer is to be billed. We check that it is an integer between
    1 and 31, inclusive.

    This function mutates session, in order to keep it in sync with the
    database. In reality I don't expect to use this session downstream in the
    response cycle; a new one will be created on the next request.

    """
    assert day_of_month is None or (1 <= day_of_month <= 31), day_of_month 
    email = session['email']

    if redact:
        redact_pmt(session)

    # Here's where we actually depend on a third party, samurai.
    transaction = Processor.purchase(pmt, amount, custom=email)

    # XXX Race condition: If samurai fails us *and* postgres fails us, then
    # we'll have a bad record of the customer's billing attempt. We're
    # depending on Heroku Postgres' good graces here. How do we get around
    # that, a sentinal value in a column like 'started_billing' in Postgres?
    if transaction.errors:
        errors_json = json.dumps(transaction.errors)
        db.execute(FAILURE, (pmt, errors_json, email))

        # Keep the payment_method_token, don't reset it to None/NULL: It's
        # useful for loading the previous (bad) credit card info from Samurai
        # in order to prepopulate the form.
        session['payment_method_token'] = pmt
        session['day_of_month_to_bill'] = None
        session['last_bill_result'] = errors_json
        session['next_bill_date'] = None

        out = dict(transaction.errors)
    else:
        if day_of_month is None:
            day_of_month = session['day_of_month_to_bill'] # KeyError is a bug
            next_bill_date = get_next_bill_date(day_of_month)
            SQL = SUCCESS
            args = (pmt, next_bill_date, email)
        else:
            next_bill_date = get_next_bill_date(day_of_month)
            SQL = SUCCESS_WITH_DAY_OF_MONTH
            args = (pmt, day_of_month, next_bill_date, email)
        db.execute(SQL, args)

        session['payment_method_token'] = pmt
        session['day_of_month_to_bill'] = day_of_month
        session['last_bill_result'] = ''
        session['next_bill_date'] = next_bill_date

        out = dict()
    return out

def pause(session):
    """Given a session dict, return None.
    """
    email = session['email']
    db.execute(PAUSE, (email,))
    session['last_bill_result'] = None

def resume(session, pmt, amount):
    """Given a session dict, a pmt, and an amount, resume billing.

    This is called when the user paused billing but they still have some time
    left on their existing billing cycle. We don't want to re-bill them at this
    time, but we want to set last_bill_result from NULL to either '' or <json>.

    """
    # XXX What happens if a user in the wrong state crafts an HTTP request to 
    # trigger this?
    # XXX We should validate that the user is in a state that can proceed to 
    # this one.

    redact_pmt(session)

    email = session['email']
    transaction = Processor.authorize(pmt, amount, custom=email)
    if transaction.errors:
        errors_json = json.dumps(transaction.errors)
        db.execute(FAILURE, (pmt, errors_json, email))
        session['payment_method_token'] = pmt
        session['last_bill_result'] = errors_json
        out = dict(transaction.errors)
    else:
        transaction.reverse()
        db.execute(RESUME, (pmt, email,))
        session['payment_method_token'] = pmt
        session['last_bill_result'] = ''
        out = {}
    return out


# Payment Method
# ==============

class DummyPaymentMethod(dict):
    """Define a dict that can be used when Samurai is unavailable.
    """
    def __getitem__(self, name):
        return ''

class PaymentMethod(object):
    """This is a dict-like wrapper around a Samurai PaymentMethod.
    """

    _payment_method = None # underlying payment method

    def __init__(self, pmt):
        """Given a payment method token, loads data from Samurai.
        """
        if pmt is not None:
           self._payment_method = SamuraiPaymentMethod.find(pmt)

    def _get(self, name):
        """Given a name, return a string.
        """
        out = ""
        if self._payment_method is not None:
            out = getattr(self._payment_method, name, "")
            if out is None:
                out = ""
        return out

    def __getitem__(self, name):
        """Given a name, return a string.
        """
        if name == 'last_four':
            out = self._get('last_four_digits')
            if out:
                out = "************" + out
        elif name == 'expiry':
            month = self._get('expiry_month')
            year = self._get('expiry_year')

            # work around https://github.com/FeeFighters/samurai-client-python/issues/7
            if isinstance(month, dict): month = ''
            if isinstance(year, dict):  year = ''

            if month and year:
                out = "%d/%d" % (month, year)
            else:
                out = ""
        else:
            out = self._get(name)
        return out
