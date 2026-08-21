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


def scan(fields):
    return subprocess.check_output(
        ["nmcli", "-f", fields, "-t", "-c", "no",
         "dev", "wifi", "list", "--rescan", "yes"],
        universal_newlines=True
    )


def get_wifi_networks():
    # ACTIVE marks the AP this radio is currently associated with.  Fall back
    # to the original field list if an nmcli build does not know the field, so
    # that an unsupported extra column can never break scanning outright.
    have_active = True
    try:
        output = scan("ssid,signal,security,active")
    except subprocess.CalledProcessError:
        have_active = False
        try:
            output = scan("ssid,signal,security")
        except (subprocess.CalledProcessError, OSError) as e:
            print(f"Error executing nmcli command: {e}", file=sys.stderr)
            return None
    except OSError as e:
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
        active = have_active and len(fields) > 3 and fields[3] == "yes"

        # Only add networks with a non-blank SSID
        if not ssid:
            continue

        try:
            signal = int(signal)
        except ValueError:
            continue

        # Store the highest signal strength for each SSID, along with the
        # security of whichever BSS that was.
        # Keep the strongest BSS per SSID, but never let a stronger inactive
        # BSS hide the fact that we are associated with this network.
        existing = networks.get(ssid)
        if existing is None or existing['signal'] < signal:
            networks[ssid] = {'ssid': ssid, 'signal': signal,
                              'security': security,
                              'active': active or (existing or {}).get('active', False)}
        elif active:
            existing['active'] = True

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
