"""Acha caractere que quebra o HTML.

Motivo concreto: a pagina abriu com um emoji no titulo que eu nao escrevi,
e o script nao rodou. Suspeita de caractere estranho dentro do arquivo.

Mostra o caractere, a posicao e a linha, sem alterar nada.
"""

import unicodedata
import sys
from pathlib import Path

ARQUIVO = Path(sys.argv[1] if len(sys.argv) > 1 else "/opt/data/worki-landing/tres-laminas/index.html")

texto = ARQUIVO.read_text(encoding="utf-8")

# Faixa suspeita: acima do latim-1, onde mora emoji, seta e simbolo.
# 0x2010-0x2027 e pontuacao legitima (traco, aspa) e nao interessa.
def suspeito(c):
    p = ord(c)
    if p < 0x80:
        return False
    if 0x2010 <= p <= 0x2027:   # traco, aspa tipografica: normal
        return False
    if 0x00A0 <= p <= 0x00FF:   # latim-1 acentuado: normal
        return False
    if c == "�":
        return True
    # Emoji, seta grossa, simbolo matematico, bloco privado
    if p >= 0x2100:
        return True
    return False


achados = 0
for numero, linha in enumerate(texto.splitlines(), 1):
    for coluna, caractere in enumerate(linha, 1):
        if suspeito(caractere):
            achados += 1
            nome = unicodedata.name(caractere, "SEM NOME")
            print("linha %4d  coluna %4d  U+%04X  %s" % (numero, coluna, ord(caractere), nome))
            print("          contexto: %r" % linha.strip()[:90])
            print("          caractere: %r" % caractere)
            print("")

print("total de caracteres suspeitos: %d" % achados)
