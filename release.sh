#!/bin/sh

# Fail on error.
# ==============

set -e


# Be somewhere predictable.
# =========================

cd "`dirname $0`"


# --help
# ======

if [ $# = 0 ]; then
    echo
    echo "Usage: $0 <version>"
    echo
    echo "  This is a release script for IHasAMoney. We bump the version number in "
    echo "  ihasamoney/version.py and then do a git dance, pushing to Heroku."
    echo
    exit
fi


# Helpers
# =======

confirm () {
    proceed=""
    while [ "$proceed" != "y" ]; do
        read -p"$1 (y/N) " proceed
        if [ "$proceed" == "n" -o "$proceed" == "N" -o "$proceed" == "" ]
        then
            return 1
        fi
    done
    return 0
}

require () {
    if [ ! `which $1` ]; then
        echo "The '$1' command was not found."
        return 1 
    fi
    return 0
}


# Work
# ====

if [ $1 ]; then

    require git
    if [ $? -eq 1 ]; then
        exit 
    fi

    if [ -f "" ]; then
        echo "Version $1 is already git tagged."
    else
        confirm "Tag and push version $1?"
        if [ $? -eq 0 ]; then

            # Fix the version.
            # ================

            sed -e "s/~~VERSION~~/$1/" -i '' ihasamoney/version.py
            git ci ihasamoney/version.py \
                -m"Setting version to $1 in ihasamoney/version.py."
            git tag $1


            # Deploy to Heroku.
            # =================
            # If this fails we still want to reset the version, so modify bash 
            # error handling around this call.

            set +e
            git push heroku
            set -e


            # Change the version back.
            # ========================

            sed -e "s/$1/~~VERSION~~/" -i '' ihasamoney/version.py
            git ci ihasamoney/version.py \
                -m"Resetting version in ihasamoney/version.py."

        fi
    fi
fi
