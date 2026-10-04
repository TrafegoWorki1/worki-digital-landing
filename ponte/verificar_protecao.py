import json
import urllib.request
import urllib.error
from pathlib import Path

# A publicacao saiu como "Ready" mas responde 302 para login da Vercel.
# Isso e protecao de implantacao: o time liga por padrao em projeto novo.
# Verifica se e o caso e qual a API para desligar.

segredos = {}
for linha in Path("/opt/data/env.secrets").read_text(encoding="utf-8").splitlines():
    limpa = linha.strip()
    if not limpa or limpa.startswith("#") or "=" not in limpa:
        continue
    chave, _, valor = limpa.partition("=")
    segredos[chave.strip()] = valor.strip().strip("'\"")

token = segredos["VERCEL_TOKEN"]
projeto = json.loads(
    Path("/opt/data/worki-landing/.vercel/project.json").read_text(encoding="utf-8")
)
ORG = projeto["orgId"]
PROJETO = projeto["projectId"]

URL = "https://api.vercel.com/v9/projects/%s?teamId=%s" % (PROJETO, ORG)
req = urllib.request.Request(URL, headers={"Authorization": "Bearer " + token})

try:
    with urllib.request.urlopen(req, timeout=40) as r:
        dados = json.loads(r.read().decode())
except urllib.error.HTTPError as e:
    print("HTTP %d na consulta do projeto" % e.code)
    print(e.read().decode()[:300])
    raise SystemExit(1)

print("projeto: %s" % dados.get("name"))
print("framework: %s" % (dados.get("framework") or "(nao definido)"))
print("")

# protecao de implantacao costuma aparecer como ssoProtection ou
# passwordProtection. Os dois aparecem aqui porque o nome muda com a versao.
for chave in ("ssoProtection", "passwordProtection", "oidcProtection"):
    if chave in dados:
        print("%s: %s" % (chave, json.dumps(dados[chave])[:200]))

print("")
print("=== todas as chaves de protecao encontradas ===")
achadas = [k for k in dados if "rotect" in k or "ssword" in k or "sso" in k.lower()]
for k in achadas:
    print("  %s = %s" % (k, json.dumps(dados[k])[:180]))

if not achadas:
    print("  nenhuma")