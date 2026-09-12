# Temporary dependency compatibility

Expo Router 57 currently uses `query-string` 7, whose CommonJS decoder dependency
predates the upstream fix for
[GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).
The fixed decoder, `decode-uri-component` 0.5.0, exports an ESM default; simply
overriding the version would turn the caller's function into a module object.

The local adapter preserves that callable CommonJS API and delegates to the
unaltered, patched upstream implementation through an npm alias. It does not
implement URL decoding. The scoped override affects only `query-string`.
Node >=22.22 and Metro support this module interop. The regression check calls
the actual installed `query-string` for Unicode, duplicate keys, round trips
and malformed input in a process with a timeout.

The second scoped override upgrades `xcode`'s `uuid` to 11.1.1, the CommonJS-capable
backport fixing [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq).
The project generator uses `uuid.v4()` without a caller-supplied buffer; the
regression check exercises that exact integration.

Remove these overrides when the installed upstream Expo dependency graph contains
the fixes natively, then repeat the compatibility, toolchain and iOS bundle checks.
An audit result is a dependency snapshot, not a security certification or evidence
that the native app has passed its device/release gates.
