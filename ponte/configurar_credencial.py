import subprocess
from pathlib import Path

# Configura o gerenciador de credencial do git e grava o token.
#
# Antes disto o `git credential approve` rodava com exit 0 e nao gravava
# nada, porque nao havia credential.helper. Sem helper, o git tenta ler
# o usuario do terminal e falha com "could not read Username".

RAIZ = "/opt/data/worki-landing"

segredos = {}
for linha in Path("/opt/data/env.secrets").read_text(encoding="utf-8").splitlines():
    limpa = linha.strip()
    if not limpa or limpa.startswith("#") or "=" not in linha:
        continue
    chave, _, valor = limpa.partition("=")
    segredos[chave.strip()] = valor.strip().strip("'\"")

token = segredos.get("GITHUB_TOKEN")
if not token:
    raise SystemExit("GITHUB_TOKEN ausente")


def git(*argumentos, entrada=None):
    return subprocess.run(
        ["git"] + list(argumentos),
        cwd=RAIZ, input=entrada, capture_output=True,
    )


# 1. Helper que guarda em arquivo local, com permissao restrita.
proc = git("config", "credential.helper", "store --file=.git/credenciais")
print("helper store: exit=%d %s" % (proc.returncode, proc.stderr.decode()[:120]))

# 2. Grava a entrada, no formato que o helper store le: uma chave por
# linha, sem URL. Montar uma URL quebra, porque o token tem caractere que
# o git recusa em credencial embutida na URL.
entrada = "protocol=https\nhost=github.com\nusername=TrafegoWorki1\npassword=%s\n\n" % token
proc = git("credential", "approve", entrada=entrada.encode())
print("credential approve: exit=%d %s" % (proc.returncode, proc.stderr.decode()[:120]))

# 3. Permissao: o arquivo tem o token dentro. So o usuario atual pode ler.
caminho = Path(RAIZ) / ".git" / "credenciais"
if caminho.exists():
    caminho.chmod(0o600)
    print("permissao do arquivo de credenciais: 600")
else:
    print("FALHA: arquivo de credenciais nao foi criado")

# 4. Confere que o git consegue ler de volta, sem mostrar o valor.
proc = git("credential", "fill", entrada=b"protocol=https\nhost=github.com\n\n")
saida = proc.stdout.decode()
tem_usuario = "username=" in saida
tem_senha = "password=" in saida
print("credential fill: usuario=%s senha=%s" % (tem_usuario, tem_senha))
print("  o token nao aparece no arquivo de saida do comando: %s"
      % (token not in saida))

# 5. Garante que o arquivo de credenciais nunca entra no commit.
proc = git("check-ignore", "-v", ".git/credenciais")
print("ignorado pelo git: exit=%d" % proc.returncode)