import sys
from pathlib import Path

# Lista os NOMES das variaveis de um arquivo .env, sem mostrar valor.
# Existe para responder o que esta guardado ali sem despejar segredo
# na conversa: imprime so a chave, o tamanho do valor e um prefixo de 3
# caracteres, o suficiente para identificar qual credencial e.

caminho = Path(sys.argv[1] if len(sys.argv) > 1 else "/opt/data/env.secrets")

if not caminho.is_file():
    print("arquivo nao existe: %s" % caminho)
    sys.exit(1)

texto = caminho.read_text(encoding="utf-8", errors="replace")
linhas = texto.splitlines()

print("arquivo: %s" % caminho)
print("linhas: %d" % len(linhas))
print("bytes: %d" % len(texto.encode("utf-8")))
print("")

achadas = 0
vazias = 0

for numero, linha in enumerate(linhas, 1):
    limpa = linha.strip()
    if not limpa or limpa.startswith("#"):
        continue
    if "=" not in limpa:
        print("linha %d: [sem igual, ignorada]" % numero)
        continue

    chave, _, valor = limpa.partition("=")
    chave = chave.strip()
    valor = valor.strip().strip("'\"")
    achadas += 1

    if not valor or valor == "***":
        vazias += 1
        print("linha %3d: %-30s VAZIA" % (numero, chave))
    else:
        tamanho = len(valor)
        prefixo = valor[:3] if tamanho > 8 else ""
        print("linha %3d: %-30s %4d bytes  prefixo=%s"
              % (numero, chave, tamanho, prefixo))

print("")
print("variaveis com valor: %d" % (achadas - vazias))
print("variaveis vazias: %d" % vazias)
print("total: %d" % achadas)