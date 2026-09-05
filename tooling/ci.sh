#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
node tooling/verify-local.mjs
