#!/usr/bin/env python3
import json
import subprocess
import sys


def split_terse(line):
    """Split one nmcli --terse line into fields.

    nmcli escapes ':' and '\\' inside field values with a backslash, so a
    plain str.split(':') mangles any connection name containing a colon --
    and would hand the UI a truncated UUID to delete by.
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


def run_nmcli(args):
    """Run nmcli and return stdout lines."""
    result = subprocess.run(
        ["nmcli"] + args,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=True
    )
    return result.stdout.splitlines()


def get_wifi_connections():
    # Use terse mode for easy parsing
    lines = run_nmcli(["-t", "-f", "NAME,UUID,TYPE,DEVICE", "connection", "show"])
    wifi_list = []

    for line in lines:
        if not line.strip():
            continue

        fields = split_terse(line)
        if len(fields) < 4:
            continue

        name, uuid, ctype = fields[0], fields[1], fields[2]

        if ctype != "802-11-wireless":
            continue

        wifi_list.append({
            "id": name,
            "uuid": uuid,
            "ssid": get_ssid(uuid)
        })

    return wifi_list


def get_ssid(uuid):
    """Extract SSID from nmcli connection show <uuid>."""
    try:
        detail = run_nmcli(["-t", "-f", "802-11-wireless.ssid",
                            "connection", "show", uuid])
    except subprocess.CalledProcessError:
        # A profile that nmcli cannot read (a bad .nmconnection file) should
        # not take the whole listing down.
        return None

    # Output looks like: "802-11-wireless.ssid:MyNetwork"
    for line in detail:
        fields = split_terse(line)
        if fields[0] == "802-11-wireless.ssid" and len(fields) > 1:
            return fields[1]

    return None  # If no SSID found


if __name__ == "__main__":
    try:
        wifi_connections = get_wifi_connections()
    except (subprocess.CalledProcessError, OSError) as e:
        print(f"Error executing nmcli command: {e}", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(wifi_connections))
