from setuptools import setup, find_packages
from ihasamoney import __version__

setup( name='IHasAMoney'
     , packages=find_packages()
     , version=__version__
     , entry_points = { 'console_scripts'
                      : ['iham-bill = ihasamoney.cli:iham_bill']
                       }
      )
