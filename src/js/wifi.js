const result = document.getElementById("scan-results");
const button = document.getElementById("wifi-scan-btn");
const setbutton = document.getElementById("set-wifi-btn");
const setresult = document.getElementById("set-wifi-results");
const conlist = document.getElementById("wifi-conn-list");
const delbutton = document.getElementById("del-wifi-btn");
const delresult = document.getElementById("del-wifi-results");

document.addEventListener("DOMContentLoaded", function() {
	button.addEventListener("click", wifi_scan_run);
	setbutton.addEventListener("click" , set_wifi_run);
	delbutton.addEventListener("click" , del_wifi_run);
	get_wifi_run();

	// Send a 'init' message.  This tells integration tests that we are ready to go
	cockpit.transport.wait(function() { });
});

// WiFi Scan Functions
function wifi_scan_run() {
    /* global cockpit */
	result.innerHTML = `<span class="wifi-scan-loader"></span>`;
	cockpit.spawn(["/usr/share/cockpit/wifimanager/bin/wifi-scan.py"] ,
		{ superuser: "require" } )
            .stream(wifi_scan_output)
            .catch(wifi_scan_fail);
}

function wifi_scan_fail() {
	result.innerHTML = `<span class="wifi-scan-error">WiFi scan failed</scan>`;
}

function wifi_scan_output(dataStr) {
    const data = JSON.parse(dataStr);
    if (!data.length) return;
    const table = document.createElement('table');
    table.classList.add("table");
    table.classList.add("table-striped");
    table.classList.add("table-hover");
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Create table headers
    Object.keys(data[0]).forEach(key => {
        const th = document.createElement('th');
        th.setAttribute("scope","col");
        th.textContent = key.toUpperCase();
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

     // Create table rows
    const tbody = document.createElement('tbody');
    data.forEach(item => {
        const row = document.createElement('tr');
        const rs = [ "ssid" , "signal" ];
        rs.forEach( col => {
            const td = document.createElement('td');
            td.textContent = item[col];
            row.appendChild(td);
        });
        tbody.appendChild(row);
    });
    table.appendChild(tbody);
	result.innerHTML = "";
    result.appendChild(table);
}


// WiFi Set Functions
function set_wifi_run() {
	let net_name = document.getElementById("wifi-ssid");
	let net_key = document.getElementById("wifi-key");

	if( net_name.value.length < 1 || net_name.value.length > 32 ){
		net_name.classList.add("is-invalid");
		setresult.innerHTML = `<span class="wifi-scan-error">SSID must be between 1 and 32 characters</span>`;
		return false;
	} else {
		net_name.classList.remove("is-invalid");
	}

	if( net_key.value.length < 8 || net_key.value.length > 64 ){
		net_key.classList.add("is-invalid");
		setresult.innerHTML = `<span class="wifi-scan-error">PSK must be between 8 and 64 characters</span>`;
		return false;
	} else {
		net_key.classList.remove("is-invalid");
	}

	cockpit.spawn(["/usr/share/cockpit/wifimanager/bin/wifi-set.sh", net_name.value, net_key.value] ,
		{ superuser: "require" } )
            .stream(set_wifi_output)
            .catch(set_wifi_fail);
}

function set_wifi_fail() {
	setresult.innerHTML = `<span class="wifi-scan-error">WiFi set failed</scan>`;
}

function set_wifi_output(data) {
	setresult.innerHTML = `<pre>${data}</pre>`;
	get_wifi_run();
}

// WiFi Get Connections Functions
function get_wifi_run() {
    cockpit.spawn(["/usr/share/cockpit/wifimanager/bin/wifi-list-configured.py"] ,
        { superuser: "require" } )
            .stream(get_wifi_output)
            .catch(get_wifi_fail);
}

function get_wifi_fail() {
	conlist.innerHTML += `<span class="wifi-scan-error">WiFi set failed</scan>`;
}

function get_wifi_output(dataStr){
	const data = JSON.parse(dataStr);
	if (!data.length) return;
	const table = document.createElement('table');
	table.classList.add("table");
	table.classList.add("table-striped");
	table.classList.add("table-hover");
	const thead = document.createElement('thead');
	const headerRow = document.createElement('tr');

    // Create table headers
    Object.keys(data[0]).forEach(key => {
		const th = document.createElement('th');
		th.setAttribute("scope","col");
        th.textContent = key.toUpperCase();
        headerRow.appendChild(th);
    });
	thead.appendChild(headerRow);
	table.appendChild(thead);

     // Create table rows
	const tbody = document.createElement('tbody');
    data.forEach(item => {
        const row = document.createElement('tr');
		const rs = [ "id" , "uuid" , "ssid" ];
		rs.forEach( col => {
            const td = document.createElement('td');
            td.textContent = item[col];
            row.appendChild(td);
        });
    	tbody.appendChild(row);
    });
	table.appendChild(tbody);
	document.getElementById('wifi-conn-list').appendChild(table);
}


// WIFi Delete Connection Functions
function del_wifi_run() {
	const net_name = document.getElementById("wifi-ssid-del");

	if( net_name.value.length < 1 || net_name.value.length > 32 ){
		net_name.classList.add("is-invalid");
		delresult.innerHTML = `<span class="wifi-scan-error">Conn label must be between 1 and 32 characters</span>`;
		return false;
	} else {
		net_name.classList.remove("is-invalid");
	}

    cockpit.spawn(["/usr/share/cockpit/wifimanager/bin/wifi-del-configured.sh", net_name.value] ,
        { superuser: "require" } )
            .stream(del_wifi_output)
            .catch(del_wifi_fail);
}

function del_wifi_fail() {
	delresult.innerHTML = `<span class="wifi-scan-error">Failed to delete connection</scan>`;
}

function del_wifi_output(data){
	delresult.innerHTML = `${data}`;
	get_wifi_run();
}



