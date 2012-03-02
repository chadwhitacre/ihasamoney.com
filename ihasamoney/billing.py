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

from aspen import json
from ihasamoney import db, log
from samurai.payment_method import PaymentMethod as SamuraiPaymentMethod
from samurai.processor import Processor


FAILURE = """\

    UPDATE customers
       SET payment_method_token=%s
         , last_bill_result=%s 
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

def get_next_bill_date(session, day_of_month):
    """Given a session dict, return a datetime.date.

    If day_of_month is None, we will use session['day_of_month_to_bill']. In
    either case, we expect it to be an integer between 1 and 31, inclusive.

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

def bill(session, pmt, amount, day_of_month=None):
    """Given a session, a payment method token, and an amount, return a dict.

    If day_of_month is not None, then that will be set as the canonical day of
    the month on which this customer is to be billed. It is assumed to be an
    integer between 1 and 31 inclusive.

    This function mutates session, in order to keep it in sync with the
    database. In reality I don't expect to use this session downstream in the
    response cycle; a new one will be created on the next request.

    """
    assert day_of_month is None or (1 <= day_of_month <= 31), day_of_month 
    session_token = session['session_token']
    email = session['email']

    redact_pmt(session)

    transaction = Processor.purchase(pmt, amount, custom=email)
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

    Our cron billing script should look for cases where next_bill_date is today
    and last_bill_result is NULL, and set next_bill_date to NULL for those
    cases.

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
        session_token = session['session_token']
        db.execute(FAILURE, (pmt, errors_json, session_token))
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
