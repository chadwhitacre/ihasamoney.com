from ez_setup import use_setuptools
use_setuptools()

from setuptools import find_packages, setup
version = "n/a"


setup( author = 'Chad Whitacre'
     , author_email = 'chad@zetaweb.com'
     , description = ('IHazMoney.com is a website.')
     , name = 'ihazmoney'
     , packages = find_packages()
     , version = version
     , zip_safe = False
      )
