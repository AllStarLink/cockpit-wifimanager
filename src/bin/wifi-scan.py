#!/usr/bin/python3

import subprocess
import json

def get_wifi_networks():
    # Run the nmcli command to get Wi-Fi networks
    try:
        output = subprocess.check_output(
            ["nmcli", "-f", "ssid,signal", "-t", "-c", "no", "dev", "wifi", "list", "--rescan", "yes"],
            universal_newlines=True
        )
    except subprocess.CalledProcessError as e:
        print(f"Error executing nmcli command: {e}")
        return []

    # Parse the output
    networks = {}
    for line in output.strip().split('\n'):
        ssid, signal = line.split(':')
        # Only add networks with a non-blank SSID
        if ssid:
            signal = int(signal)
            # Store the highest signal strength for each SSID
            if ssid not in networks or networks[ssid] < signal:
                networks[ssid] = signal

    # Create a list of dictionaries for JSON output
    json_output = [{'ssid': ssid, 'signal': signal} for ssid, signal in networks.items()]

    # Sort the list by signal strength (strongest first)
    json_output.sort(key=lambda x: x['signal'], reverse=True)

    return json_output

def main():
    wifi_networks = get_wifi_networks()
    
    if not wifi_networks:
        print("No Wi-Fi networks found.")
        return

    # Print the JSON output
    print(json.dumps(wifi_networks))

if __name__ == "__main__":
    main()

