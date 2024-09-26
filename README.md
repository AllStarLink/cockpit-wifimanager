# Cockpit Wifi Manager Plugin
A plugin for [Cockpit](https://cockpit-project.org/) to manage WiFi connections.

## Description
This is a simple plugin for Cockpit that enables the display, scanning, adding, and
deleting of NetworkManager-based connection configurations that are of `type=wifi`.
The plugin should be fairly self-evident how it works.

## Installation

### Debian Systems
The best way to install the plugin on Debian is to install it from the 
[AllStarLink package repository](https://allstarlink.github.io/user-guide/install/#allstarlink-package-repo-install)
This is pre-configured on all AllStarLink v3 appliance. On Debian systems then 
simply install with `sudo apt install -y cockpit-wifimanager`.

### Other Systems
Although developed by AllStarLink, this package is general-purpose and has no
other dependencies on the AllStarLink software ecosystem. This plugin requires
NetworkManager to be installed as well as availability of Python3 (although no special
libraries are used).

If depdendencies are met:

```bash
git clone https://github.com/AllStarLink/cockpit-wifimanager.git
cd cockpit-wifimanager
make install
```
