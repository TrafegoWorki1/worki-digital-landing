/* Gera o index.html da variante de 3 laminas a partir das tres pecas.

   Mesmo esquema da pagina principal: corpo, estilos e script sao a fonte,
   o html gerado e o que vai para o ar. */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));

const corpo = await readFile(join(AQUI, 'corpo.html'), 'utf8');
const estilos = await readFile(join(AQUI, 'estilos.css'), 'utf8');
const script = await readFile(join(AQUI, 'script.js'), 'utf8');

const html = corpo
  // Funcao, e nao string, no segundo argumento do replace: com string, o
  // `$$` do script vira `$` e o `$&` vira o texto casado.Foi assim que a
  // definicao de `$$` desapareceu do index.html sem o script.js mudar,
  // e o navegador morreu com "$ is not a function".
  .replace('<!--ESTILOS-->', () => `<style>\n${estilos}\n</style>`)
  .replace('<!--SCRIPTS-->', () => `<script>\n${script}\n</script>`);

const destino = join(AQUI, 'index.html');
await writeFile(destino, html, 'utf8');

// ---------- verificacoes ----------

let falhas = 0;
function checa(nome, condicao, detalhe) {
  if (condicao) {
    console.log('OK   ' + nome);
  } else {
    console.log('FALHA ' + nome + (detalhe ? '  -> ' + detalhe : ''));
    falhas += 1;
  }
}

