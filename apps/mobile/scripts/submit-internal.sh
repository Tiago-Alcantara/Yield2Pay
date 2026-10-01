#!/usr/bin/env bash
# Gera os binários de produção e envia para TestFlight e para a faixa interna da Play.
# Exige `eas login`, as credenciais da Apple/Google no EAS e os ids reais em eas.json.
set -euo pipefail
cd "$(dirname "$0")/.."
eas build --platform all --profile production --auto-submit --non-interactive
