"""This is installed as `iham`.
"""
import ihasamoney
import ihasamoney.billing


def iham_bill():
    print "Greetings, program! We're charging people $%s." % ihasamoney.amount
