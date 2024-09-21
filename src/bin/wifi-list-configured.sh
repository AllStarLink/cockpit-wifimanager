#!/usr/bin/bash

nmcli -f name,type conn show | grep wifi | \
	awk '{print $1}'
