.PHONY: all schemas zipfile

SCHEMA = org.gnome.shell.extensions.cloudapp.gschema.xml

SOURCE = src/*.js \
		 src/stylesheet.css \
		 src/metadata.json \
		 src/icons \
		 src/schemas/*

ZIPFILE = gnome-shell-cloudapp.zip

UUID = gnome-shell-cloudapp@weborate.com
EXTENSION_PATH = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

all: archive

schemas: src/schemas/gschemas.compiled

archive: $(ZIPFILE)

install: archive
	-rm -r $(EXTENSION_PATH)
	mkdir -p $(EXTENSION_PATH)
	unzip $(ZIPFILE) -d $(EXTENSION_PATH)


src/schemas/gschemas.compiled: src/schemas/$(SCHEMA)
	glib-compile-schemas src/schemas/

$(ZIPFILE): $(SOURCE) schemas
	-rm $(ZIPFILE)
	cd src && zip -r ../$(ZIPFILE) $(patsubst src/%,%,$(SOURCE))

