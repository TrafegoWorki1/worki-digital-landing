import json
import urllib.request
from pathlib import Path

# Lista os repositorios da conta, para saber se o destino ja existe ou
# precisa ser criado. Nao imprime token.

segredos = {}
for linha in Path("/opt/data/env.secrets").read_text(encoding="utf-8").splitlines():
    limpa = linha.strip()
    if not limpa or limpa.startswith("#") or "=" not in limpa:
        continue
    chave, _, valor = limpa.partition("=")
    segredos[chave.strip()] = valor.strip().strip("'\"")

token = segredos["GITHUB_TOKEN"]

req = urllib.request.Request(
    "https://api.github.com/user/repos?per_page=100&sort=updated",
    headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "User-Agent": "verificacao-local",
    },
)

with urllib.request.urlopen(req, timeout=30) as r:
    repos = json.loads(r.read().decode())

print("repositorios visiveis: %d" % len(repos))
print("")
for repo in repos:
    privado = "privado" if repo.get("private") else "publico"
    print("  %-42s %-8s %s" % (
        repo.get("full_name", "?"),
        privado,
        (repo.get("description") or "")[:40],
    ))

print("")
print("procurando destino da landing page...")
achou = False
for repo in repos:
    nome = repo.get("name", "").lower()
    if "landing" in nome or "captura" in nome or "worki" in nome:
        print("  candidato: %s" % repo.get("full_name"))
        achou = True
if not achou:
    print("  nenhum repositorio com nome parecido")
    print("  sera preciso criar um novo")