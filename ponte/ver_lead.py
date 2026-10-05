"""Mostra o ultimo lead gravado, campo a campo.

Le em json, nao por pipe: o arquivo pode receber texto do navegador, e um
pipe para interpretador executaria conteudo nao revisado.

Argumento opcional: nome esperado do lead. Sem ele, so mostra.
Com ele, confere os campos contra os valores esperados.
"""

import json
import sys
from pathlib import Path

CAMINHO = Path("/opt/data/cache/scratch/leads/leads.jsonl")

if not CAMINHO.is_file():
    print("arquivo nao existe: %s" % CAMINHO)
    raise SystemExit(1)

linhas = [l for l in CAMINHO.read_text(encoding="utf-8").splitlines() if l.strip()]
print("leads gravados: %d" % len(linhas))
print("")

lead = json.loads(linhas[-1])
print("=== ultimo lead: %s ===" % lead.get("nome", "?"))

if len(sys.argv) < 2:
    for chave, valor in lead.items():
        if valor == "" or valor is None:
            print("  %-18s (vazio)" % chave)
        else:
            texto = str(valor)
            if len(texto) > 70:
                texto = texto[:67] + "..."
            print("  %-18s %s" % (chave, texto))
    raise SystemExit(0)

# Confere contra os valores esperados do teste atual.
esperados = json.loads(sys.argv[1])
falhas = 0
for chave, esperado in esperados.items():
    obtido = lead.get(chave)
    ok = obtido == esperado
    print("%s %-18s %s" % ("OK  " if ok else "FALHA", chave, obtido))
    if not ok:
        print("       esperado: %s" % esperado)
        falhas += 1

print("")
print("falhas: %d" % falhas)
raise SystemExit(1 if falhas else 0)