#
# Build variables
#
SRCNAME = cockpit-wifimanager
PKGNAME = $(SRCNAME)
RELVER = 1.1.0
DEBVER = 2
RELPLAT ?= deb$(shell lsb_release -rs 2> /dev/null)
ARCH ?= $(shell uname -m)

BUILDABLES = src

ifdef ${DESTDIR}
DESTDIR=${DESTDIR}
endif

default:
	@echo This does nothing, use 'make install'

install:
	@echo "ARCH: $(ARCH)"
	@echo "BARCH: $(BARCH)"
	$(foreach dir, $(BUILDABLES), $(MAKE) -C $(dir) install;)

deb:	debclean debprep
	debchange --distribution stable --package $(PKGNAME) \
		--newversion $(EPOCHVER)$(RELVER)-$(DEBVER).$(RELPLAT) \
		"Autobuild of $(EPOCHVER)$(RELVER)-$(DEBVER) for $(RELPLAT)"
	perl -pi -e 's/\@\@ARCH\@\@/$(BARCH)/g' debian/control
	DEB_BUILD_OPTIONS="nostrip noautodbgsym" \
		dpkg-buildpackage -b --no-sign --target-arch=$(BARCH) --target-type=$(ARCH)-linux-gnu
	git checkout debian/changelog debian/control || /bin/true

debchange:
	debchange --newversion $(RELVER)-$(DEBVER)
	debchange --release

debprep: debclean
	(cd .. && \
		rm -f $(PKGNAME)-$(RELVER) && \
		rm -f $(PKGNAME)-$(RELVER).tar.gz && \
		rm -f $(PKGNAME)_$(RELVER).orig.tar.gz && \
		ln -s $(SRCNAME) $(PKGNAME)-$(RELVER) && \
		tar --exclude=".git" -h -zvcf $(PKGNAME)-$(RELVER).tar.gz $(PKGNAME)-$(RELVER) && \
		ln -s $(PKGNAME)-$(RELVER).tar.gz $(PKGNAME)_$(RELVER).orig.tar.gz )

debclean:
	rm -f ../$(PKGNAME)_$(RELVER)*
	rm -f ../$(PKGNAME)-$(RELVER)*
	rm -rf debian/$(PKGNAME)
	rm -f debian/files
	rm -rf debian/.debhelper/
	rm -f debian/debhelper-build-stamp
	rm -f debian/*.substvars
	rm -rf debian/$(SRCNAME)/ debian/.debhelper/
	rm -f debian/debhelper-build-stamp debian/files debian/$(SRCNAME).substvars
	rm -f debian/*.debhelper



