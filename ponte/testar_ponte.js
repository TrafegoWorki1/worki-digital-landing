/* Testa a ponte por HTTP, de verdade.

   Foco nos casos de seguranca, que sao os que interessam: um servico
   que le e escreve arquivo e um vetor serio se nao for preso.

   Rodar: node testar_ponte.js
*/

const BASE = process.env.PONTE_URL || 'http://127.0.0.1:8787';
// Sem PONTE_TOKEN no ambiente o teste nao roda. Fixar um token aqui e
// perigoso: alguem copia o arquivo, usa o mesmo valor e a ponte fica
// com credencial conhecida.
if (!process.env.PONTE_TOKEN) {
  console.error('Defina PONTE_TOKEN antes de rodar. Exemplo:');
  console.error('  PONTE_TOKEN=$(openssl rand -hex 16) node testar_ponte.js');
  process.exit(2);
}
const TOKEN = process.env.PONTE_TOKEN;

let falhas = 0;
function teste(nome, ok, detalhe) {
  if (ok) console.log(`OK   ${nome}`);
  else { console.log(`FALHA ${nome}${detalhe ? ' -> ' + detalhe : ''}`); falhas++; }
}

async function chamar(rota, metodo, corpo, token = TOKEN) {
  const opcoes = { method: metodo, headers: {} };
  if (token) opcoes.headers.Authorization = `Bearer ${token}`;
  if (corpo) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }
  const r = await fetch(BASE + '/' + rota, opcoes);
  let dados = null;
  try { dados = await r.json(); } catch (e) { /* resposta sem corpo */ }
  return { status: r.status, dados };
}

console.log('== autenticacao ==');

let r = await chamar('estado', 'GET', null, null);
teste('sem token: 401', r.status === 401, `veio ${r.status}`);

r = await chamar('estado', 'GET', null, 'token-errado-com-tamanho-certo');
teste('token errado: 401', r.status === 401, `veio ${r.status}`);

r = await chamar('estado', 'GET', null, 'curto');
teste('token de tamanho errado: 401', r.status === 401, `veio ${r.status}`);

r = await chamar('estado', 'GET');
teste('token certo: 200', r.status === 200, `veio ${r.status}`);

console.log('\n== escapes de caminho ==');

const fugas = [
  '../../../../etc/passwd',
  '../../../etc/hosts',
  '/etc/passwd',
  'api/../../../../tmp/qualquer',
  './../../fora',
];

for (const caminho of fugas) {
  r = await chamar('escrever', 'POST', { caminho, conteudo: 'teste' });
  const barrado = r.status === 400 || (r.dados && r.dados.erro);
  teste(`escapa barrada: ${caminho}`, barrado,
    `veio ${r.status} ${JSON.stringify(r.dados)}`);
}

console.log('\n== lista de arquivos ==');

r = await chamar('escrever', 'POST', { caminho: 'novo-arquivo-qualquer.js', conteudo: 'x' });
teste('arquivo fora da lista barrado',
  r.dados && Array.isArray(r.dados.permitidos),
  JSON.stringify(r.dados));

r = await chamar('escrever', 'POST', { caminho: '.env', conteudo: 'TOKEN=roubado' });
teste('.env barrado', r.dados && r.dados.erro, JSON.stringify(r.dados));

r = await chamar('escrever', 'POST', { caminho: '../.env', conteudo: 'TOKEN=roubado' });
teste('.env via ../ barrado', r.dados && r.dados.erro, JSON.stringify(r.dados));

console.log('\n== metodo errado ==');

r = await chamar('escrever', 'GET');
teste('GET em escrita: 405', r.status === 405, `veio ${r.status}`);

r = await chamar('git_commit', 'GET');
teste('GET em commit: 405', r.status === 405, `veio ${r.status}`);

console.log('\n== nao existe execucao de comando ==');

const rotas = ['executar', 'exec', 'shell', 'run', 'cmd', 'bash', 'terminal', 'avaliar'];
for (const rota of rotas) {
  r = await chamadaSeguro(rota);
  teste(`rota ${rota} nao existe`, r.status === 404, `veio ${r.status}`);
}

async function chamadaSeguro(rota) {
  const opcoes = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ comando: 'id', cmd: 'id', shell: 'id' }),
  };
  const resp = await fetch(BASE + '/' + rota, opcoes);
  return { status: resp.status };
}

console.log('\n== corpo invalido e grande ==');

const opcoesRuim = {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: '{isto nao e json',
};
const respRuim = await fetch(BASE + '/escrever', opcoesRuim);
teste('JSON invalido: 400', respRuim.status === 400, `veio ${respRuim.status}`);

const grande = 'x'.repeat(2 * 1024 * 1024);
r = await chamar('escrever', 'POST', { caminho: 'index.html', conteudo: grande });
teste('corpo grande demais barrado', r.dados && r.dados.erro,
  JSON.stringify(r.dados));

console.log('\n== rotas funcionais ==');

r = await chamar('estado', 'GET');
teste('estado traz aviso de sessao efemera',
  r.dados && r.dados.sessao_efemera === true);
teste('estado traz o hash do commit',
  r.dados && Array.isArray(r.dados.git_log) && r.dados.git_log.length > 0,
  JSON.stringify(r.dados && r.dados.git_log));

r = await chamar('limite', 'GET');
teste('limite explica a limitacao real',
  r.dados && Array.isArray(r.dados.unreachable) && r.dados.unreachable.length > 0);

r = await chamar('ler', 'POST', { caminho: 'package.json' });
teste('ler arquivo permitido', r.status === 200 && r.dados.ok,
  JSON.stringify(r.dados).slice(0, 120));

r = await chamar('ler', 'POST', { caminho: '../etc/passwd' });
teste('ler barrado fora do projeto', r.dados && r.dados.erro);

r = await chamar('git_status', 'GET');
teste('git_status responde', r.status === 200);

console.log('\n== rate limit ==');

// 35 requisicoes seguidas. O limite e 30 por minuto, entao as ultimas
// devem comecar a dar 429.
let conta429 = 0;
for (let i = 0; i < 35; i++) {
  const resp = await chamar('estado', 'GET');
  if (resp.status === 429) conta429++;
}
teste('rate limit barra depois de 30', conta429 > 0,
  `${conta429} respostas 429 em 35 requisicoes`);

console.log('\n== resumo ==');
console.log(falhas === 0 ? 'Todos os testes passaram.' : `${falhas} teste(s) falharam.`);
process.exit(falhas === 0 ? 0 : 1);