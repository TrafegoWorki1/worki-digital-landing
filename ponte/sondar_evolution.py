import json
import os
import urllib.request
import urllib.error

# Sonda quais rotas de midia a Evolution deste ambiente realmente expoe.
#
# A pergunta e sobre audio e documento chegado pelo WhatsApp. Antes de
# prometer caminho, checa se o endpoint existe: a versao 2.3.7 nao tem
# /chat/fetchMessages, e sem isso o receptor nunca ve a midia.

BASE = os.environ["EVOLUTION_API_URL"].rstrip("/")
INSTANCIA = os.environ["EVOLUTION_INSTANCE"]
CHAVE = os.environ["EVOLUTION_API_KEY"]

print("base: %s" % BASE)
print("instancia: %s" % INSTANCIA)
print("")

ROTAS = [
    ("listar mensagens", "/chat/fetchMessages/%s" % INSTANCIA),
    ("buscar midia de mensagem", "/chat/fetchMediaFromMessage/%s" % INSTANCIA),
    ("baixar midia", "/chat/getBase64FromMediaMessage/%s" % INSTANCIA),
    ("enviar midia", "/message/sendMedia/%s" % INSTANCIA),
    ("enviar texto", "/message/sendText/%s" % INSTANCIA),
    ("grupos", "/group/fetchAll/%s" % INSTANCIA),
]

for nome, rota in ROTAS:
    url = BASE + rota
    req = urllib.request.Request(url, headers={"apikey": CHAVE})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            corpo = r.read().decode("utf-8", "replace")
            print("%-28s HTTP %s  %s" % (
                nome, r.status, corpo[:90].replace("\n", " ")))
    except urllib.error.HTTPError as e:
        print("%-28s HTTP %s  (erro do servico)" % (nome, e.code))
    except Exception as e:
        print("%-28s ERRO %s" % (nome, type(e).__name__))