/* global cockpit */

const BIN = "/usr/share/cockpit/wifimanager/bin";

const scanResults = document.getElementById("scan-results");
const scanButton = document.getElementById("wifi-scan-btn");
const scanStatus = document.getElementById("scan-status");
const connList = document.getElementById("wifi-conn-list");
const wifiForm = document.getElementById("wifi-form");
const ssidInput = document.getElementById("wifi-ssid");
const keyInput = document.getElementById("wifi-key");
const ssidControl = document.getElementById("wifi-ssid-control");
const keyControl = document.getElementById("wifi-key-control");
const setResult = document.getElementById("set-wifi-results");
const delResult = document.getElementById("del-wifi-results");

document.addEventListener("DOMContentLoaded", function() {
	scanButton.addEventListener("click", wifiScanRun);
	wifiForm.addEventListener("submit", function(event) {
		event.preventDefault();
		setWifiRun();
	});
	getWifiRun();

	// Send an 'init' message.  This tells integration tests that we are ready to go
	cockpit.transport.wait(function() { });
});

/* ---------- shared helpers ---------- */

function spawnJson(argv) {
	// Deliberately not .stream(): the helpers emit a single JSON document and a
	// streamed chunk can split it mid-object, which JSON.parse would reject.
	return cockpit.spawn(argv, { superuser: "require", err: "message" })
		.then(text => JSON.parse(text));
}

function el(tag, className, text) {
	const node = document.createElement(tag);
	if (className)
		node.className = className;
	if (text !== undefined)
		node.textContent = text;
	return node;
}

// PatternFly's inline alert. Everything user-supplied goes in via textContent,
// since SSIDs are attacker-controlled strings off the air.
function alertNode(variant, text) {
	const wrapper = el("div", `pf-v6-c-alert pf-m-inline pf-m-${variant}`);
	wrapper.setAttribute("role", variant === "danger" ? "alert" : "status");
	wrapper.appendChild(el("p", "pf-v6-c-alert__title", text));
	return wrapper;
}

function showResult(container, variant, text) {
	container.replaceChildren(alertNode(variant, text));
}

function clearResult(container) {
	container.replaceChildren();
}

function setControlValidity(control, input, valid) {
	control.classList.toggle("pf-m-error", !valid);
	input.setAttribute("aria-invalid", valid ? "false" : "true");
}

function spinnerNode(label) {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("class", "pf-v6-c-spinner");
	svg.setAttribute("role", "progressbar");
	svg.setAttribute("viewBox", "0 0 100 100");
	svg.setAttribute("aria-label", label);
	const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
	circle.setAttribute("class", "pf-v6-c-spinner__path");
	circle.setAttribute("cx", "50");
	circle.setAttribute("cy", "50");
	circle.setAttribute("r", "45");
	circle.setAttribute("fill", "none");
	svg.appendChild(circle);
	const box = el("div", "wifi-spinner-box");
	box.appendChild(svg);
	return box;
}

function lockIcon() {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("class", "wifi-lock-icon");
	svg.setAttribute("viewBox", "0 0 16 16");
	svg.setAttribute("aria-hidden", "true");
	svg.setAttribute("fill", "currentColor");
	const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path.setAttribute("d", "M8 1a3.5 3.5 0 0 0-3.5 3.5V6H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-.5V4.5A3.5 3.5 0 0 0 8 1zm2 5H6V4.5a2 2 0 1 1 4 0V6z");
	svg.appendChild(path);
	return svg;
}

/*
 * Build a PatternFly table.  pf-m-grid-md plus a data-label on every cell is
 * what makes the table collapse into stacked, labelled rows on a phone
 * instead of scrolling sideways.
 *
 * columns: [{ label, render(item) -> Node|string }]
 */
function renderTable(container, columns, items, emptyText) {
	if (!items.length) {
		container.replaceChildren(el("p", "wifi-muted", emptyText));
		return;
	}

	// A plain data table: no role="grid", which would promise arrow-key
	// navigation this page does not implement.
	const table = el("table", "pf-v6-c-table pf-m-grid-md pf-m-compact");

	const thead = el("thead", "pf-v6-c-table__thead");
	const headerRow = el("tr", "pf-v6-c-table__tr");
	columns.forEach(col => {
		const th = el("th", "pf-v6-c-table__th", col.label);
		th.setAttribute("scope", "col");
		headerRow.appendChild(th);
	});
	thead.appendChild(headerRow);
	table.appendChild(thead);

	const tbody = el("tbody", "pf-v6-c-table__tbody");
	items.forEach(item => {
		const row = el("tr", "pf-v6-c-table__tr");
		columns.forEach(col => {
			const td = el("td", "pf-v6-c-table__td");
			td.setAttribute("data-label", col.label);
			const content = col.render(item);
			if (content instanceof Node)
				td.appendChild(content);
			else
				td.textContent = content;
			row.appendChild(td);
		});
		tbody.appendChild(row);
	});
	table.appendChild(tbody);

	container.replaceChildren(table);
}

/* ---------- scan ---------- */

function wifiScanRun() {
	scanButton.disabled = true;
	scanStatus.textContent = "Scanning for WiFi networks...";
	scanResults.replaceChildren(spinnerNode("Scanning for WiFi networks"));

	spawnJson([`${BIN}/wifi-scan.py`])
		.then(renderScanResults)
		.catch(err => {
			scanStatus.textContent = "";
			scanResults.replaceChildren(
				alertNode("danger", `WiFi scan failed: ${err.message || err}`));
		})
		.finally(() => {
			scanButton.disabled = false;
		});
}

function isOpenNetwork(item) {
	const security = (item.security || "").trim();
	return security === "" || security === "--";
}

