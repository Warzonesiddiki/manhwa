# 24 — Large uploads, downloads, and disconnected clients

**Status:** design contract. Applies to 10–24-hour sources and large export artifacts.

## Important distinction

**Accepted server jobs** continue after the browser closes. **Uploading a local browser file** normally requires the browser and local file to remain available. Do not promise continued local-file upload after browser shutdown. Resume after reopening is a separate capability with file reselection and authorization checks.

## Upload workflow

1. Owner signs in; API validates project ownership, declared size/type and storage budget.
2. Create a server-owned asset ID/object destination and `TransferSession`; never accept an arbitrary storage path from the client.
3. Upload directly using the provider's resumable protocol, bounded chunks/concurrency and progress based on server-confirmed bytes.
4. Persist safe resume metadata; protect the session credential; never log it or store it in public manifest/history.
5. On reconnect, reauthenticate, query committed bytes, reselect/verify the same local file and resume only if destination/session still matches.
6. Finalize conditionally against the exact object generation/version; independently validate size, integrity, media structure and limits.
7. Only inspection success moves the asset from quarantine to processable.

Cloud Storage's resumable session URI is a bearer-like upload capability: the docs warn that anyone holding it can upload without further authentication. The documented session expires after a week; recheck the actual API/version before implementation. [1](https://docs.cloud.google.com/storage/docs/performing-resumable-uploads)

Do not assume app logout revokes a storage session already issued. Set conservative lifecycle controls, cancel/revoke provider sessions where supported, quarantine late writes, and explain revocation limits. Choose encrypted/server-side credential handling and minimal browser persistence in the transfer security spike; no credentials in URL query logs or AI chat.

## Matching the local file

Filename/last-modified/size are useful hints, not proof of identical content. Use streaming checksums and a verified source/object hash. Avoid loading 128 GB into JavaScript memory to hash it. A browser-compatible background incremental hash and server-side validation must be benchmarked. Provider checksums and SHA-256 have different semantics; record algorithm and provenance rather than pretending every ETag is SHA-256.

If the session expires, explain whether the chosen provider can retain committed bytes. If it cannot, a new upload may restart at zero; never claim universal cross-expiry resumption. Invalid/mismatched files must not append into an existing object.

## Bandwidth guidance (idealized, excluding overhead)

| Size / uplink | Minimum transfer time |
|---|---:|
| 43.2 GB / 50 Mbps | 1.92 hours |
| 86.4 GB / 20 Mbps | 9.6 hours |
| 86.4 GB / 10 Mbps | 19.2 hours |
| 128 GB / 10 Mbps | ~28.44 hours |

Show measured throughput and a range, not a guaranteed deadline. Laptop sleep, connection changes, power failure, provider throttling and quota matter. A desktop uploader is a future option only if browser transfer measurements justify a separate client.

## Downloads

Use direct authorized range-capable delivery; do not `fetch` an entire giant MP4 into a browser Blob. Refresh expiring authorization for subsequent requests without replacing artifact identity. Record immutable object version/length/hash so resumed ranges cannot splice different revisions.

Offer episodes and publication parts individually plus a small JSON manifest/checksum file. Large archives should be streamed/multipart or a manifest with separate downloads, not a ZIP assembled in API/browser RAM. A local filesystem with insufficient free space or file-size limits needs an explicit user warning, not “download succeeded.”

## States and error handling

`created → uploading → verifying → inspected_ready`; alternatives `paused`, `needs_reselection`, `session_expired`, `quota_blocked`, `quarantined`, `cancelled`, `failed`.

Saved upload progress is distinct from bytes actually confirmed by storage. Reconcile on every resume. Duplicate finalize is idempotent. A late upload after project deletion cannot revive the project or become processable.

## Required tests

Refresh, browser close/reopen, network drop, changed local file, expired token/session, early complete/size mismatch, unsupported type, checksum failure, duplicate finalize, upload after deletion, range download after URL expiry, and disk-full destination. TEST-019 captures this suite.
