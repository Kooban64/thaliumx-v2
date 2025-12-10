#!/bin/bash
# Script to seed Vault with secrets from .secrets directory
# This script should be run after Vault is initialized and unsealed

set -e

VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-root}"

echo "Seeding Vault secrets from .secrets directory..."

# Function to write secret to Vault
write_secret() {
    local path=$1
    shift
    echo "Writing secret to kv/fintech/$path"
    docker exec thaliumx-vault vault kv put "kv/fintech/$path" "$@"
}

# Exchange API Credentials
echo "=== Seeding Exchange API Credentials ==="

write_secret "exchanges/bybit" \
    api_key="4OUlLHWF1TZOIybbmB" \
    api_secret="mgOU4dkyqo2UpSGUEWlofOYgppYZMQyjzmpi"

write_secret "exchanges/kucoin" \
    api_key="6811caa1c1dfd9000105165a" \
    api_secret="7358e659-5cc7-4f6c-b284-673eddfc9a07" \
    api_passphrase="ApzorPtyLtd"

write_secret "exchanges/kraken" \
    api_key="HJWPi4DUG78y4r/JlUxRolUNgC2QL93/Ia5FVipRRnLSL6/551uifFaE" \
    private_key="FYilsCPtlDbirUpphL73OIC/yRE0euuq3KnziF9CJHiiznwaU1P5AiY8KRd0uTVKBnvL+kiWs5eneZGi+SYAtQ=="

write_secret "exchanges/okx" \
    api_key="ff25371c-653e-4c1d-9761-376eb76960b9" \
    api_secret="5738F7B9C962420CFCB148B08A10A6A3" \
    passphrase="Apzor@2025"

write_secret "exchanges/valr" \
    api_key="9f8175dbc6e65b4958319bbb5b60c4d2cf109c26b37f5384b91fd56581b2dd92" \
    api_secret="23e45cb7b90394ab474ae6ca7b3bf9ea329aebbe7b26503c1b489716fd74ed5d"

write_secret "exchanges/bitstamp" \
    api_key="9egeB3Lj6mH5KwGTjVYnI6Z6i7XCbXJ3" \
    api_secret="36zIuhVH4RLF5ypZ0b9szhXlUg4iT9Uk"

write_secret "exchanges/cryptocom" \
    api_key="cxakp_yZFBXiGNEfFiPJY2SbV8wY" \
    passkey="082025"

write_secret "exchanges/binance" \
    api_key="MTXWVJlBP2iikO9aFV9phKsfDnTOmxZEae90pEdH8pkFLoinUD724FTOJNEVI9Mw" \
    api_secret="rCPypjwzQJiq78RWwcXpVZSglHKQ2Liun6GgiDiyIpOjl6McOOVjDweXo8LjpTzv"

# Blockchain Network API Keys
echo "=== Seeding Blockchain Network API Keys ==="

write_secret "networks/bscscan" api_key="82ZUSSJP4DEISGSYQAIUHSIAQTBYIMMH5X"
write_secret "networks/etherscan" api_key="II3Z1T8UDNBWE4KWIZPMQ8VP4WKJ1ZE1BD"
write_secret "networks/tronscan" api_key="4e1f2efd-f64a-4ebc-8aba-8ad918b5678e"
write_secret "networks/alchemy" api_key="SztlY3jR1R_HBbKW588ZlWxfAYa1iHgD"
write_secret "networks/ankr" api_key="b511d6fbc7c9fd126e6e0b020a1d3578fb8db0fc6f9cf6b0f8ec558e4006db36"
write_secret "networks/infura" \
    project_id="38cb2ace40b3446d900e1c500dd714ab" \
    secret="6bnj8+8AzJtxX3+492ic3a4LAsklmk/oe1y7vBvkfCmdGay6sgcl+w"

# Data Providers
echo "=== Seeding Data Provider API Keys ==="

write_secret "providers/coingecko" api_key="CG-UBg3oBHf14coAkBkMR3f6y8t"
write_secret "providers/coincap" api_key="26aaf883fd4af22776b27dbd342b301650e88a5398e89f6372d1873d9ec7861b"
write_secret "providers/blockcypher" token="42fd53e7f886485a869b7075d03d5803"
write_secret "providers/quicknode" api_key="QN_2e8edc97bce74ed3be5820a8fe212fa5"
write_secret "providers/0x" api_key="79b63bcf-7eaa-4dcb-8155-6ad5b4b60326"
write_secret "providers/thegraph" api_key="server_38be9989620e2e658fb49c8d9eff80ed"
write_secret "providers/moralis" jwt="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjNlYjMzMzAyLWQwY2UtNDU2Mi04MzM4LTcxODQ0ZmNiMmIyOCIsIm9yZ0lkIjoiNDYxOTQ1IiwidXNlcklkIjoiNDc1MjQ1IiwidHlwZUlkIjoiNTAwYWE1MTUtZTgxYi00MGJkLWFhNDgtOWYwNGM5MTFiNzZmIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NTM2OTk4MDQsImV4cCI6NDkwOTQ1OTgwNH0.MjtzifYvNZbFJq5t5OJ_hxrh6cBdnXuQI1StLN1pWbI"

# Banking - Nedbank
echo "=== Seeding Banking Credentials ==="

write_secret "banking/nedbank" \
    deposits_api_key="FjL8gH6CS41uE0vQrNjDH7PEZmblMgBc6ieVwVtX" \
    deposits_base_url="https://pxsvfmxmo1.execute-api.af-south-1.amazonaws.com/Stage" \
    account_number="1309630755" \
    payout_base_url="https://b2b-api.nedbank.co.za/apimarket/b2b-sb/payments/v1"

# SMTP
echo "=== Seeding SMTP Credentials ==="

write_secret "smtp" \
    user="kooban.smtp@gmail.com" \
    password="ztpf zttv rrip spaf" \
    server="smtp.gmail.com" \
    port="587"

echo ""
echo "=== Vault secrets seeded successfully! ==="
echo ""
echo "To verify, run:"
echo "  docker exec thaliumx-vault vault kv list kv/fintech/"