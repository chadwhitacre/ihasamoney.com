import decimal
import logging
import os
import traceback
import urlparse
from contextlib import contextmanager

from ihasamoney.version import __version__


db = None # This global is wired below. It's an instance of 
          # ihasamoney.postgres.PostgresManager.
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


# refererer
# =========
# Here's another Aspen hook. This one stashes away HTTP referers for the root
# page, so we can get an idea of where traffic is coming from.
                    
REFERER_INSERT = "INSERT INTO referers (referer) VALUES (%s)"
REFERER_UPDATE = """\

    UPDATE referers 
       SET count = ( SELECT count 
                       FROM referers 
                      WHERE referer = %s 
                        AND date = CURRENT_DATE
                    ) + 1 
     WHERE referer = %s
       AND date = CURRENT_DATE
 RETURNING 'updated' AS msg

"""

def refererer(request):
    """For requests for /, record the users referer header.
    """
    try:
        if request.path.raw == "/":
            referer = request.headers.one("Referer", "")
            exists = db.fetchone(REFERER_UPDATE, (referer, referer))
            if exists is None: # race condition here
                db.execute(REFERER_INSERT, (referer,))
    except: # We never want this to hurt us.
        log.warning(traceback.format_exc())


# wireup
# ======
# Define some methods to be run via the Aspen startup hook. BTW, Aspen hooks
# are configured in www/.aspen/hooks.conf.

def wire_db():
    from ihasamoney.postgres import PostgresManager
    dburl = os.environ['DATABASE_URL']
    return PostgresManager(dburl)

def wire_samurai():
    import samurai.config
    samurai.config.merchant_key = os.environ['SAMURAI_MERCHANT_KEY']
    samurai.config.merchant_password = os.environ['SAMURAI_MERCHANT_PASSWORD']
    samurai.config.processor_token = os.environ['SAMURAI_PROCESSOR_TOKEN']

def startup(website):
    """Set up db and gauges.
    """
    global db, canonical_scheme, canonical_host
    db = wire_db()

    canonical_scheme = os.environ['CANONICAL_SCHEME']
    canonical_host = os.environ['CANONICAL_HOST']

    wire_samurai()
    # Samurai uses the penny code to trigger certain responses, so we want
    # some control over it in development.
    amount = os.environ['SUBSCRIPTION_AMOUNT']
    website.subscription_amount = decimal.Decimal(amount)
