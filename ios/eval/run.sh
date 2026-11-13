#!/bin/sh
# Offline: the app's recogniser + matcher on the NLM test photos, scored against ground truth.
set -e
cd "$(dirname "$0")"
OUT="${TMPDIR:-/tmp}/blisterkompass-eval"
swiftc -O -o "$OUT" main.swift ../checks/Shim.swift ../PillSnap/PillRecognizer.swift ../PillSnap/Matcher.swift ../PillSnap/PlanReader.swift ../PillSnap/PackCode.swift ../PillSnap/Models.swift
"$OUT" ../../test-photos "$(cd ../PillSnap/Data && pwd)" "$(cd ../PillSnap/Examples/plans && pwd)"
