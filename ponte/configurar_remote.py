import subprocess
from pathlib import Path

# Configura o remote do git usando o token do arquivo de segredos.
#
# O token vai para o gerenciador de credencial do git, nao para a URL do
# remote. Colocar na URL funciona, mas deixa o token em plaintext dentro
# de .git/config e aparece em `git remote -v`, em qualquer log e em
# qualquer copia do diretorio.

RAIZ = "/opt/data/worki-landing"
REPO = "worki-digital-landing"
DESTINO = "TrafegoWorki1/" + REPO

segredos = {}
for linha in Path("/opt/data/env.secrets").read_text(encoding="utf-8").splitlines():
    limpa = linha.strip()
    if not limpa or limpa.startswith("#") or "=" not in limpa:
        continue
    chave, _, valor = limpa.partition("=")
    segredos[chave.strip()] = valor.strip().strip("'\"")

token = segredos.get("GITHUB_TOKEN")
if not token:
    raise SystemExit("GITHUB_TOKEN ausente no arquivo de segredos")

print("token carregado: %d bytes (valor nao impresso)" % len(token))

# 1. Grava o token no gerenciador, com entrada por URL.
comando = [
    "git", "credential", "approve",
]
entrada = "protocol=https\nhost=github.com\nusername=TrafegoWorki1\npassword=%s\n\n" % token
proc = subprocess.run(comando, input=entrada.encode(), capture_output=True)
print("credential approve: exit=%d %s" % (
    proc.returncode, proc.stderr.decode()[:120]))

# 2. Remote sem token na URL.
subprocess.run(
    ["git", "remote", "remove", "origin"],
    cwd=RAIZ, capture_output=True,
)
proc = subprocess.run(
    ["git", "remote", "add", "origin",
     "https://github.com/" + DESTINO + ".git"],
    cwd=RAIZ, capture_output=True,
)
print("remote add: exit=%d %s" % (proc.returncode, proc.stderr.decode()[:160]))

# 3. Confere que a URL nao tem segredo.
proc = subprocess.run(["git", "remote", "-v"], cwd=RAIZ, capture_output=True)
saida = proc.stdout.decode()
print("")
print("remote configurado:")
for linha in saida.strip().split("\n"):
    print("  " + linha)
    if token in linha:
        raise SystemExit("FALHA: o token apareceu na URL do remote")