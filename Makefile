REPORTER ?= spec

setup:
	mkdir -p test

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--ui bdd \
		test/*.js

test-html: 
	@./node_modules/.bin/mocha \
		--reporter doc > spec.html \
		--ui bdd \
		test/*.js

test-md: 
	@./node_modules/.bin/mocha \
		--reporter markdown > spec.md \
		--ui bdd \
		test/*.js

.PHONY: test test-html setup