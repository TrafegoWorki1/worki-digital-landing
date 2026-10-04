import json
import urllib.request
from pathlib import Path

# Inspeciona o repositorio de destino antes de sobrescrever. Sobrescrever
# trabalho que nao é nosso apaga coisa que ninguem ve.

segredos = {}
for linha in Path("/opt/data/env.secrets").read_text(encoding="utf-8").splitlines():
    limpa = linha.strip()
    if not limpa or limpa.startswith("#") or "=" not in limpa:
        continue
    chave, _, valor = limpa.partition("=")
    segredos[chave.strip()] = valor.strip().strip("'\"")

token = segredos["GITHUB_TOKEN"]
REPO = "worki-digital-landing"

cab = {
    "Authorization": "Bearer " + token,
    "Accept": "application/vnd.github+json",
    "User-Agent": "verificacao-local",
}


def chamar(caminho):
    req = urllib.request.Request(
        "https://api.github.com/repos/TrafegoWorki1/" + REPO + caminho,
        headers=cab,
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


info = chamar("")
print("repositorio: %s" % info.get("full_name"))
print("descricao: %s" % (info.get("description") or "(vazia)"))
print("criado em: %s" % info.get("created_at"))
print("atualizado: %s" % info.get("updated_at"))
print("branch padrao: %s" % info.get("default_branch"))
print("tamanho: %d KB" % info.get("size", 0))

print("")
print("== conteudo da raiz ==")
conteudo = chamar("/contents/")
if isinstance(conteudo, list):
    for item in conteudo:
        tipo = "dir " if item.get("type") == "dir" else "arq "
        print("  %s %-40s %8d bytes" % (
            tipo, item.get("name", "?"), item.get("size", 0)))
else:
    print("  %s" % json.dumps(conteudo)[:200])

print("")
print("== ultimos commits ==")
commits = chamar("/commits?per_page=8")
for c in commits if isinstance(commits, list) else []:
    info_c = c.get("commit", {})
    autor = info_c.get("author", {}).get("name", "?")
    primeira = (info_c.get("message", "") or "").split("\n")[0]
    print("  %s  %-20s %s" % (c.get("sha", "")[:7], autor[:20], primeira[:60]))