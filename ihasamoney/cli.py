"""This is installed as `iham`.
"""
import ihasamoney
import ihasamoney.billing


def iham_bill():
    ihasamoney.wire_amount()
    ihasamoney.wire_db()
    ihasamoney.wire_samurai()

    print "Greetings, program! We're charging people $%s." % ihasamoney.amount
    ihasamoney.billing.do_daily_billing_run(ihasamoney.amount)
