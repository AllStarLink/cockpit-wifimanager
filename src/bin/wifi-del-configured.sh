#!/usr/bin/bash

# $1 = connection name or UUID
#
# The UI passes a UUID, which is unambiguous; a name is still accepted so the
# script stays usable by hand.

if [ -z "$1" ]; then
	echo "usage: wifi-del-configured.sh CONNNAME|UUID" >&2
	exit 1
fi

TARGET="$1"

# Compare against active connections by exact match on either field.  The
# previous substring grep refused to delete "home" while "home-guest" was up.
# UUIDs never contain a colon or backslash, so they need no unescaping; names
# come back with nmcli's terse escaping applied.
while IFS= read -r uuid; do
	if [ "${TARGET}" = "${uuid}" ]; then
		echo "cannot delete your active connection" >&2
		exit 1
	fi
done < <(nmcli -t -f UUID conn show --active)

while IFS= read -r name; do
	name="${name//\\:/:}"
	name="${name//\\\\/\\}"
	if [ "${TARGET}" = "${name}" ]; then
		echo "cannot delete your active connection" >&2
		exit 1
	fi
done < <(nmcli -t -f NAME conn show --active)

if ! nmcli conn delete "${TARGET}"; then
	echo "failed to delete ${TARGET}" >&2
	exit 1
fi
