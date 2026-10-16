/**
 * Table Tennis (Tenis de Mesa) 1 vs 1 Official ITTF Rulebook Controller
 * Interactive guide, searchable rules, and situation validator
 */

export const TABLE_TENNIS_1V1_RULES = [
  {
    id: "resumen",
    title: "5 Reglas de Oro (1v1)",
    icon: "⭐",
    content: `
      <div class="rule-highlight-box">
        <h4>⚡ Lo Básico para Jugar 1 contra 1</h4>
        <ul class="rule-bullets">
          <li><strong>Puntuación a 11 puntos:</strong> Gana el primer jugador que alcance 11 puntos con al menos 2 puntos de ventaja (ej: 11-9, 12-10).</li>
          <li><strong>Rotación de saque:</strong> Cada jugador saca <strong>2 veces seguidas</strong>. Si se llega a 10-10 (Deuce), se saca <strong>1 vez alternada</strong> por jugador.</li>
          <li><strong>El saque en 1v1 es libre:</strong> Puedes sacar a cualquier parte de la mesa rival (recto, cruzado o al centro). La línea central blanca solo se usa en dobles.</li>
          <li><strong>Prohibida la volea:</strong> Siempre debes dejar que la bola bote exactamente una vez en tu campo antes de golpearla.</li>
          <li><strong>Manos en la mesa:</strong> No puedes tocar la superficie de juego con la mano libre (la que no sostiene la pala). Si la tocas o mueves la mesa, pierdes el punto.</li>
        </ul>
      </div>
    `
  },
  {
    id: "saque",
    title: "El Saque Reglamentario",
    icon: "🏓",
    content: `
      <div class="rule-block">
        <h4>¿Cómo se ejecuta un saque legal según la ITTF?</h4>
        <ol class="rule-steps">
          <li><strong>Palma abierta y plana:</strong> La pelota debe reposar libremente sobre la palma abierta e inmóvil de la mano libre, sin ocultarla ni darle efecto previo con los dedos.</li>
          <li><strong>Detrás de la línea de fondo y sobre la mesa:</strong> Tanto la pelota como la pala deben estar por encima del nivel de la superficie de juego y por detrás de la línea de fondo de la mesa durante todo el servicio.</li>
          <li><strong>Lanzamiento vertical (+16 cm):</strong> La pelota debe ser lanzada hacia arriba casi verticalmente al menos 16 cm (sin efecto) y no debe ser golpeada mientras sube, sino en su fase descendente.</li>
          <li><strong>El golpeo:</strong> Debe botar primero en tu propio campo, pasar por encima de la red (sin tocarla) y botar en el campo contrario.</li>
          <li><strong>¿A dónde se saca en 1v1?:</strong> En individuales, el saque es completamente libre: puede dirigirse a cualquier zona del campo rival (no es obligatorio que sea en diagonal).</li>
        </ol>
        <div class="rule-tip">
          <strong>⚠️ Ocultar la pelota es falta:</strong> El rival y el árbitro deben ver la pelota en todo momento desde que se lanza hasta que es golpeada. Si tu cuerpo o brazo la oculta, el saque es ilegal.
        </div>
      </div>
    `
  },
  {
    id: "puntuacion",
    title: "Puntuación, Sets y Partido",
    icon: "🔢",
    content: `
      <div class="rule-block">
        <h4>Estructura del tanteo y sets</h4>
        <ul class="rule-bullets">
          <li><strong>Puntos por juego (Set):</strong> Un juego lo gana el jugador que primero anota <strong>11 puntos</strong>.</li>
          <li><strong>Diferencia de 2 puntos:</strong> Si ambos jugadores empatan a 10 puntos (10-10, Deuce), el juego continúa hasta que uno de los dos consiga 2 puntos de ventaja consecutivos (ej. 12-10, 13-11, 14-12).</li>
          <li><strong>Formato del partido:</strong> Los partidos oficiales se disputan habitualmente al <strong>Mejor de 5 sets</strong> (gana el primero en ganar 3 sets) o al <strong>Mejor de 7 sets</strong> (gana el primero en ganar 4 sets en finales internacionales). En partidas rápidas de club se suele jugar al mejor de 3 sets.</li>
          <li><strong>Elección de saque y campo:</strong> Se sortea con una moneda o escondiendo la pelota bajo la mesa. El ganador elige servir, recibir o el lado de la mesa.</li>
        </ul>
      </div>
    `
  },
  {
    id: "devolucion",
    title: "Devolución y Pelota en Juego",
    icon: "🔄",
    content: `
      <div class="rule-block">
        <h4>Pelota en juego y devoluciones válidas</h4>
        <ul class="rule-bullets">
          <li><strong>Un solo bote obligatorio:</strong> La pelota debe botar una vez en tu campo antes de que puedas golpearla. Tocarla en el aire antes de que bote es <em>volea</em> y se considera falta inmediata (punto para el adversario).</li>
          <li><strong>Paso de la red:</strong> La pelota devuelta debe pasar por encima o alrededor del conjunto de la red y tocar el campo del oponente.</li>
          <li><strong>Roce de red en peloteo continuo:</strong> Si durante el peloteo (no saque) la pelota roza la red y entra en el campo rival, <strong>sigue en juego y es válida</strong>.</li>
          <li><strong>Bordes de la mesa:</strong> Si la pelota toca el borde superior de la mesa (la arista horizontal), el tiro es <strong>válido</strong>. Si toca el lateral vertical de la madera, se considera fuera.</li>
          <li><strong>Golpe con la mano que tiene la pala:</strong> La pala se considera parte de la mano desde la muñeca. Si la pelota golpea los dedos de la mano que sujeta la pala y pasa legalmente, el tiro es válido.</li>
        </ul>
      </div>
    `
  },
  {
    id: "faltas",
    title: "Faltas y Puntos en Contra",
    icon: "❌",
    content: `
      <div class="rule-block">
        <h4>¿Cuándo pierdes un punto inmediatamente?</h4>
        <ul class="rule-bullets">
          <li><strong>Fallo de saque:</strong> Si no sirves correctamente (doble bote en tu campo, no llega a la mesa rival, o pelota fuera).</li>
          <li><strong>Fallo en la devolución:</strong> Si lanzas la bola fuera de la mesa rival o a la red sin pasar.</li>
          <li><strong>Doble toque voluntario:</strong> Golpear la pelota deliberadamente dos veces consecutivas.</li>
          <li><strong>Mano libre en la mesa:</strong> Apoyar o tocar la superficie de la mesa con la mano que no tiene la pala.</li>
          <li><strong>Mover la mesa:</strong> Mover o desplazar la superficie de juego con el cuerpo.</li>
          <li><strong>Tocar la red:</strong> Cualquier contacto del jugador, su ropa o su pala con la red o sus postes mientras la pelota está en juego.</li>
          <li><strong>Golpe de volea:</strong> Interceptar o tocar la pelota antes de que haya botado en tu propio lado.</li>
        </ul>
      </div>
    `
  },
  {
    id: "let",
    title: "Pelota Nula ('Let') y Cambios",
    icon: "🔔",
    content: `
      <div class="rule-block">
        <h4>¿Cuándo se declara repetición ('Let' o Nula)?</h4>
        <ul class="rule-bullets">
          <li><strong>Red en el servicio ("Net"):</strong> Si al sacar la pelota toca la red o sus soportes y luego entra correctamente en el campo rival, la jugada es nula y <strong>se repite el saque</strong> (no hay límite de repeticiones).</li>
          <li><strong>Saque antes de que el rival esté listo:</strong> Si el sacador ejecuta el servicio antes de que el receptor esté preparado (y el receptor no intenta devolverla).</li>
          <li><strong>Interrupción ajena:</strong> Si entra otra pelota en el área de juego, hay un ruido repentino o condiciones externas que afecten el tanto.</li>
        </ul>
        <h4 style="margin-top: 12px;">Cambio de lado de la mesa</h4>
        <ul class="rule-bullets">
          <li>Los jugadores cambian de lado de mesa al finalizar cada juego/set.</li>
          <li>En el último set decisivo (ej. 3º en mejor de 3, o 5º en mejor de 5), se cambia de campo tan pronto como el primer jugador anote <strong>5 puntos</strong>.</li>
        </ul>
      </div>
    `
  },
  {
    id: "asistente",
    title: "Validador de Jugadas Rápidas",
    icon: "❓",
    content: `
      <div class="rule-validator-box">
        <h4>Selecciona una situación típica para comprobar la decisión arbitral:</h4>
        <div class="validator-scenarios" id="validator-scenarios-container">
          <!-- Dynamically populated -->
        </div>
        <div id="validator-result" class="validator-result hidden"></div>
      </div>
    `
  }
];

