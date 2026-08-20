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


def list_connections():
    """List connections, preferring the field set that includes priority.

    AUTOCONNECT-PRIORITY is what orders the list, but an nmcli that does not
    know the field would fail the whole listing, so fall back to the original
    field set and report priorities as unknown.
    """
    try:
        return run_nmcli(["-t", "-f", "NAME,UUID,TYPE,DEVICE,AUTOCONNECT-PRIORITY",
                          "connection", "show"]), True
    except subprocess.CalledProcessError:
        return run_nmcli(["-t", "-f", "NAME,UUID,TYPE,DEVICE",
                          "connection", "show"]), False


def get_wifi_connections():
    # Use terse mode for easy parsing
    lines, have_priority = list_connections()
    wifi_list = []

    for line in lines:
        if not line.strip():
            continue

        fields = split_terse(line)
        if len(fields) < 4:
            continue

        name, uuid, ctype, device = fields[0], fields[1], fields[2], fields[3]

        if ctype != "802-11-wireless":
            continue

        # DEVICE is only populated while a profile is actually applied to an
        # interface, which is what makes this connection the active one.  It
        # is already in the field list above, so this costs no extra query.
        active = device not in ("", "--")

        priority = 0
        if have_priority and len(fields) > 4:
            try:
                priority = int(fields[4])
            except ValueError:
                priority = 0

        wifi_list.append({
            "id": name,
            "uuid": uuid,
            "ssid": get_ssid(uuid),
            "active": active,
            "device": device if active else None,
            "priority": priority
        })

    # NetworkManager prefers the highest autoconnect-priority, so show the
    # most-preferred network first.  Ties keep a stable, predictable order.
    wifi_list.sort(key=lambda c: (-c["priority"], c["id"].lower()))

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
