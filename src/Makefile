prefix ?= /usr
data_dir ?= $(prefix)/share
WEBROOT ?= $(DESTDIR)$(data_dir)/cockpit/wifimanager
BIN_DIR = bin
CSS_DIR = css
JS_DIR = js

ROOT_FILES = index.html manifest.json

BIN_FILES = $(wildcard $(BIN_DIR)/*.sh)
CSS_FILES = $(wildcard $(CSS_DIR)/*.css)
JS_FILES = $(wildcard $(JS_DIR)/*.js)

BIN_INSTALLABLES = $(patsubst $(BIN_DIR)/%, $(WEBROOT)/$(BIN_DIR)/%, $(BIN_FILES))
CSS_INSTALLABLES = $(patsubst $(CSS_DIR)/%, $(WEBROOT)/$(CSS_DIR)/%, $(CSS_FILES))
JS_INSTALLABLES = $(patsubst $(JS_DIR)/%, $(WEBROOT)/$(JS_DIR)/%, $(JS_FILES))

ROOT_INSTALLABLES = $(patsubst %, $(WEBROOT)/%, $(ROOT_FILES))

INSTALLABLES = $(CSS_INSTALLABLES) $(BIN_INSTALLABLES) \
	$(JS_INSTALLABLES) $(ROOT_INSTALLABLES)

.PHONY:	install
install:	$(INSTALLABLES)

$(WEBROOT)/css/%: $(CSS_DIR)/%
	install -D -m 0644  $< $@

$(WEBROOT)/bin/%: $(BIN_DIR)/%
	install -D -m 0755  $< $@

$(WEBROOT)/JS/%: $(JS_DIR)/%
	install -D -m 0644  $< $@

$(WEBROOT)/%:	%
	install -D -m 0644  $< $@
