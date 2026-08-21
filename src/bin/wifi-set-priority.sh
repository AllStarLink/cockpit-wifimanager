#!/usr/bin/bash

# Rewrites connection.autoconnect-priority so NetworkManager prefers networks
# in the order given.
#
# Connection UUIDs are read from stdin, one per line, most-preferred first.
# NetworkManager tries the highest priority first, so the list is numbered
# downwards from its own length.  UUIDs are used rather than names because
# names are neither unique nor free of awkward characters.
#
# The AllStarLink fallback access point is exempt: it exists so there is
# always something to connect to when no configured network is reachable, so
# it is forced to the minimum priority no matter where the caller placed it.
# That is enforced here rather than only in the UI, because this script is the
# privileged boundary and is also usable by hand.

FALLBACK_NAME="asl-fallback-ap"
FALLBACK_PRIORITY=-999

UUIDS=()
while IFS= read -r line; do
	line="${line%$'\r'}"
	[ -z "${line}" ] && continue
	UUIDS+=("${line}")
done

if [ ${#UUIDS[@]} -eq 0 ]; then
	echo "usage: wifi-set-priority.sh  (connection UUIDs on stdin, preferred first)" >&2
	exit 1
fi

# NetworkManager's valid range is -999..999; refuse a list long enough to run
# off the end rather than silently clamping some of it.
if [ ${#UUIDS[@]} -gt 999 ]; then
	echo "too many connections to prioritise" >&2
	exit 1
fi

# Validate everything, and note which entries are the fallback, before
# changing anything: a bad entry must not leave the ordering half-applied.
NAMES=()
RANKED=0
for uuid in "${UUIDS[@]}"; do
	if ! [[ "${uuid}" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
		echo "not a valid connection UUID: ${uuid}" >&2
		exit 1
	fi

	name=$(nmcli -g connection.id connection show "${uuid}" 2> /dev/null)
	if [ -z "${name}" ]; then
		echo "no such connection: ${uuid}" >&2
		exit 1
	fi

	NAMES+=("${name}")
	if [ "${name}" != "${FALLBACK_NAME}" ]; then
		RANKED=$(( RANKED + 1 ))
	fi
done

# Ranked connections count down from their own number, so every one of them
# stays above the fallback's floor.
INDEX=0
NEXT=${RANKED}
for uuid in "${UUIDS[@]}"; do
	if [ "${NAMES[${INDEX}]}" = "${FALLBACK_NAME}" ]; then
		PRIORITY=${FALLBACK_PRIORITY}
	else
		PRIORITY=${NEXT}
		NEXT=$(( NEXT - 1 ))
	fi

	if ! nmcli connection modify "${uuid}" \
			connection.autoconnect-priority "${PRIORITY}"; then
		echo "failed to set priority on ${uuid}" >&2
		exit 1
	fi
	INDEX=$(( INDEX + 1 ))
done

echo "Updated preferred order for ${RANKED} networks"
