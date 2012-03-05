import logging
import os
import rfc822
import time
import uuid
from hashlib import sha1


log = logging.getLogger('ihasamoney.authentication')
sessions = {}
BEGINNING_OF_EPOCH = rfc822.formatdate(0)
TIMEOUT = 60 * 60 * 24 * 7 # one week

salt = os.environ['SALT']

def hash(password):
    return sha1(password + salt).hexdigest()

def authentic(email, password):
    from ihasamoney import db
    SQL = ("SELECT email FROM customers WHERE email=%s AND password_hash=%s")
    password_hash = hash(password)
    rec = db.fetchone(SQL, (email, password_hash))
    return rec is not None

def sign_in(email, password):
    from ihasamoney import db
    SQL = ("UPDATE customers SET session_token=%s "
           "WHERE email=%s AND password_hash=%s RETURNING *")
    token = str(uuid.uuid4())
    password_hash = hash(password)
    rec = db.fetchone(SQL, (token, email, password_hash))
    if rec is not None:
        del rec['password_hash'] # safety
        return rec
    return {}

def load_session(token):
    from ihasamoney import db
    SQL = """\
        SELECT email
             , session_token
             , session_expires
             , created
             , is_admin
             , payment_method_token
             , day_of_month_to_bill
             , next_bill_date
             , last_bill_result
             , balance 
          FROM customers 
         WHERE session_token=%s
    """
    rec = db.fetchone(SQL, (token,))
    out = {}
    if rec is not None:
        assert rec['session_token'] == token # sanity
        assert 'password_hash' not in rec # safety
        out = rec
    return out

class User:

    def __init__(self, session):
        """Takes a dict of user info.
        """
        self.session = session

    def __str__(self):
        return '<User: %s>' % getattr(self, 'email', 'Anonymous')

    @property
    def ADMIN(self):
        return bool(self.session.get('is_admin', False))

    @property
    def ANON(self):
        return not bool(self.session.get('email', False))

    @property
    def PAID(self):
        """A boolean indicating whether the customer is in good standing.

        We base this determination on the last_bill_result field. Billing code
        should set this to a non-empty string in any case where an attempt to
        bill the customer failed.

        """
        if self.session.get('last_bill_result', None) is None:
            return False
        return self.session['last_bill_result'] == ""

def inbound(request):
    """Authenticate from a cookie.
    """
    session = {}
    if 'session' in request.cookie:
        token = request.cookie['session'].value
        session = load_session(token)
    request.user = User(session)

def outbound(response):
    session = {}
    if hasattr(response.request, 'user'):
        session = response.request.user.session
    if not session:                                 # user is anonymous
        if 'session' not in response.request.cookie:
            # no cookie in the request, don't set one on response
            return
        else:
            # expired cookie in the request, instruct browser to delete it
            response.cookie['session'] = '' 
            expires = 0
    else:                                           # user is authenticated
        response.headers.set('Expires', BEGINNING_OF_EPOCH) # don't cache
        response.cookie['session'] = session['session_token']
        expires = session['session_expires'] = time.time() + TIMEOUT

    cookie = response.cookie['session']
    # I am not setting domain, because it is supposed to default to what we 
    # want: the domain of the object requested.
    #cookie['domain']
    cookie['path'] = '/'
    cookie['expires'] = rfc822.formatdate(expires)
    cookie['httponly'] = "Yes, please."
