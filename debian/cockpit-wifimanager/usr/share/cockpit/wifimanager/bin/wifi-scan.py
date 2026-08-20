#!/usr/bin/python3

import json
import subprocess
import sys


def split_terse(line):
    """Split one nmcli --terse line into fields.

    nmcli escapes ':' and '\\' inside field values with a backslash, so a
    plain str.split(':') mangles any SSID containing a colon.
    """
    fields = []
    current = []
    escaped = False

    for char in line:
        if escaped:
            current.append(char)
            escaped = False
        elif char == '\\':
            escaped = True
        elif char == ':':
            fields.append(''.join(current))
            current = []
        else:
            current.append(char)

    fields.append(''.join(current))
    return fields


def get_wifi_networks():
    # Run the nmcli command to get Wi-Fi networks
    try:
        output = subprocess.check_output(
            ["nmcli", "-f", "ssid,signal,security", "-t", "-c", "no",
             "dev", "wifi", "list", "--rescan", "yes"],
            universal_newlines=True
        )
    except (subprocess.CalledProcessError, OSError) as e:
        print(f"Error executing nmcli command: {e}", file=sys.stderr)
        return None

    # Parse the output
    networks = {}
    for line in output.strip().split('\n'):
        if not line:
            continue

        fields = split_terse(line)
        if len(fields) < 3:
            continue

        ssid, signal, security = fields[0], fields[1], fields[2]

        # Only add networks with a non-blank SSID
        if not ssid:
            continue

        try:
            signal = int(signal)
        except ValueError:
            continue

        # Store the highest signal strength for each SSID, along with the
        # security of whichever BSS that was.
        if ssid not in networks or networks[ssid]['signal'] < signal:
            networks[ssid] = {'ssid': ssid, 'signal': signal, 'security': security}

    json_output = list(networks.values())

    # Sort the list by signal strength (strongest first)
    json_output.sort(key=lambda x: x['signal'], reverse=True)

    return json_output


def main():
    wifi_networks = get_wifi_networks()

    if wifi_networks is None:
        sys.exit(1)

    # Always emit JSON, including for the empty case: the caller parses this.
    print(json.dumps(wifi_networks))


if __name__ == "__main__":
    main()
