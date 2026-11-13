# BMP 2.8 schema

`bmp_V2.8.xsd`: XML schema of the bundeseinheitlicher Medikationsplan, version 2.8, from KBV `BMP_V2.8.zip`
(https://www.kbv.de, Anlage 3 zur Vereinbarung BMP). The KBV states that the specification is free of third-party rights and may be
used without legal restriction (Anlage 3, ch. 7). Used by `tools/make-bmp-sheet.py` to validate every plan before printing.

`kbv_darreichungsform.csv`: KBV key table S_KBV_DARREICHUNGSFORM (FHIR code system KBV_CS_SFHIR_KBV_DARREICHUNGSFORM 1.16), code → German dosage form
and the BMP short form, as the KBV publishes it. Used by the print generator for the "Form" column; the PWA embeds the same table in
`pwa/js/dose-form.js`.
