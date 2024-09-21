#!/usr/bin/bash

# $1 = network SSID
# $2 = network password

if [ -z "$1" ] || [ -z "$2" ]; then
	echo "usage: wifi-set.sh NETWORK KEY"
	exit 1
fi

# Get the active WiFI device
WLAN_DEV=$(nmcli --get-values GENERAL.DEVICE,GENERAL.TYPE device show | \
	sed '/^wifi/!{h;d;};x' | grep -v "p2p-dev")

nmcli conn delete "$1"
nmcli conn add type wifi ifname ${WLAN_DEV} \
	con-name "$1" autoconnect yes ssid "$1"
nmcli conn modify "$1" wifi-sec.key-mgmt wpa-psk
nmcli conn modify "$1" wifi-sec.psk "$2"
