# Changelog

## v1.2.2

- Fixed event-to-date association in weekly calendar view.
- Improved weekly date detection using the visible date range and event columns.
- Preserved event start/end times for weekly ICS export.
- Stabilized monthly and weekly agenda handling.


## v1.2.1

- Improved extension performance on MEPRE.
- Reduced unnecessary DOM observation.
- Avoided continuously reacting to unrelated page changes.
- Kept calendar features inactive until needed.


## v1.2.0

- Added support for MEPRE weekly calendar view.
- Added automatic detection between monthly and weekly views.
- Reused agenda list, A4 printing and ICS export for the active calendar view.

## v1.1.0

- Improved event date extraction in monthly calendar view.
- Fixed events appearing without an associated date.
- Improved compatibility with MEPRE's FullCalendar rendering.

## v1.0.1

- Fixed A4 printing when browser pop-ups are blocked.
- Replaced popup-based printing with an internal iframe.

## v1.0.0

- Initial release.
- Improved agenda view for MEPRE.
- A4 print support.
- ICS calendar export.