function renderScanResults(data) {
	scanStatus.textContent = data.length === 1
		? "Found 1 network."
		: `Found ${data.length} networks.`;

	renderTable(scanResults, [
		{
			label: "Network",
			render: item => {
				// A real button, not a click handler on the row, so the list is
				// reachable by keyboard and announced as actionable.
				const button = el("button", "pf-v6-c-table__button");
				button.type = "button";
				const content = el("span", "pf-v6-c-table__button-content");
				content.appendChild(el("span", "wifi-ssid-text", item.ssid));
				if (!isOpenNetwork(item))
					content.appendChild(lockIcon());
				button.appendChild(content);
				button.setAttribute("aria-label", `Configure ${item.ssid}`);
				button.addEventListener("click", () => selectNetwork(item));
				return button;
			}
		},
		{
			label: "Security",
			render: item => {
				const label = el("span", "pf-v6-c-label" +
					(isOpenNetwork(item) ? " pf-m-orange" : ""));
				const content = el("span", "pf-v6-c-label__content");
				content.appendChild(el("span", "pf-v6-c-label__text",
					isOpenNetwork(item) ? "Open" : (item.security || "Secured")));
				label.appendChild(content);
				return label;
			}
		},
		{
			label: "Signal",
			render: item => {
				const wrap = el("span", "wifi-signal");
				const bar = el("span", "wifi-signal-bar");
				const fill = el("span", "wifi-signal-fill");
				fill.style.width = `${Math.max(0, Math.min(100, Number(item.signal) || 0))}%`;
				bar.appendChild(fill);
				wrap.appendChild(bar);
				wrap.appendChild(el("span", "wifi-signal-text", `${item.signal}%`));
				return wrap;
			}
		}
	], data, "No networks found.");
}

/*
 * Clicking a scanned network fills in the form below rather than connecting
 * straight away -- the password still has to be typed, and an existing entry
 * would be replaced.
 */
function selectNetwork(item) {
	ssidInput.value = item.ssid;
	keyInput.value = "";
	setControlValidity(ssidControl, ssidInput, true);
	setControlValidity(keyControl, keyInput, true);
	clearResult(setResult);

	const open = isOpenNetwork(item);
	document.getElementById("wifi-key-help-text").textContent = open
		? "This network is open; leave the password blank."
		: "Between 8 and 64 characters.";

	const card = document.getElementById("wifi-form-card");
	card.scrollIntoView({ behavior: "smooth", block: "center" });
	// Briefly flag the form so it is obvious where the click went.
	card.classList.remove("wifi-flash");
	void card.offsetWidth;
	card.classList.add("wifi-flash");

	// Focus whichever field the user still has to fill in.
	(open ? ssidInput : keyInput).focus();
}

/* ---------- save ---------- */

function setWifiRun() {
	const ssid = ssidInput.value;
	const psk = keyInput.value;

	if (ssid.length < 1 || ssid.length > 32) {
		setControlValidity(ssidControl, ssidInput, false);
		showResult(setResult, "danger", "SSID must be between 1 and 32 characters.");
		ssidInput.focus();
		return;
	}
	setControlValidity(ssidControl, ssidInput, true);

	// An empty key is allowed and configures an open network.
	if (psk.length > 0 && (psk.length < 8 || psk.length > 64)) {
		setControlValidity(keyControl, keyInput, false);
		showResult(setResult, "danger", "Password must be between 8 and 64 characters, or blank for an open network.");
		keyInput.focus();
		return;
	}
	setControlValidity(keyControl, keyInput, true);

	document.getElementById("set-wifi-btn").disabled = true;
	clearResult(setResult);

	// The key goes over stdin, never argv: this runs under pkexec and
	// /proc/<pid>/cmdline is world readable.
	const proc = cockpit.spawn([`${BIN}/wifi-set.sh`, ssid],
		{ superuser: "require", err: "message" });
	proc.input(psk);
	proc.then(output => {
		keyInput.value = "";
		showResult(setResult, "success", output.trim() || `Saved network ${ssid}.`);
		getWifiRun();
	})
		.catch(err => {
			showResult(setResult, "danger", `Could not save network: ${err.message || err}`);
		})
		.finally(() => {
			document.getElementById("set-wifi-btn").disabled = false;
		});
}

/* ---------- configured connections ---------- */

function getWifiRun() {
	return spawnJson([`${BIN}/wifi-list-configured.py`])
		.then(renderConnList)
		.catch(err => {
			connList.replaceChildren(
				alertNode("danger", `Could not list configured networks: ${err.message || err}`));
		});
}

function renderConnList(data) {
	renderTable(connList, [
		{ label: "Connection", render: item => item.id },
		{ label: "SSID", render: item => item.ssid || "" },
		{
			label: "Actions",
			render: item => {
				const button = el("button", "pf-v6-c-button pf-m-link pf-m-danger", "Delete");
				button.type = "button";
				button.setAttribute("aria-label", `Delete ${item.id}`);
				// Delete by UUID: connection names are not unique and may
				// contain characters that confuse a name lookup.
				button.addEventListener("click", () => delWifiRun(item, button));
				return button;
			}
		}
	], data, "No WiFi networks configured.");
}

function delWifiRun(item, button) {
	if (!window.confirm(`Delete the WiFi network "${item.id}"?`))
		return;

	button.disabled = true;
	clearResult(delResult);

	cockpit.spawn([`${BIN}/wifi-del-configured.sh`, item.uuid],
		{ superuser: "require", err: "message" })
		.then(output => {
			showResult(delResult, "success", output.trim() || `Deleted ${item.id}.`);
			getWifiRun();
		})
		.catch(err => {
			button.disabled = false;
			showResult(delResult, "danger", `Could not delete network: ${err.message || err}`);
		});
}
