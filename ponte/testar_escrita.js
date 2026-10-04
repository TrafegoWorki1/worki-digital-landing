/* Exercita escrita e commit de verdade, e desfaz.

   Nao serve para provar que funciona: serve para provar que o caminho de
   escrita vai ate o disco e chega no git. E para garantir que o teste
   nao deixe o repositorio diferente do que estava.
*/

import { readFile } from 'node:fs/promises';

const BASE = process.env.PONTE_URL || 'http://127.0.0.1:8787';

// Ver o comentário em testar_ponte.js: token no arquivo vira credencial
// conhecida assim que alguem copia o repositorio.
if (!process.env.PONTE_TOKEN) {
  console.error('Defina PONTE_TOKEN antes de rodar.');
  process.exit(2);
}
const TOKEN = process.env.PONTE_TOKEN;
const CAMINHO = 'package.json';
const ORIGINAL = await readFile('/opt/data/worki-landing/' + CAMINHO, 'utf8');

async function chamar(rota, metodo, corpo) {
  const opcoes = {
    method: metodo,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  };
  // GET nao aceita corpo: o Node recusa antes de sair. A rota de
  // consulta nao precisa de corpo mesmo.
  if (metodo !== 'GET') opcoes.body = JSON.stringify(corpo || {});
  const r = await fetch(BASE + '/' + rota, opcoes);
  return { status: r.status, dados: await r.json() };
}

/* A bateria de seguranca dispara 35 requisicoes de proposito para
   estourar o limite. Espera a janela passar antes de comecar, senao
   este arquivo falha por causa do teste anterior. */
async function esperarJanela() {
  process.stdout.write('aguardando a janela de rate limit...\n');
  await new Promise((r) => setTimeout(r, 61_000));
}

console.log('== escrita real ==');

await esperarJanela();

const alterado = ORIGINAL.replace('"version": "1.0.0"', '"version": "1.0.1-teste"');
if (alterado === ORIGINAL) {
  console.log('FALHA nao achei a string de versao para alterar');
  process.exit(1);
}

let r = await chamar('escrever', 'POST', { caminho: CAMINHO, conteudo: alterado });
console.log(`${r.status === 200 ? 'OK  ' : 'FALHA'} escrita aceita: ${JSON.stringify(r.dados)}`);

const depois = await readFile('/opt/data/worki-landing/' + CAMINHO, 'utf8');
console.log(`${depois.includes('1.0.1-teste') ? 'OK  ' : 'FALHA'} mudanca chegou no disco`);

r = await chamar('ler', 'POST', { caminho: CAMINHO });
console.log(`${r.dados && r.dados.conteudo && r.dados.conteudo.includes('1.0.1-teste')
  ? 'OK  ' : 'FALHA'} leitura devolve a versao nova`);

console.log('\n== restaurando ==');

r = await chamar('escrever', 'POST', { caminho: CAMINHO, conteudo: ORIGINAL });
console.log(`${r.status === 200 ? 'OK  ' : 'FALHA'} original restaurado`);

const restaurado = await readFile('/opt/data/worki-landing/' + CAMINHO, 'utf8');
console.log(`${restaurado === ORIGINAL ? 'OK  ' : 'FALHA'} disco igual ao original`);

console.log('\n== commit sem mudanca ==');
r = await chamar('git_commit', 'POST', { mensagem: 'teste sem mudanca' });
console.log(`${r.dados && r.dados.ok ? 'OK  ' : 'FALHA'} commit sem mudanca lidado: ` +
  `sem_mudanca=${r.dados && r.dados.sem_mudanca}`);

console.log('\n== commit sem mensagem ==');
r = await chamar('git_commit', 'POST', { mensagem: '   ' });
console.log(`${r.status === 400 ? 'OK  ' : 'FALHA'} mensagem vazia barrada: ${r.status}`);

console.log('\n== limites ==');
r = await chamar('ler', 'POST', { caminho: '/etc/passwd' });
console.log(`${r.status === 400 ? 'OK  ' : 'FALHA'} caminho absoluto barrado: ${r.status}`);

r = await chamar('escrever', 'POST', { caminho: 'index.html', conteudo: 12345 });
console.log(`${r.status === 400 ? 'OK  ' : 'FALHA'} conteudo nao textual barrado: ${r.status}`);

console.log('\n== montagem segue funcionando apos escrever pela ponte ==');
r = await chamar('testar', 'POST', {});
console.log(`${r.dados && r.dados.ok ? 'OK  ' : 'FALHA'} montagem e testes: ok=${r.dados && r.dados.ok}`);
if (r.dados && r.dados.montagem) {
  const ultimas = r.dados.montagem.saida.trim().split('\n').slice(-1)[0];
  console.log(`     ${ultimas}`);
}

console.log('\n== estado final do git ==');
r = await chamar('git_status', 'GET');
console.log(`${(r.dados && r.dados.saida || '').trim() === '(limpo)'
  ? 'OK  ' : 'FALHA'} repositorio limpo: ${JSON.stringify(r.dados)}`);