export const VALIDATOR_QUESTIONS = [
  {
    q: "¿En un partido individual 1 contra 1, tengo que sacar en diagonal obligatoriamente?",
    verdict: "ES VÁLIDO SACAR RECTO O CRUZADO",
    isLegal: true,
    detail: "No. En individuales 1v1 el saque es libre hacia cualquier cuadrante del campo rival. La diagonal obligatoria y la línea divisoria central solo aplican en la modalidad de dobles."
  },
  {
    q: "¿Puedo golpear la pelota en el aire antes de que bote en mi mesa?",
    verdict: "¡FALTA INMEDIATA! (Punto para el rival)",
    isLegal: false,
    detail: "En tenis de mesa la volea está estrictamente prohibida. La pelota debe botar siempre exactamente una vez en tu campo antes de que puedas impactarla."
  },
  {
    q: "Si en el saque la pelota toca la red y después bota en el campo rival, ¿pierdo el punto?",
    verdict: "¡PELOTA NULA (LET)! Se repite el saque",
    isLegal: null,
    detail: "No pierdes el punto. Se canta 'Let' (red) y el servidor vuelve a sacar. Si toca la red y se va fuera de la mesa, entonces sí es punto para el rival."
  },
  {
    q: "¿Puedo apoyar mi mano libre (sin pala) en la mesa durante una jugada difícil?",
    verdict: "¡FALTA! (Punto para el rival)",
    isLegal: false,
    detail: "Cualquier contacto de la mano libre con la superficie de juego cuesta el punto inmediatamente. Tampoco está permitido mover la mesa con el cuerpo."
  },
  {
    q: "Durante el peloteo normal, la pelota toca la red pero pasa y cae en la mesa rival.",
    verdict: "¡JUGADA LEGAL! El juego continúa",
    isLegal: true,
    detail: "En el peloteo continuo (a diferencia del saque), si la pelota toca la red y pasa al campo contrario es completamente válida y el rival debe devolverla."
  },
  {
    q: "Empatamos 10-10 en el juego. ¿Cuántos saques consecutivos me corresponden?",
    verdict: "1 SOLO SAQUE POR TURNO",
    isLegal: true,
    detail: "En cuanto el marcador llega a 10-10 (Deuce), la rotación habitual de 2 saques finaliza. Desde ese momento cada jugador sirve 1 vez de forma alterna hasta que alguien consiga 2 puntos de ventaja."
  }
];

