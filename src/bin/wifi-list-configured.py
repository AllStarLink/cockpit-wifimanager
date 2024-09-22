#!/usr/bin/python3

import os
import configparser
import json

def parse_nmconnection_files(directory):
    nmconnections = {}

    # Loop through all files in the specified directory
    for filename in os.listdir(directory):
        if filename.endswith('.nmconnection'):
            filepath = os.path.join(directory, filename)
            config = configparser.ConfigParser()
            
            # Read the .nmconnection file
            config.read(filepath)
            
            # Store parameters in a dictionary
            nmconnections[filename] = {section: dict(config.items(section)) for section in config.sections()}

    return nmconnections

def display_parameters(nmconnections):
    wifi_conns = []
    for filename, parameters in nmconnections.items():
        if parameters['connection']['type'] == "wifi":
            wifi_conn = {
                'id': parameters['connection']['id'] , 
                'uuid' : parameters['connection']['uuid'] ,
                'ssid': parameters['wifi']['ssid'] }
            wifi_conns.append(wifi_conn)
    print(json.dumps(wifi_conns))


if __name__ == '__main__':
    # Specify the directory containing .nmconnection files
    directory = '/etc/NetworkManager/system-connections'
    
    # Parse the files
    nmconnections = parse_nmconnection_files(directory)
    
    # Display the parameters
    display_parameters(nmconnections)

