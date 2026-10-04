import json
import urllib.request
import urllib.error
from pathlib import Path

# Desliga a protecao SSO do projeto.
#
# CONTEXTO: o dono pediu publicacao em producao com autorizacao explicita
# ("sobe"). A pagina e de captacao de lead para o publico, entao a
# protecao de implantacao nao pode ficar ligada: sem ela, qualquer
# visitante cai numa tela de login da Vercel e a landing nao existe
# para ninguem.
#
# A protecao estava em all_except_custom_domains, ou seja,ava valendo
# justamente no endereco padrao da plataforma, que e o endereco pedido.
#
# Nao mexi em dominio, DNS, protecao de branch nem permissao de repositorio.

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

print("== estado antes ==")
req = urllib.request.Request(URL, headers={"Authorization": "Bearer " + token})
with urllib.request.urlopen(req, timeout=40) as r:
    antes = json.loads(r.read().decode())
print("  ssoProtection: %s" % json.dumps(antes.get("ssoProtection")))

print("")
print("== desligando ==")

# A API de patch aceita o corpo parcial. Mandar ssoProtection como null
# remove a protecao.
corpo = {"ssoProtection": None}
req = urllib.request.Request(
    URL,
    headers={
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
    },
    data=json.dumps(corpo).encode(),
    method="PATCH",
)

try:
    with urllib.request.urlopen(req, timeout=40) as r:
        depois = json.loads(r.read().decode())
        print("  HTTP %d" % r.status)
except urllib.error.HTTPError as e:
    print("  RECUSADO, HTTP %d" % e.code)
    print("  %s" % e.read().decode()[:400])
    raise SystemExit(1)

print("  ssoProtection agora: %s" % json.dumps(depois.get("ssoProtection")))

print("")
print("== conferindo ==")
req = urllib.request.Request(URL, headers={"Authorization": "Bearer " + token})
with urllib.request.urlopen(req, timeout=40) as r:
    final = json.loads(r.read().decode())
valor = final.get("ssoProtection")
print("  ssoProtection: %s" % json.dumps(valor))
print("  protegido: %s" % ("sim" if valor else "nao"))