#!/usr/bin/bash

nmcli -f ssid,chan,signal,bars dev wifi list --rescan yes | \
	grep -v -- '--'

