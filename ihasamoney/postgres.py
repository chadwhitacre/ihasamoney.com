"""This is a high-value abstraction layer over psycopg2.

All functionality provided by this module is bundled with psycopg2, this module
just configures it the way you want it. Here are the things we configure:

    - You can connect with URLs in addition to connection strings.
    - Connections are transparently pooled.
    - Calls are automatically isolated in transactions.
    - Cursors yield dictionaries, not tuples.

The main object is PostgresManager. Instantiate it with the following
parameters:

    dsn         A Postgres connection string (see http://www.postgresql.org
                /docs/9.1/static/libpq-connect.html) or an URL starting with 
                "postgres://". [required]
    minconn     The minimum size of the connection pool. [1]
    maxconn     The maximum size of the connection pool. [10]

The resulting object gives you four methods for interacting with Postgres, all
taking a string of SQL and a tuple of arguments to be used to replace the
instances of "%s" in the SQL string. Each call to these methods is isolated in
its own transaction. (XXX Are multiple statements in a single call wrapped in a
single transaction?)

    execute     Execute the query and discard the results.
    fetchone    Execute the query and return a single result or None.
    fetchall    Execute the query and yield the results.
    get_cursor  Execute the query and return a context manager wrapping a
                 psycopg2 RealDictCursor. The connection underlying the cursor 
                 will be checked out of the connection pool and checked back in
                 upon both successful and execeptional executions against the 
                 cursor.

Look at the first three methods for examples of how to use get_cursor.

"""
import logging
import urlparse

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool as ConnectionPool


log = logging.getLogger('postgres')


# Teach urlparse about postgres:// URLs.
if 'postgres' not in urlparse.uses_netloc:
    urlparse.uses_netloc.append('postgres')


def url_to_dsn(url):
    """Heroku gives us an URL, psycopg2 wants a DSN. Convert!
    """
    parsed = urlparse.urlparse(url)
    dbname = parsed.path[1:] # /foobar
    user = parsed.username
    password = parsed.password
    host = parsed.hostname
    port = parsed.port
    if port is None:
        port = '5432' # postgres default port
    dsn = "dbname=%s user=%s password=%s host=%s port=%s"
    dsn %= (dbname, user, password, host, port)
    return dsn

class PostgresManager(object):
    """Manage connections to a PostgreSQL datastore. One per process.
    """

    def __init__(self, dsn, minconn=1, maxconn=10):
        if dsn.startswith("postgres://"):
            dsn = url_to_dsn(dsn)
        log.info('wiring up ihasamoney.db: %s' % dsn)
        self.pool = ConnectionPool( minconn=minconn
                                  , maxconn=maxconn
                                  , dsn=dsn
                                  , connection_factory=PostgresConnection
                                   )

    def execute(self, *a, **kw):
        """Execute the query and discard the results.
        """
        with self.get_cursor(*a, **kw) as cursor:
            pass

    def fetchone(self, *a, **kw):
        """Execute the query and return a single result or None.
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

class PostgresConnection(psycopg2.extensions.connection):
    """This is a subclass, in order to change transaction behavior.

    THE DBAPI 2.0 spec calls for transactions to be left open by default. I 
    don't think we want this.

    """

    def __init__(self, *a, **kw):
        psycopg2.extensions.connection.__init__(self, *a, **kw)
        self.autocommit = True # override dbapi2 default

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
        cursor = self.conn.cursor(cursor_factory=RealDictCursor)
        try:
            cursor.execute(*self.a, **self.kw)
        except:
            # If we get an exception from execute (like, the query fails:
            # pretty common), then the __exit__ clause is not triggered. We
            # trigger it ourselves to avoid draining the pool.
            self.__exit__()
            raise
        return cursor

    def __exit__(self, *a, **kw):
        """Put our connection back in the pool.
        """
        self.pool.putconn(self.conn)
