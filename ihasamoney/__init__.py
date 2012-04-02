import decimal
import logging
import os
import traceback
import urlparse
from contextlib import contextmanager

from ihasamoney.version import __version__


db = None # This global is wired below. It's an instance of 
          # ihasamoney.postgres.PostgresManager.
amount = None # wired below; amount to bill per month
log = logging.getLogger('ihasamoney')


# canonizer
# =========
# This is an Aspen hook to ensure that requests are served on a certain root
# URL, even if multiple domains point to the application.

class X: pass
canonical_scheme = None
canonical_host = None

def canonize(request):
    """Enforce a certain scheme and hostname. Store these on request as well.
    """
    scheme = request.environ.get('HTTP_X_FORWARDED_PROTO', 'http') # per Heroku
    host = request.headers.one('Host')
    bad_scheme = scheme != canonical_scheme
    bad_host = bool(canonical_host) and (host != canonical_host) 
                # '' and False => ''
    if bad_scheme or bad_host:
        url = '%s://%s/' % (canonical_scheme, canonical_host)
        request.redirect(url, permanent=True)
    request.x = X()
    request.x.scheme = scheme
    request.x.host = host
    request.x.base = scheme + "://" + host


# wireup
# ======
# Define some methods to be run via the Aspen startup hook. BTW, Aspen hooks
# are configured in www/.aspen/hooks.conf.

def wire_amount():
    # Samurai uses the penny code to trigger certain responses, so we want
    # some control over it in development.
    global amount
    amount = os.environ['SUBSCRIPTION_AMOUNT']
    print "wiring amount as", amount

def wire_canonical():
    global canonical_scheme, canonical_host
    canonical_scheme = os.environ['CANONICAL_SCHEME']
    canonical_host = os.environ['CANONICAL_HOST']

def wire_db():
    global db
    from ihasamoney.postgres import PostgresManager
    dburl = os.environ['DATABASE_URL']
    db = PostgresManager(dburl)

def wire_samurai():
    import samurai.config
    samurai.config.merchant_key = os.environ['SAMURAI_MERCHANT_KEY']
    samurai.config.merchant_password = os.environ['SAMURAI_MERCHANT_PASSWORD']
    samurai.config.processor_token = os.environ['SAMURAI_PROCESSOR_TOKEN']

def startup(website):
    """Wire up some globals and store amount on website.
    """
    wire_amount()
    wire_canonical()
    wire_db()
    wire_samurai()

    website.subscription_amount = decimal.Decimal(amount)
