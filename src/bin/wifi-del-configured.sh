#!/usr/bin/bash

# $1 = network SSID
# $2 = network password

if [ -z "$1" ]; then
	echo "usage: wifi-del-configured.sh CONNNAME"
	exit 1
fi

DEL_IN_ACTIVE=$(nmcli -f name conn show --active | grep $1 | wc -l)
if [ ${DEL_IN_ACTIVE} -gt 0 ]; then
	echo "cannot delete your active connection"
	exit 1
fi

nmcli conn delete "$1"
