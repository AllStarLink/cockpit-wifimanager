#!/usr/bin/bash
#
# Regenerate src/css/patternfly.css from the upstream PatternFly release.
#
# Cockpit's own UI is built on PatternFly, so the plugin uses the same
# component CSS in order to look native inside the Cockpit shell (including
# its light/dark theme switcher).  We vendor only the handful of components
# this plugin actually uses rather than the full 1.5MB patternfly.css, and we
# point @font-face at the fonts cockpit-ws already installs under
# /usr/share/cockpit/static/fonts rather than shipping our own copies.
#
# Usage: builder/fetch-patternfly.sh [version]

set -euo pipefail

PF_VERSION="${1:-6.1.0}"
BASE_URL="https://unpkg.com/@patternfly/patternfly@${PF_VERSION}"
OUT="$(dirname "$0")/../src/css/patternfly.css"

PARTS=(
	patternfly-base.css
	components/Button/button.css
	components/Card/card.css
	components/Table/table.css
	components/Table/table-grid.css
	components/Form/form.css
	components/FormControl/form-control.css
	components/HelperText/helper-text.css
	components/Alert/alert.css
	components/Spinner/spinner.css
	components/Label/label.css
	layouts/Grid/grid.css
	layouts/Stack/stack.css
)

TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

{
	echo "/*"
	echo " * PatternFly ${PF_VERSION} -- vendored subset, do not edit by hand."
	echo " * Regenerate with: builder/fetch-patternfly.sh ${PF_VERSION}"
	echo " * Upstream: https://github.com/patternfly/patternfly (MIT)"
	echo " */"
} > "${TMP}/out.css"

for part in "${PARTS[@]}"; do
	echo "fetching ${part}" >&2
	curl -fsSL "${BASE_URL}/${part}" -o "${TMP}/part.css"
	{
		echo ""
		echo "/* ---- ${part} ---- */"
		cat "${TMP}/part.css"
	} >> "${TMP}/out.css"
done

# Point the Red Hat webfonts at the copies cockpit-ws ships.  This file is
# served from /cockpit/$hash/wifimanager/css/, so ../../../static/ resolves to
# /cockpit/static/.
sed -i 's#url("\./assets/fonts/#url("../../../static/fonts/#g' "${TMP}/out.css"

# Drop the icon-font faces: cockpit does not ship fa-solid/pficon under
# /cockpit/static, and this plugin uses inline SVG for its icons instead.
awk '
	/^@font-face/ { buf = $0; collecting = 1; next }
	collecting {
		buf = buf "\n" $0
		if ($0 ~ /^}/) {
			collecting = 0
			if (buf !~ /fa-solid|pficon/) print buf
		}
		next
	}
	{ print }
' "${TMP}/out.css" > "${OUT}"

echo "wrote ${OUT} ($(wc -c < "${OUT}") bytes)" >&2
