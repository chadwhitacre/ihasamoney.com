env:
	python2.7 ./vendor/virtualenv-1.6.4.py \
				--no-site-packages \
				--unzip-setuptools \
				--prompt="[ihazmoney] " \
				--never-download \
				--extra-search-dir=./vendor/ \
				--distribute \
				./env/
	./env/bin/pip install -r requirements.txt

clean:
	rm -rf env

run: env
	./env/bin/thrash ./swaddle local.env ./env/bin/aspen -vDEBUG www/
