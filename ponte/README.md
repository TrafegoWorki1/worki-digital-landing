Ponte HTTP para inspecao e edicao do projeto

Servico que expoe o estado do trabalho do agente em um container
efemero, para um agente rodando em outra maquina inspecionar e editar.

O QUE ESTA PONTE NAO RESOLVE

A sessao do Hermes roda em container sem IP publico e sem porta
escutando. Um agente no PC do dono nao alcanca este processo. Nao
existe "conectar" no sentido de abrir conexao.

A ponte ajuda se houver rota de rede entre as duas maquinas. Se nao
houver, o caminho que resolve e git autenticado dentro do container,
com push para o GitHub. A ponte nao substitui isso.

LIMITE DE SEGURANCA, POR DECISAO

- Nao existe execucao de comando de sistema.
- Nao existe shell remoto.
- Nao existe rota que aceite "execute isso".

Um endpoint que aceita comando arbitrario e uma porta aberta para
qualquer um que leia o codigo. Isso nao e ponte, e backdoor. Como a
ponte exige token e o token passa por canal de conversa, e canal de
conversa copia e sincroniza, a superficie de ataque e pequena demais
para aceitar esse risco.

A escrita e restrita a nove arquivos nomeados. O cliente escolhe qual
rota chamar, nunca qual comando executar.

PUBLICAR FORA DA PONTE

Commit e git status existem. Push nao existe. Publicacao nao existe.
Publicar e deploy sao decisao do dono, e nao um POST de quem leu o
token.

USAR

    openssl rand -hex 32
    PONTE_TOKEN=<segredo> node servidor.js
    PONTE_PORTA=8780 node servidor.js

Sem PONTE_TOKEN a ponte nao sobe. Com token de menos de 16 caracteres
ela responde 503, porque token curto e chute, nao credencial.

ROTAS

| Rota | Metodo | O que faz |
|---|---|---|
| estado | GET | arquivos, commit, aviso de sessao efemera |
| limite | GET | limitacoes reais da ponte |
| ler | POST | le um arquivo do projeto |
| escrever | POST | escreve um dos nove arquivos permitidos |
| testar | POST | roda montagem e bateria de testes |
| git_status | GET | arquivos alterados |
| git_commit | POST | add e commit, sem push |

TESTAR

    node testar_ponte.js      # 33 testes, foco em seguranca
    node testar_escrita.js    # escrita real e restauracao

testar_escrita.js espera 61 segundos no comeco: a bateria de seguranca
dispara 35 requisicoes de proposito para estourar o limite de 30 por
minuto, e sem a espera este arquivo falha por causa da anterior.

O QUE OS TESTES ACHARAM

Duas falhas reais durante o desenvolvimento:

1. Corpo grande demais derrubava a conexao com ECONNRESET, sem codigo de
   erro. Agora responde 413 e o cliente sabe o que aconteceu.

2. Rota inexistente devolvia 405 em vez de 404, porque a checagem de
   metodo vinha antes da checagem de rota. Um 405 em rota que nao existe
   esconde que a rota nao existe. Agora 404 vem primeiro.

Uma falha so no teste, nao no servidor: `ler` recebe POST mas estava na
lista de metodo GET.