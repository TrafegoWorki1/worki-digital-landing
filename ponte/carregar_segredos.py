"""Carrega os segredos para variaveis de ambiente do processo atual.

Escreve um arquivo .env de execucao a partir de /opt/data/env.secrets,
para que o CLI do Vercel leia sem o token passar por linha de comando.

Por que um arquivo e nao export no shell: o token na linha de comando
aparece em qualquer `ps`, em log de processo e em historico de shell.
No arquivo, com permissao 600, ele so e lido por quem ja esta no
container.
"""

import os
import stat
from pathlib import Path

ORIGEM = Path("/opt/data/env.secrets")
DESTINO = Path("/opt/data/worki-landing/.env.execucao")

segredos = {}
for linha in ORIGEM.read_text(encoding="utf-8").splitlines():
    limpa = linha.strip()
    if not limpa or limpa.startswith("#") or "=" not in limpa:
        continue
    chave, _, valor = limpa.partition("=")
    segredos[chave.strip()] = valor.strip().strip("'\"")

if not segredos:
    raise SystemExit("nenhuma variavel lida de %s" % ORIGEM)

# Nome padrao do git: o script que le este arquivo costuma esperar GITHUB_TOKEN
# ou GH_TOKEN. Gravamos os dois nomes para o CLI encontrar.
saida = []
for chave, valor in segredos.items():
    if chave == "GITHUB_TOKEN":
        saida.append("GITHUB_TOKEN=%s" % valor)
        saida.append("GH_TOKEN=%s" % valor)
    else:
        saida.append("%s=%s" % (chave, valor))

# Variavel de execucao que o agente le para o numero do WhatsApp de destino.
# Vem do arquivo de configuracao do agente, nao de outro lugar.
saida.append("WHATSAPP_NUMBER=558592494552")

# O VERCEL_ORG_ID do arquivo de segredos esta truncado, com so o prefixo
# team_. O CLI aceita o valor e falha depois com "you forgot to specify
# VERCEL_PROJECT_ID", porque um id de 5 caracteres nao casa com nenhum
# time. Sobrescrevo com o id real, lido do .vercel/project.json que o
# proprio `vercel link` gravou.
ARQUIVO_PROJETO = Path("/opt/data/worki-landing/.vercel/project.json")
if ARQUIVO_PROJETO.is_file():
    import json
    projeto = json.loads(ARQUIVO_PROJETO.read_text(encoding="utf-8"))
    org_id = projeto.get("orgId")
    project_id = projeto.get("projectId")
    if org_id and project_id:
        saida.append("VERCEL_ORG_ID=%s" % org_id)
        saida.append("VERCEL_PROJECT_ID=%s" % project_id)
        print("org id do link: %d caracteres (era 5, truncado)" % len(org_id))
        print("project id do link: %s" % project_id)

DESTINO.write_text("\n".join(saida) + "\n", encoding="utf-8")
DESTINO.chmod(stat.S_IRUSR | stat.S_IWUSR)

print("arquivo: %s" % DESTINO)
print("variaveis gravadas: %d" % len(saida))
for chave in segredos:
    print("  %s: %d bytes" % (chave, len(segredos[chave])))
print("permissao: 600")
print("")
print("token no arquivo de configuracao do git: %s" % DESTINO)