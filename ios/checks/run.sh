#!/bin/sh
# Offline checks for the on-phone plan reader and matcher (macOS, no Xcode project needed).
set -e
cd "$(dirname "$0")"
OUT="${TMPDIR:-/tmp}/blisterkompass-checks"
swiftc -O -o "$OUT" main.swift Shim.swift Bundle+Data.swift ../PillSnap/Matcher.swift ../PillSnap/PlanReader.swift ../PillSnap/PackCode.swift ../PillSnap/Models.swift ../PillSnap/DoseForm.swift ../PillSnap/LeafletParser.swift ../PillSnap/BmpWriter.swift ../PillSnap/MealTiming.swift
"$OUT" "$(cd ../PillSnap/Data && pwd)" "$(cd ../PillSnap/Examples/plans && pwd)"
