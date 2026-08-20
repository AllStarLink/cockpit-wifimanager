/* global cockpit */

const BIN = "/usr/share/cockpit/wifimanager/bin";

// The AllStarLink fallback access point is what you land on when no
// configured network is reachable, so it is pinned as the least preferred
// connection and cannot be reordered.  wifi-set-priority.sh enforces this
// too; the UI just avoids offering a move that would be overridden.
const FALLBACK_CONNECTION = "asl-fallback-ap";

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

function connectedLabel() {
	const label = el("span", "pf-v6-c-label pf-m-green pf-m-compact");
	const content = el("span", "pf-v6-c-label__content");
	content.appendChild(el("span", "pf-v6-c-label__text", "Connected"));
	label.appendChild(content);
	return label;
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
 * columns: [{ label, render(item) -> Node|string, cellClass }]
 *   A null label makes the column headless: no visible header text and no
 *   data-label, for control columns that would be noise when stacked.
 * opts.rowClass: optional (item) -> string, for marking individual rows
 * opts.rowSetup: optional (row, item) -> void, run after a row is built
 */
function renderTable(container, columns, items, emptyText, opts) {
	opts = opts || {};
	if (!items.length) {
		container.replaceChildren(el("p", "wifi-muted", emptyText));
		return;
	}

	// A plain data table: no role="grid", which would promise arrow-key
	// navigation this page does not implement.
	const table = el("table", "pf-v6-c-table pf-m-grid-md pf-m-compact" +
		(opts.tableClass ? ` ${opts.tableClass}` : ""));

	const thead = el("thead", "pf-v6-c-table__thead");
	const headerRow = el("tr", "pf-v6-c-table__tr");
	columns.forEach(col => {
		const th = el("th", "pf-v6-c-table__th");
		th.setAttribute("scope", "col");
		if (col.label)
			th.textContent = col.label;
		else
			th.appendChild(el("span", "pf-v6-screen-reader", col.srLabel || ""));
		headerRow.appendChild(th);
	});
	thead.appendChild(headerRow);
	table.appendChild(thead);

	const tbody = el("tbody", "pf-v6-c-table__tbody");
	items.forEach(item => {
		const extra = opts.rowClass ? opts.rowClass(item) : "";
		const row = el("tr", "pf-v6-c-table__tr" + (extra ? ` ${extra}` : ""));
		columns.forEach(col => {
			const td = el("td", "pf-v6-c-table__td" + (col.cellClass ? ` ${col.cellClass}` : ""));
			if (col.label)
				td.setAttribute("data-label", col.label);
			const content = col.render(item);
			if (content instanceof Node)
				td.appendChild(content);
			else
				td.textContent = content;
			row.appendChild(td);
		});
		if (opts.rowSetup)
			opts.rowSetup(row, item);
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

function isFallback(item) {
	return item.fallback === true || item.id === FALLBACK_CONNECTION;
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
				if (item.active)
					content.appendChild(connectedLabel());
				button.appendChild(content);
				button.setAttribute("aria-label", item.active
					? `Reconfigure ${item.ssid}, currently connected`
					: `Configure ${item.ssid}`);
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
	], data, "No networks found.",
	{ rowClass: item => item.active ? "wifi-row-active" : "" });
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

/* ---------- reordering ---------- */

/*
 * The list order is NetworkManager's connection.autoconnect-priority: the
 * network at the top is the one it will prefer.  Dragging rewrites the whole
 * order in a single call rather than nudging individual priorities.
 *
 * Pointer events are used rather than HTML5 drag-and-drop so that the same
 * code path works with a mouse and with touch, and the handle also responds
 * to the arrow keys so the list is reorderable without dragging at all.
 */

let commitTimer = null;

function gripIcon() {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("class", "wifi-grip-icon");
	svg.setAttribute("viewBox", "0 0 16 16");
	svg.setAttribute("aria-hidden", "true");
	svg.setAttribute("fill", "currentColor");
	[[6, 3], [10, 3], [6, 8], [10, 8], [6, 13], [10, 13]].forEach(([cx, cy]) => {
		const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
		dot.setAttribute("cx", cx);
		dot.setAttribute("cy", cy);
		dot.setAttribute("r", "1.4");
		svg.appendChild(dot);
	});
	return svg;
}

function isLocked(row) {
	return !!row && row.dataset.locked === "true";
}

function moveRow(row, delta) {
	if (isLocked(row))
		return false;
	const sibling = delta < 0 ? row.previousElementSibling : row.nextElementSibling;
	// A pinned row is a wall: nothing may be moved across it.
	if (!sibling || isLocked(sibling))
		return false;
	if (delta < 0)
		row.parentNode.insertBefore(row, sibling);
	else
		row.parentNode.insertBefore(sibling, row);
	return true;
}

/*
 * Live-reorder while dragging.  This resolves the final position in one step
 * rather than swapping with one neighbour at a time, so a fast drag lands
 * where the pointer actually is instead of trailing one row behind it.
 */
function dragOver(row, clientY) {
	const tbody = row.parentNode;

	// The row goes before the first other row whose midpoint is below the
	// pointer; if there is none, it belongs at the end.
	let target = null;
	for (const other of Array.from(tbody.children)) {
		if (other === row || isLocked(other))
			continue;
		const rect = other.getBoundingClientRect();
		if (clientY < rect.top + (rect.height / 2)) {
			target = other;
			break;
		}
	}

	// Dragging past the end must still stop above any pinned row.
	if (!target)
		target = tbody.querySelector('tr[data-locked="true"]');

	if (target !== row.nextSibling)
		tbody.insertBefore(row, target);
}

function reorderHandle(item, disabled) {
	const button = el("button", "pf-v6-c-button pf-m-plain wifi-grip");
	button.type = "button";
	button.appendChild(gripIcon());

	if (isFallback(item)) {
		button.disabled = true;
		button.title = `${item.id} is the fallback access point and is always tried last.`;
		button.setAttribute("aria-label", `${item.id} is pinned last and cannot be reordered.`);
		return button;
	}

	button.setAttribute("aria-label",
		`Reorder ${item.id}. Use the up and down arrow keys to change its priority.`);

	if (disabled) {
		button.disabled = true;
		button.title = "There is only one network to order.";
		return button;
	}

	button.addEventListener("keydown", event => {
		const delta = event.key === "ArrowUp" ? -1 : (event.key === "ArrowDown" ? 1 : 0);
		if (!delta)
			return;
		event.preventDefault();
		const row = button.closest("tr");
		if (moveRow(row, delta)) {
			// Moving the row detaches the handle, so put focus back on it.
			button.focus();
			scheduleCommit();
		}
	});

	button.addEventListener("pointerdown", event => {
		if (event.button !== 0)
			return;
		event.preventDefault();

		const row = button.closest("tr");
		const table = row.closest("table");
		row.classList.add("pf-m-ghost-row");
		table.classList.add("pf-m-drag-over");
		button.setPointerCapture(event.pointerId);

		const onMove = ev => dragOver(row, ev.clientY);
		const onEnd = () => {
			button.removeEventListener("pointermove", onMove);
			button.removeEventListener("pointerup", onEnd);
			button.removeEventListener("pointercancel", onEnd);
			if (button.hasPointerCapture(event.pointerId))
				button.releasePointerCapture(event.pointerId);
			row.classList.remove("pf-m-ghost-row");
			table.classList.remove("pf-m-drag-over");
			scheduleCommit();
		};

		button.addEventListener("pointermove", onMove);
		button.addEventListener("pointerup", onEnd);
		button.addEventListener("pointercancel", onEnd);
	});

	return button;
}

// Coalesce repeated arrow-key presses into one write.
function scheduleCommit() {
	window.clearTimeout(commitTimer);
	commitTimer = window.setTimeout(applyOrder, 400);
}

function applyOrder() {
	const uuids = Array.from(connList.querySelectorAll("tbody tr"))
		.map(row => row.dataset.uuid)
		.filter(Boolean);
	if (!uuids.length)
		return;

	const proc = cockpit.spawn([`${BIN}/wifi-set-priority.sh`],
		{ superuser: "require", err: "message" });
	proc.input(uuids.join("\n") + "\n");
	proc.then(output => {
		// The DOM already shows the order that was just written, so do not
		// re-render: that would throw away keyboard focus mid-reorder.
		showResult(delResult, "success", output.trim() || "Updated preferred order.");
	})
		.catch(err => {
			showResult(delResult, "danger", `Could not save the order: ${err.message || err}`);
			// Re-read so the list cannot drift from what is actually stored.
			getWifiRun();
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
	// Only the reorderable networks count towards "is there anything to move".
	const single = data.filter(item => !isFallback(item)).length < 2;
	renderTable(connList, [
		{
			label: null,
			srLabel: "Reorder",
			cellClass: "pf-v6-c-table__draggable",
			render: item => reorderHandle(item, single)
		},
		{
			label: "Connection",
			render: item => {
				const wrap = el("span", "wifi-conn-name");
				wrap.appendChild(el("span", null, item.id));
				if (item.active)
					wrap.appendChild(connectedLabel());
				if (isFallback(item)) {
					const label = el("span", "pf-v6-c-label pf-m-compact pf-m-outline");
					const content = el("span", "pf-v6-c-label__content");
					content.appendChild(el("span", "pf-v6-c-label__text", "Always last"));
					label.appendChild(content);
					wrap.appendChild(label);
				}
				return wrap;
			}
		},
		{ label: "SSID", render: item => item.ssid || "" },
		{
			label: "Actions",
			render: item => {
				const button = el("button", "pf-v6-c-button pf-m-link pf-m-inline pf-m-danger", "Delete");
				button.type = "button";
				button.setAttribute("aria-label", `Delete ${item.id}`);
				if (item.active) {
					// wifi-del-configured.sh refuses to remove the active
					// connection, so do not offer a click that can only fail.
					button.disabled = true;
					button.title = `${item.id} is the active connection and cannot be deleted.`;
				} else {
					// Delete by UUID: connection names are not unique and may
					// contain characters that confuse a name lookup.
					button.addEventListener("click", () => delWifiRun(item, button));
				}
				return button;
			}
		}
	], data, "No WiFi networks configured.", {
		tableClass: "wifi-conn-table",
		rowClass: item => item.active ? "wifi-row-active" : "",
		rowSetup: (row, item) => {
			row.dataset.uuid = item.uuid;
			if (isFallback(item))
				row.dataset.locked = "true";
		}
	});
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
