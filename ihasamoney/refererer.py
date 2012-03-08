"""Define a function to track sources of traffic to the homepage.
"""
import traceback

from ihasamoney import db, log

                    
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


def track(request):
    """For requests for /, record the users referer header.
    """
    try:
        assert request.path.raw == '/' # sanity check
        referer = request.headers.one("Referer", "")
        if db.fetchone(REFERER_UPDATE, (referer, referer)) is None:
            db.execute(REFERER_INSERT, (referer,)) # race condition here
    except: # We never want this to hurt us.
        log.warning(traceback.format_exc())
