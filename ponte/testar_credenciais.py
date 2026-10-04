import json
import urllib.error
import urllib.request
from pathlib import Path

# Testa se as credenciais do arquivo de segredos funcionam, sem
# imprimir valor nenhum. Um token no arquivo pode estar revogado, e
# descobrir isso depois de planejar o push e pior do que descobrir agora.
#
# Mostra so: se a chamada foi aceita e o login que o servico devolve.

segredos = {}
for linha in Path("/opt/data/env.secrets").read_text(encoding="utf-8").splitlines():
    limpa = linha.strip()
    if not limpa or limpa.startswith("#") or "=" not in limpa:
        continue
    chave, _, valor = limpa.partition("=")
    segredos[chave.strip()] = valor.strip().strip("'\"")


def teste_github():
    token = segredos.get("GITHUB_TOKEN", "")
    if not token:
        print("GITHUB_TOKEN ausente")
        return
    req = urllib.request.Request(
        "https://api.github.com/user",
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/vnd.github+json",
            "User-Agent": "verificacao-local",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            dados = json.loads(r.read().decode())
            print("GitHub: ACEITO, HTTP %d" % r.status)
            print("  login: %s" % dados.get("login", "?"))
            print("  tipo: %s" % dados.get("type", "?"))
    except urllib.error.HTTPError as e:
        print("GitHub: RECUSADO, HTTP %d" % e.code)
        print("  %s" % e.read().decode()[:160])
    except Exception as e:
        print("GitHub: ERRO %s" % e)


def teste_vercel():
    token = segredos.get("VERCEL_TOKEN", "")
    if not token:
        print("VERCEL_TOKEN ausente")
        return
    req = urllib.request.Request(
        "https://api.vercel.com/v2/user",
        headers={"Authorization": "Bearer " + token},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            dados = json.loads(r.read().decode())
            usuario = (dados.get("user") or {}).get("username", "?")
            print("Vercel: ACEITO, HTTP %d" % r.status)
            print("  usuario: %s" % usuario)
    except urllib.error.HTTPError as e:
        print("Vercel: RECUSADO, HTTP %d" % e.code)
        print("  %s" % e.read().decode()[:160])
    except Exception as e:
        print("Vercel: ERRO %s" % e)


print("== GitHub ==")
teste_github()
print("")
print("== Vercel ==")
teste_vercel()