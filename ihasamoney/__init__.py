import logging
import os
import urlparse
from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool as ConnectionPool


log = logging.getLogger('ihasamoney')


# canonizer
# =========

class X: pass
canonical_scheme = os.environ['CANONICAL_SCHEME']
canonical_host = os.environ['CANONICAL_HOST']

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
    if request.path.raw.count('/') >= 2:
        request.x.id = request.path.raw.split('/')[2]


# utils
# =====

def parse_rows(rows):
    return [row.strip().split(';') for row in rows.splitlines()]


# db
# ==

class PostgresConnection(psycopg2.extensions.connection):
    """Subclass to change transaction behavior.

    THE DBAPI 2.0 spec calls for transactions to be left open by default. I 
    don't think we want this.

    """

    def __init__(self, *a, **kw):
        psycopg2.extensions.connection.__init__(self, *a, **kw)
        self.autocommit = True # override dbapi2 default

class PostgresManager(object):
    """Manage connections to a PostgreSQL datastore. One per process.
    """

    def __init__(self, connection_spec):
        log.info('wiring up ihasamoney.db: %s' % connection_spec)
        self.pool = ConnectionPool( minconn=1
                                  , maxconn=10
                                  , dsn=connection_spec
                                  , connection_factory=PostgresConnection
                                   )

    def execute(self, *a, **kw):
        """Execute the query and discard the results.
        """
        with self.get_cursor(*a, **kw) as cursor:
            pass

    def fetchone(self, *a, **kw):
        """Execute the query and yield the results.
        """
        with self.get_cursor(*a, **kw) as cursor:
            return cursor.fetchone()

    def fetchall(self, *a, **kw):
        """Execute the query and yield the results.
        """
        with self.get_cursor(*a, **kw) as cursor:
            for row in cursor:
                yield row

    def get_cursor(self, *a, **kw):
        """Execute the query and return a context manager wrapping the cursor.
        """
        return PostgresContextManager(self.pool, *a, **kw)

class PostgresContextManager:
    """Instantiated once per db access.
    """

    def __init__(self, pool, *a, **kw):
        self.pool = pool
        self.a = a
        self.kw = kw
        self.conn = None
    
    def __enter__(self):
        """Get a connection from the pool.
        """
        self.conn = self.pool.getconn()
        try:
            cursor = self.conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute(*self.a, **self.kw)
        except:
            # If we get an exception here (like, the query fails: pretty
            # common), then the __exit__ clause is not triggered. We trigger it
            # ourselves to avoid draining the pool.
            self.__exit__()
            raise
        return cursor

    def __exit__(self, *a, **kw):
        """Put our connection back in the pool.
        """
        self.pool.putconn(self.conn)


# wireup
# ======

def url_to_dsn(url):
    """Heroku gives us an URL, psycopg2 wants a DSN. Convert!
    """
    parsed = urlparse.urlparse(url)
    dbname = parsed.path[1:] # /foobar
    # Why is the user:pass not parsed!? Is the scheme unrecognized?
    user_pass, host = parsed.netloc.split('@')
    user, password = user_pass.split(':')
    port = '5432' # postgres default port
    if ':' in host:
        host, port = host.split(':')
    dsn = "dbname=%s user=%s password=%s host=%s port=%s"
    dsn %= (dbname, user, password, host, port)
    return dsn

def wire_db():
    url = os.environ['DATABASE_URL']
    dsn = url_to_dsn(url)
    return PostgresManager(dsn)

db = None 
def startup(website):
    """Set up db and gauges.
    """
    global db
    db = wire_db()
    website.gauges = os.environ['GAUGES'] != 'false'
