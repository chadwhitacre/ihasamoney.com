env:
	python2.7 ./vendor/virtualenv-1.6.4.py \
				--no-site-packages \
				--unzip-setuptools \
				--prompt="[ihasamoney] " \
				--never-download \
				--extra-search-dir=./vendor/ \
				--distribute \
				./env/
	./env/bin/pip install -r requirements.txt
	./env/bin/pip install -e ./

clean:
	rm -rf env

run: env
	./env/bin/thrash ./swaddle local.env ./env/bin/aspen -vDEBUG www/
