#!/bin/bash

set -euo pipefail

# Generate bindings
forge build
npx typechain@8.3.2 --target=ethers-v6 ./out/**/*.json

# Fork mainnet
ANVIL_PID=""
function clean_up () {
    ARG=$?
    [ -n "$ANVIL_PID" ] && kill "$ANVIL_PID"
    exit $ARG
}
trap clean_up SIGINT SIGTERM EXIT

echo "🍴 Forking mainnet for Ethereum ..."
anvil --fork-url https://ethereum.publicnode.com > /dev/null &
ANVIL_PID=$!

# Sleep for 10 seconds here to give some time for the fork to complete.
sleep 10

# Override guardian set
npx @wormhole-foundation/wormhole-cli@0.0.2 evm hijack -a 0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B -g 0xbeFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe

# Run integration tests
npx tsx@4.7.0 ./ts-test/mock.ts
