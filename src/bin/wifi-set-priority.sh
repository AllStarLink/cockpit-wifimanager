#!/usr/bin/bash

# Rewrites connection.autoconnect-priority so NetworkManager prefers networks
# in the order given.
#
# Connection UUIDs are read from stdin, one per line, most-preferred first.
# NetworkManager tries the highest priority first, so the list is numbered
# downwards from its own length.  UUIDs are used rather than names because
# names are neither unique nor free of awkward characters.

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

# Validate before changing anything, so a bad entry cannot leave the ordering
# half-applied.
for uuid in "${UUIDS[@]}"; do
	if ! [[ "${uuid}" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
		echo "not a valid connection UUID: ${uuid}" >&2
		exit 1
	fi
	if ! nmcli -t -f UUID connection show "${uuid}" > /dev/null 2>&1; then
		echo "no such connection: ${uuid}" >&2
		exit 1
	fi
done

COUNT=${#UUIDS[@]}
INDEX=0
for uuid in "${UUIDS[@]}"; do
	PRIORITY=$(( COUNT - INDEX ))
	if ! nmcli connection modify "${uuid}" \
			connection.autoconnect-priority "${PRIORITY}"; then
		echo "failed to set priority on ${uuid}" >&2
		exit 1
	fi
	INDEX=$(( INDEX + 1 ))
done

echo "Updated preferred order for ${COUNT} networks"
