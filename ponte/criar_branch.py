import json
import urllib.error
import urllib.request
from pathlib import Path

# Cria um branch novo e empurra a arvore local para ele, sem tocar na
# branch principal do repositorio.
#
# Por que branch novo: o main ja tem dois commits de outro agente,
# incluindo bloco de autoridade com foto do fundador. Sobrescrever isso
# sem avisar apagaria trabalho que nao e meu. Branch separado deixa o
# main intacto e a decisao de merge com o dono.

segredos = {}
for linha in Path("/opt/data/env.secrets").read_text(encoding="utf-8").splitlines():
    limpa = linha.strip()
    if not limpa or limpa.startswith("#") or "=" not in limpa:
        continue
    chave, _, valor = limpa.partition("=")
    segredos[chave.strip()] = valor.strip().strip("'\"")

print("token do GitHub carregado: %d bytes" % len(segredos.get("GITHUB_TOKEN", "")))

REPO = "worki-digital-landing"
BRANCH = "captura-lead-supabase-webhook"

req = urllib.request.Request(
    "https://api.github.com/repos/TrafegoWorki1/%s/git/refs" % REPO,
    headers={
        "Authorization": "Bearer " + segredos["GITHUB_TOKEN"],
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "verificacao-local",
    },
    data=json.dumps({
        "ref": "refs/heads/" + BRANCH,
        # Base precisa existir. Uso o nome da branch principal, que
        # resolve para o sha atual do main.
        "sha": "main",
    }).encode(),
    method="POST",
)

try:
    with urllib.request.urlopen(req, timeout=30) as r:
        dados = json.loads(r.read().decode())
        print("branch criado: HTTP %d" % r.status)
        print("  ref: %s" % dados.get("ref", "?"))
except urllib.error.HTTPError as e:
    corpo = e.read().decode()
    print("HTTP %d" % e.code)
    print(corpo[:300])
    if e.code == 422:
        print("")
        print("422 normalmente significa que o branch ja existe.")
        print("Se for o caso, o push pode ir direto para ele.")