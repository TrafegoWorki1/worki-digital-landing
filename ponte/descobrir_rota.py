import json
import os
import urllib.request
import urllib.error

# Todas as rotas deram 404, inclusive /message/sendText, que funcionou
# ontem. 404 em tudo, ate no que funciona, costuma ser prefixo de versao
# ou rota diferente. Descobre a raiz antes de concluir que a API died.

BASE = os.environ["EVOLUTION_API_URL"].rstrip("/")
INSTANCIA = os.environ["EVOLUTION_INSTANCE"]
CHAVE = os.environ["EVOLUTION_API_KEY"]


def sondar(url, metodo="GET"):
    req = urllib.request.Request(
        url, headers={"apikey": CHAVE, "Content-Type": "application/json"},
        method=metodo,
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.read().decode("utf-8", "replace")[:150]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")[:150]
    except Exception as e:
        return None, type(e).__name__


print("== raizes ==")
for url in [BASE + "/", BASE + "/v2", BASE + "/manager", BASE + "/api"]:
    status, corpo = sondar(url)
    print("  %-46s %s  %s" % (url.replace(BASE, ""), status, corpo[:70]))

print("")
print("== versao da API ==")
for caminho in ["/", "/v2/"]:
    status, corpo = sondar(BASE + caminho)
    if status == 200:
        print("  %s responde:" % caminho)
        print("  " + corpo[:300])

print("")
print("== instancia: quantas existem e como chamam ==")
status, corpo = sondar(BASE + "/instance/fetchInstances")
print("  fetchInstances: %s  %s" % (status, corpo[:200]))

print("")
print("== manda texto de verdade, o caminho que funcionou ontem ==")
corpo_json = json.dumps({
    "number": "558592494552",
    "text": "checagem de rota",
}).encode()

for caminho in ["/message/sendText/%s" % INSTANCIA,
                "/v2/message/sendText/%s" % INSTANCIA]:
    status, corpo = sondar(BASE + caminho, "POST")
    print("  %-42s %s  %s" % (caminho.replace(BASE, ""), status, corpo[:120]))