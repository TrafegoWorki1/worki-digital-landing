/* Landing de 3 laminas — comportamento do modal, validacao e eventos.

   Regra central do dono: nenhum CTA redireciona. Todo CTA abre o mesmo
   modal. So existe WhatsApp depois que o lead foi registrado, e o botao
   do WhatsApp so aparece na tela de sucesso. */

(function () {
  'use strict';

  var VARIANTE = 'tres-laminas';
  var ENDPOINT = '/api/leads';
  var MENSAGEM_WHATSAPP =
    'Olá! Acabei de preencher a análise da Worki Digital e gostaria ' +
    'de falar sobre minha operação.';

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  // ---------- analytics ----------

  /* Nada de SDK externo por padrao. As funcoes sao o ponto unico de
     integracao: quando o META_PIXEL_ID existir, e so plugar aqui. */
  var analytics = {
    pageview: function () { dispara('PageView'); },
    cta: function (onde) { dispara('CTA_Click', { cta: onde }); },
    formOpen: function () { dispara('Form_Open'); },
    formStart: function () { dispara('Form_Start'); },
    lead: function () { dispara('Lead'); },
    whatsapp: function () { dispara('WhatsApp_Click'); },
  };

  function dispara(evento, params) {
    try {
      if (typeof window.fbq === 'function') {
        window.fbq('track', evento, params || {});
      }
      if (typeof window.gtag === 'function') {
        window.gtag('event', evento, params || {});
      }
      if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push({ evento: evento, ...(params || {}) });
      }
    } catch (e) {
      /* tracking quebrado nunca pode quebrar o formulario */
    }
  }

  // Atalhos de selecao. Ficao aqui, e nao dentro de IIFE aninhado,
  // porque sao usados em varias partes do script.
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  // ---------- UTMs ----------

  var UTMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var query = new URLSearchParams(window.location.search);

  // ---------- modal ----------

  var modal = $('#modal');
  var caixa = $('.modal__caixa');
  var formulario = $('#formulario');
  var corpo = $('#modal-corpo');
  var sucesso = $('#sucesso');
  var progresso = $('#progresso');
  var progressoTexto = $('#progresso-texto');
  var progressoBarra = $('#progresso-barra');
  var botaoEnviar = $('#enviar');
  var botaoWhatsapp = $('#botao-whatsapp');
  var barraFixa = $('#barra-fixa');

  var focoAntes = null;
  var enviando = false;
  var comecou = false;

  function abrirModal(onde) {
    if (modal.hidden) {
      focoAntes = document.activeElement;
      modal.hidden = false;
      document.body.classList.add('modal-aberto');
      analytics.formOpen();
      // Foco no primeiro campo. Com delay porque a animacao compete.
      setTimeout(function () {
        var primeiro = formulario.querySelector('input:not([type=radio])');
        if (primeiro) primeiro.focus({ preventScroll: true });
      }, 90);
    }
    analytics.cta(onde);
  }

  function fecharModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('modal-aberto');
    if (focoAntes && focoAntes.focus) focoAntes.focus({ preventScroll: true });
  }

  // ---------- CTAs ----------

  $$('[data-cta]').forEach(function (botao) {
    botao.addEventListener('click', function () {
      abrirModal(botao.getAttribute('data-cta'));
    });
  });

  $$('[data-fechar]').forEach(function (el) {
    el.addEventListener('click', fecharModal);
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !modal.hidden) fecharModal();
  });

  // ---------- etapas ----------

  var etapas = $$('.etapa-form');
  var etapaAtual = 1;

  function mostrarEtapa(n) {
    etapaAtual = n;
    etapas.forEach(function (e) {
      e.hidden = Number(e.getAttribute('data-etapa')) !== n;
    });
    progressoTexto.textContent = 'Etapa ' + n + ' de 2';
    progressoBarra.style.width = n * 50 + '%';
  }

  $$('[data-avancar]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (validarEtapa(1)) mostrarEtapa(2);
    });
  });

  $$('[data-voltar]').forEach(function (b) {
    b.addEventListener('click', function () { mostrarEtapa(1); });
  });

  // ---------- validacao ----------

  var RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function digitos(valor) {
    return String(valor || '').replace(/\D/g, '');
  }

  function mascaraTelefone(bruto) {
    var d = digitos(bruto).slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  function erro(campo, mensagem) {
    var alvo = document.querySelector('[data-erro="' + campo + '"]');
    if (alvo) alvo.textContent = mensagem || '';
    var input = formulario.querySelector('[name="' + campo + '"]');
    if (input) {
      if (mensagem) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  function valorRadio(nome) {
    var marcado = formulario.querySelector('input[name="' + nome + '"]:checked');
    return marcado ? marcado.value : '';
  }

  function validarEtapa(n) {
    var ok = true;

    if (n === 1) {
      var nome = $('#nome').value.trim();
      if (!nome) { erro('nome', 'Informe seu nome.'); ok = false; }
      else erro('nome', '');

      var tel = digitos($('#whatsapp').value);
      // 10 a 13 digitos. O endpoint normaliza com o 55.
      if (tel.length < 10 || tel.length > 13) {
        erro('whatsapp', 'Informe um WhatsApp válido com DDD.');
        ok = false;
      } else erro('whatsapp', '');

      var email = $('#email').value.trim();
      if (!email) { erro('email', 'Informe seu e-mail.'); ok = false; }
      else if (!RE_EMAIL.test(email)) { erro('email', 'E-mail inválido.'); ok = false; }
      else erro('email', '');

      var ig = $('#instagram').value.trim().replace(/^@/, '');
      if (!ig) { erro('instagram', 'Informe o Instagram.'); ok = false; }
      else erro('instagram', '');
    }

    if (n === 2) {
      var fat = valorRadio('faturamento');
      if (!fat) { erro('faturamento', 'Selecione a faixa de faturamento.'); ok = false; }
      else erro('faturamento', '');

      var cargo = valorRadio('cargo');
      if (!cargo) { erro('cargo', 'Selecione seu cargo.'); ok = false; }
      else erro('cargo', '');

      var decisor = valorRadio('decisor');
      if (!decisor) { erro('decisor', 'Selecione uma opção.'); ok = false; }
      else erro('decisor', '');
    }

    return ok;
  }

  // ---------- mascara e feedback ----------

  var campoTel = $('#whatsapp');
  campoTel.addEventListener('input', function () {
    campoTel.value = mascaraTelefone(campoTel.value);
  });

  $$('#formulario input').forEach(function (input) {
    input.addEventListener('input', function () {
      var campo = input.closest('.campo');
      if (campo && input.value.trim()) campo.classList.add('preenchido');
      if (!comecou) {
        comecou = true;
        analytics.formStart();
      }
    });
  });

  // ---------- envio ----------

  formulario.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (enviando) return;

    if (!validarEtapa(2)) return;

    enviando = true;
    botaoEnviar.disabled = true;
    botaoEnviar.textContent = 'ENVIANDO…';

    var corpo_ = {
      variante: VARIANTE,
      nome: $('#nome').value.trim(),
      whatsapp: digitos($('#whatsapp').value),
      email: $('#email').value.trim().toLowerCase(),
      instagram: $('#instagram').value.trim(),
      faturamento: valorRadio('faturamento'),
      cargo: valorRadio('cargo'),
      decisor: valorRadio('decisor'),
      page_url: window.location.href,
      origem_pagina: 'landing-3-laminas',
    };

    UTMS.forEach(function (chave) {
      corpo_[chave] = query.get(chave) || '';
    });
    corpo_.fbclid = query.get('fbclid') || '';
    corpo_.gclid = query.get('gclid') || '';

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo_),
    })
      .then(function (r) {
        return r.json().then(function (d) { return { ok: r.ok, dados: d }; });
      })
      .then(function (resposta) {
        if (!resposta.ok) {
          throw new Error(resposta.dados.erro || 'Não foi possível enviar agora.');
        }
        // O link vem do servidor, montado com WHATSAPP_NUMBER. Sem ele,
        // a tela de sucesso nao tem para onde levar o lead.
        analytics.lead();

        progresso.hidden = true;
        formulario.hidden = true;
        $('.modal__cabecalho').hidden = true;

        var link = resposta.dados.whatsapp;
        if (link) {
          botaoWhatsapp.href = link;
        } else {
          botaoWhatsapp.hidden = true;
        }

        sucesso.hidden = false;
        botaoWhatsapp.addEventListener('click', function () {
          analytics.whatsapp();
        }, { once: true });
      })
      .catch(function (erro) {
        // Falha aqui e falha de verdade: o lead nao foi registrado, e o
        // formulario precisa ficar preenchido para a pessoa tentar de novo.
        var aviso = document.createElement('p');
        aviso.className = 'campo__erro';
        aviso.style.color = '#e46b6b';
        aviso.textContent = erro.message + ' Tente novamente.';
        formulario.appendChild(aviso);
        enviando = false;
        botaoEnviar.disabled = false;
        botaoEnviar.textContent = 'SOLICITAR MINHA ANÁLISE';
      });
  });

  // ---------- barra fixa ----------

  /* Aparece depois da primeira lamina. Medido pelo topo do hero saindo
     da tela, e nao por scroll: hero tem altura variavel. */
  var hero = $('#lamina-01');
  if ('IntersectionObserver' in window) {
    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) barraFixa.hidden = false;
      });
    }, { threshold: 0 });
    observador.observe(hero);
  } else {
    barraFixa.hidden = false;
  }

  analytics.pageview();
})();