console.log('\n== estrutura ==');
checa('tres laminas', (html.match(/class="lamina /g) || []).length === 3,
  (html.match(/class="lamina /g) || []).length + ' encontradas');
checa('nenhum bloco ESTILOS sobrando', !html.includes('<!--ESTILOS-->'));
checa('nenhum bloco SCRIPTS sobrando', !html.includes('<!--SCRIPTS-->'));
checa('estilos embutidos', html.includes('--amarelo: #F5B000'));
checa('script embutido', html.includes("var VARIANTE = 'tres-laminas'"));

// O teste de montagem confere texto, e texto passa mesmo com o script
// quebrado. O bug real desta pagina foi a declaracao de $ e $$ sumir do
// arquivo: o HTML gerava, as 60 verificacoes passavam, e no navegador o
// script morria na primeira linha com "$ is not a function".
//
// Aqui confere que os dois atalhos existem no script embutido.
checa('atalho $ definido', /var \$ = function \(s\)/.test(html));
checa('atalho $$ definido', /var \$\$ = function \(s\)/.test(html));
// Nomes de marcador que realmente quebram a pagina. O comentario do
// proprio montar.js cita PLACEHOLDER, entao a busca vai so no corpo e no
// script, nunca no arquivo de montagem.
checa('nenhum placeholder esquecido',
  !/function_param_placeholder/.test(corpo) && !/function_param_placeholder/.test(script));

console.log('\n== conteudo pedido ==');
checa('selo do hero', html.includes('ACELERAÇÃO DE VENDAS'));
checa('headline principal', html.includes('Você não precisa apenas de mais leads.'));
checa('segunda linha destacada', html.includes('Precisa transformar mais oportunidades em vendas.'));
checa('sub do hero', html.includes('Inteligência Artificial'));
checa('headline do gargalo', html.includes('Mais tráfego não resolve'));
checa('frase de destaque', html.includes('Pode estar no que acontece depois'));
checa('quatro pilares', html.includes('AQUISIÇÃO') && html.includes('AUTOMAÇÃO'));
checa('esteira do funil', html.includes('FOLLOW-UP') && html.includes('VENDA'));
checa('headline de autoridade', html.includes('Marketing não termina quando o lead entra.'));
checa('R$ 5 milhões', html.includes('+R$ 5 MILHÕES'));
checa('R$ 13 milhões', html.includes('+R$ 13 MILHÕES'));
checa('+70 projetos', html.includes('+70'));
checa('4+ anos', html.includes('4+ ANOS'));
checa('ressalva de resultado', html.includes('Resultados variam conforme mercado'));
checa('fecho final', html.includes('Descubra onde sua empresa está perdendo oportunidades'));

console.log('\n== modal ==');
checa('titulo do modal', html.includes('Vamos entender sua operação.'));
checa('um unico modal', (html.match(/id="modal"/g) || []).length === 1);
checa('etapa 1 de 2', html.includes('Etapa 1 de 2'));
// "Etapa 2 de 2" nao esta no HTML: o texto da etapa 2 e montado em tempo
// de execucao por mostrarEtapa(). Aqui conferimos que a funcao existe.
checa('etapa 2 de 2 em tempo de execucao',
  /mostrarEtapa\(2\)[\s\S]{0,200}Etapa ' \+ n \+ ' de 2|Etapa ' \+ n \+ ' de 2/.test(script));
checa('campo nome', html.includes('Qual é o seu nome?'));
checa('campo whatsapp', html.includes('Qual é o seu WhatsApp?'));
checa('mascara no placeholder', html.includes('(00) 00000-0000'));
checa('campo email', html.includes('Qual é o seu melhor e-mail?'));
checa('campo instagram', html.includes('@usuario'));
checa('pergunta do decisor', html.includes('SIM, SOU DECISOR'));
checa('pergunta do decisor parte 2', html.includes('PARTICIPO DA DECISÃO'));
checa('pergunta do decisor nao', html.includes('NÃO SOU DECISOR'));
checa('faixa ate 1 milhao', html.includes('R$ 500 mil a R$ 1 milhão'));
checa('faixa acima de 1 milhao', html.includes('Acima de R$ 1 milhão'));
checa('cargo socio', html.includes('Sócio / Proprietário'));
checa('cargo outro', html.includes('Outro'));
checa('botao enviar', html.includes('SOLICITAR MINHA ANÁLISE'));
checa('texto enviando', html.includes('ENVIANDO…'));
checa('tela de sucesso', html.includes('Solicitação recebida.'));
checa('botao whatsapp na sucesso', html.includes('FALAR COM A WORKI DIGITAL'));
checa('fechar por X', html.includes('data-fechar'));
checa('fechar por ESC', html.includes("ev.key === 'Escape'"));

console.log('\n== CTAs ==');
// Cinco CTAs: topo, hero, gargalo, autoridade e barra fixa do mobile.
// O do topo tambem abre o modal, entao conta.
const ctas = (html.match(/data-cta="/g) || []).length;
checa('cinco CTAs com data-cta', ctas === 5, ctas + ' encontrados');
checa('CTA do topo', html.includes('Solicitar análise'));
checa('CTA da barra fixa existe', html.includes('barra-fixa'));
checa('nenhum CTA com href externo direto', !/data-cta="[^"]*"[^>]*href=/.test(html));
checa('nenhum link wa.me solto no corpo', !html.includes('href="https://wa.me/'));

console.log('\n== design ==');
checa('fundo #080808', html.includes('--fundo: #080808'));
checa('amarelo #F5B000', html.includes('--amarelo: #F5B000'));
checa('fonte Inter', html.includes('family=Inter'));
checa('grid no hero', html.includes('grid-template-columns'));
checa('glow', html.includes('box-shadow'));
checa('barra fixa mobile', html.includes('.barra-fixa'));
checa('viewport com viewport-fit', html.includes('viewport-fit=cover'));
checa('safe area no modal', html.includes('env(safe-area-inset-bottom)'));
checa('sem overflow horizontal', html.includes('overflow-x: hidden'));

console.log('\n== tracking ==');
['PageView', 'CTA_Click', 'Form_Open', 'Form_Start', 'Lead', 'WhatsApp_Click']
  .forEach(function (evento) {
    checa('evento ' + evento, html.includes("'" + evento + "'"));
  });
checa('fbclid capturado', html.includes("query.get('fbclid')"));
checa('gclid capturado', html.includes("query.get('gclid')"));

console.log('\n== proibicoes ==');
checa('sem tabela de precos', !html.includes('R$ 1.500') && !html.includes('plano'));
// "pix" sem acento bate dentro de "pixel" e "fbq". Procura a palavra
// inteira, para nao acusar a pagina por causa do Meta Pixel.
checa('sem chave pix', !/\bpix\b/i.test(html) || /pixel|pixid/.test(html) && !/chave pix|pix:|pagamento via pix/i.test(html));
checa('sem promessa de garantia', !html.includes('garantia de'));
checa('sem nome de cliente', !html.includes('testemunho') && !html.includes('depoimento'));

console.log('\n== tamanho ==');
const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
console.log('index.html: ' + kb + ' KB');
checa('abaixo de 120 KB', Buffer.byteLength(html, 'utf8') < 120 * 1024);

console.log('');
if (falhas) {
  console.log(falhas + ' verificacao(oes) falharam.');
  process.exit(1);
}
console.log('Todas as ' + ' verificacoes passaram.');
