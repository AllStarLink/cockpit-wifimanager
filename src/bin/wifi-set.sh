#!/usr/bin/bash

# $1 = network SSID
#
# The pre-shared key is read from stdin rather than passed as an argument:
# this runs under pkexec and /proc/<pid>/cmdline is world readable, so an
# argument would expose the key to every local user for the life of the call.
# An empty key configures an open network.

if [ -z "$1" ]; then
	echo "usage: wifi-set.sh NETWORK  (pre-shared key on stdin)" >&2
	exit 1
fi

SSID="$1"

# read returns non-zero on EOF without a trailing newline, which is the normal
# case here, so do not let that abort the script.
IFS= read -r PSK || true

if [ -n "${PSK}" ] && { [ "${#PSK}" -lt 8 ] || [ "${#PSK}" -gt 64 ]; }; then
	echo "pre-shared key must be between 8 and 64 characters" >&2
	exit 1
fi

# Get the active WiFi device
WLAN_DEV=$(nmcli --get-values GENERAL.DEVICE,GENERAL.TYPE device show | \
	sed '/^wifi/!{h;d;};x' | grep -v "p2p-dev")

if [ -z "${WLAN_DEV}" ]; then
	echo "no WiFi device found" >&2
	exit 1
fi

# Replacing an existing profile of the same name is intentional and is what
# the UI warns about; ignore the error when there is nothing to delete.
nmcli conn delete "${SSID}" > /dev/null 2>&1

if ! nmcli conn add type wifi ifname "${WLAN_DEV}" \
		con-name "${SSID}" autoconnect yes ssid "${SSID}" > /dev/null; then
	echo "failed to create connection for ${SSID}" >&2
	exit 1
fi

if [ -n "${PSK}" ]; then
	# NOTE: nmcli takes the key as an argument, so it is briefly visible in
	# the process table for the duration of this one call.  Removing that
	# last exposure means writing the keyfile under
	# /etc/NetworkManager/system-connections directly, which interacts badly
	# with netplan-managed systems -- see the trixie handling elsewhere.
	if ! nmcli conn modify "${SSID}" \
			wifi-sec.key-mgmt wpa-psk wifi-sec.psk "${PSK}"; then
		nmcli conn delete "${SSID}" > /dev/null 2>&1
		echo "failed to set the pre-shared key for ${SSID}" >&2
		exit 1
	fi
else
	if ! nmcli conn modify "${SSID}" wifi-sec.key-mgmt ""; then
		nmcli conn delete "${SSID}" > /dev/null 2>&1
		echo "failed to configure ${SSID} as an open network" >&2
		exit 1
	fi
fi

echo "Saved network ${SSID}"
