"""Validators.

Given input, return a problem string, or the empty string if there are no problems.

"""
import re

from ihasamoney.authentication import hash


# http://www.regular-expressions.info/email.html
EMAIL = re.compile('[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}')
DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
          'eight', 'nine']


def _plural(i):
    return "s" if i != 1 else ""

def email(email):
    problem = ""

    if not problem:
        if not email:
            problem = "No email??"

    if not problem:
        if len(email) > 64:
            problem = "Too much email!!"

    if not problem:
        if EMAIL.match(email) is None:
            problem = "Bad email!!"

    return problem

def password(password, confirm):
    problem = ""

    if not problem:
        if len(password) < 6:
            short = 6 - len(password)
            problem = "Need more password!"

    if not problem:
        if password != confirm:
            problem = "Password mismatch!"

    return problem
