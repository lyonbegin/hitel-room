# HITEL Daangn single-source browser audit
Server-controlled original vs clone capture. Does not alter original UI or the existing HITEL services.
Fixed allowed URLs only. Captures real original browser page and current HITEL prototype at the same 1440x900 viewport. Stores screenshot, DOM, image URLs, representative computed styles, network observations, and pixel difference.
GET /health - healthcheck
GET /run - start only this fixed audit
GET /report - audit JSON
GET / - visual dashboard
GET /artifacts/original.png, /artifacts/clone.png, /artifacts/diff.png, /artifacts/original.json, /artifacts/clone.json
