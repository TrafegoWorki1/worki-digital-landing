# Variante de 3 laminas

Landing page curta, focada em conversao. Tres laminas, um modal de
qualificacao, cinco CTAs que nao redirecionam.

## Estrutura

Lamina 01, hero com promessa e esteira do lead.
Lamina 02, o gargalo, os quatro pilares e o funil.
Lamina 03, autoridade com indicadores e CTA final.

Regra do dono que a pagina respeita: nenhum CTA redireciona. Todos abrem
o mesmo modal. O WhatsApp so aparece na tela de sucesso, depois que o
lead foi gravado.

## Arquivos

corpo.html   o conteudo, com os marcadores <!--ESTILOS--> e <!--SCRIPTS-->
estilos.css  dark premium, amarelo so em CTA e indicador
script.js    modal em duas etapas, validacao, mascara e eventos
montar.js    gera o index.html e roda as verificacoes

Para mudar qualquer coisa, edite a peca e rode `node montar.js`. Nao edite
o index.html: ele e gerado.

## Testes

    node montar.js                    # 63 verificacoes de montagem
    LEADS_DIR=/tmp/leads node ../testar_3laminas.js   # 26 testes do endpoint

## Dois bugs que os testes nao pegavam, e como foram resolvidos

### O `$$` sumia do HTML gerado

O `montar.js` usava `corpo.replace('<!--SCRIPTS-->', \`<script>${script}</script>\`)`.
Com string no segundo argumento, o `$$` do script vira `$` e o `$&` vira o
texto casado. O `script.js` estava certo e o `index.html` ficava errado.

Sintoma: no navegador o script morria em `campoTel.addEventListener is not
a function`, porque `$('#whatsapp')` devolvia array vazio em vez do input.

Correcao: segundo argumento do `replace` virou funcao, que nao sofre
substituicao de `$`. E `montar.js` ganhou duas verificacoes que falham se
`$` ou `$$` sumirem do html embutido.

### O teste acusava a propria pagina

A verificacao de placeholder procurava a palavra `PLACEHOLDER` no html
inteiro, e o comentario do `montar.js` citando o bug continha a palavra e
acusava a pagina. Agora a busca so olha `corpo.html` e `script.js`.

Por que isso importa: teste que acusa o codigo certo por motivo errado
vira teste que ninguem acredita depois. O mesmo vale para "quatro CTAs"
sendo cinco, porque o CTA do topo tambem abre o modal.

## Endpoint

`POST /api/leads` com `variante: 'tres-laminas'`. Campos a mais em relacao
a pagina antiga: `email` obrigatorio, `cargo`, `instagram`, `decisor`,
`page_url`, `origem_pagina`.

A faixa de faturamento e validada contra a lista da variante, que tem
`R$ 500 mil a R$ 1 milhão` e `Acima de R$ 1 milhão`. A lista da pagina
antiga continua valendo para os envios dela.

## Configuracao

    WHATSAPP_NUMBER   numero que recebe o lead. Sem isso a tela de
                      sucesso aparece sem botao de WhatsApp.
    WEBHOOK_URL       destino do cadastro, opcional.
    WEBHOOK_TOKEN     cabecalho Authorization, opcional.

O numero nunca vai para o navegador: o link e montado no servidor.

## Limites conhecidos

- Sem banco de dados, por decisao do dono. O lead fica em arquivo no
  servidor, que e efemero: some no proximo deploy.
- Os IDs de Meta Pixel, GA4 e GTM nao estao no html. As funcoes de evento
  existem em `analytics` no `script.js` e so precisam de plugar o SDK.
- Os numeros do painel de exemplo sao ilustrativos, e a pagina diz isso.