export class TableTennisRulesController {
  constructor() {
    this.modalEl = document.getElementById("rules-modal");
    this.searchInput = document.getElementById("rules-search-input");
    this.tabListContainer = document.getElementById("rules-tab-nav");
    this.contentContainer = document.getElementById("rules-section-content");
    this.activeTabId = "resumen";
    this.init();
  }

  init() {
    if (!this.modalEl) return;
    this.renderTabs();
    this.renderActiveSection();
    this.bindEvents();
  }

  open() {
    if (this.modalEl) {
      this.modalEl.classList.remove("hidden");
      this.modalEl.style.display = "flex";
      this.searchInput && (this.searchInput.value = "");
      this.activeTabId = "resumen";
      this.renderTabs();
      this.renderActiveSection();
    }
  }

  close() {
    if (this.modalEl) {
      this.modalEl.classList.add("hidden");
      this.modalEl.style.display = "none";
    }
  }

  renderTabs() {
    if (!this.tabListContainer) return;
    this.tabListContainer.innerHTML = TABLE_TENNIS_1V1_RULES.map(tab => `
      <button type="button" class="rules-tab-btn ${tab.id === this.activeTabId ? 'active' : ''}" data-tab="${tab.id}">
        <span class="tab-icon">${tab.icon}</span>
        <span class="tab-label">${tab.title}</span>
      </button>
    `).join("");

    this.tabListContainer.querySelectorAll(".rules-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.activeTabId = btn.dataset.tab;
        this.renderTabs();
        this.renderActiveSection();
      });
    });
  }

  renderActiveSection() {
    if (!this.contentContainer) return;
    const current = TABLE_TENNIS_1V1_RULES.find(t => t.id === this.activeTabId) || TABLE_TENNIS_1V1_RULES[0];
    this.contentContainer.innerHTML = `
      <div class="rules-active-header">
        <span class="header-icon">${current.icon}</span>
        <h3 class="header-title">${current.title}</h3>
      </div>
      <div class="rules-body-wrapper">
        ${current.content}
      </div>
    `;

    if (current.id === "asistente") {
      this.initValidatorWidget();
    }
  }

  initValidatorWidget() {
    const listEl = document.getElementById("validator-scenarios-container");
    const resultEl = document.getElementById("validator-result");
    if (!listEl) return;

    listEl.innerHTML = VALIDATOR_QUESTIONS.map((item, idx) => `
      <button type="button" class="validator-btn" data-idx="${idx}">
        <span class="q-num">${idx + 1}</span>
        <span class="q-text">${item.q}</span>
      </button>
    `).join("");

    listEl.querySelectorAll(".validator-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        listEl.querySelectorAll(".validator-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        const qIdx = parseInt(btn.dataset.idx, 10);
        const q = VALIDATOR_QUESTIONS[qIdx];
        if (resultEl) {
          resultEl.className = `validator-result ${q.isLegal === true ? 'verdict-legal' : q.isLegal === false ? 'verdict-fault' : 'verdict-let'}`;
          resultEl.innerHTML = `
            <div class="verdict-tag">${q.verdict}</div>
            <p class="verdict-detail">${q.detail}</p>
          `;
          resultEl.classList.remove("hidden");
        }
      });
    });
  }

  filterRules(keyword) {
    const term = (keyword || "").trim().toLowerCase();
    if (!term) {
      this.renderTabs();
      this.renderActiveSection();
      return;
    }

    if (!this.contentContainer) return;
    const matches = TABLE_TENNIS_1V1_RULES.filter(r => 
      r.title.toLowerCase().includes(term) || r.content.toLowerCase().includes(term)
    );

    if (matches.length === 0) {
      this.contentContainer.innerHTML = `
        <div class="rules-no-results">
          <p>🔍 No se encontraron reglas para <strong>"${keyword}"</strong>.</p>
          <p>Prueba buscando: <em>saque, red, mano, 11 puntos, deuce, volea, let</em>.</p>
        </div>
      `;
      return;
    }

    this.contentContainer.innerHTML = `
      <div class="rules-search-results">
        <h4 style="margin-bottom: 12px; color: #0072d6;">Resultados para "${keyword}" (${matches.length})</h4>
        ${matches.map(m => `
          <div class="rule-search-item" style="margin-bottom: 16px; padding: 12px; background: rgba(0,0,0,0.03); border-radius: 12px;">
            <h5 style="font-size: 15px; font-weight: 900; margin-bottom: 6px; color: #1f2e3d;">${m.icon} ${m.title}</h5>
            <div>${m.content}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  bindEvents() {
    const closeBtn = document.getElementById("btn-close-rules");
    closeBtn && closeBtn.addEventListener("click", () => this.close());

    const okBtn = document.getElementById("btn-rules-ok");
    okBtn && okBtn.addEventListener("click", () => this.close());

    if (this.searchInput) {
      this.searchInput.addEventListener("input", (e) => {
        this.filterRules(e.target.value);
      });
    }

    // Backdrop click and Escape key close
    this.modalEl.addEventListener("click", (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.modalEl && !this.modalEl.classList.contains("hidden")) {
        this.close();
      }
    });
  }
}
