/**
 * Match Statistics Overlay Controller for Argon Table Tennis 3D
 * Displays detailed match & set analytics: total smashes, longest rally, successful returns, etc.
 */

export class MatchStatisticsOverlay {
  constructor(options = {}) {
    this.options = options;
    this.modalEl = document.getElementById("match-stats-modal");
    this.isVisible = false;
    this.currentData = null;
    this.countdownTimer = null;
    this.countdownRemaining = 0;

    this._bindEvents();
  }

  _bindEvents() {
    if (!this.modalEl) return;

    // Close button
    const btnClose = this.modalEl.querySelector("#btn-close-stats");
    if (btnClose) {
      btnClose.addEventListener("click", () => this.close());
    }

    // Modal background click
    this.modalEl.addEventListener("click", (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });

    // Escape key
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isVisible) {
        this.close();
      }
    });

    // Action buttons inside modal
    const btnNextSet = this.modalEl.querySelector("#btn-stats-next-set");
    if (btnNextSet) {
      btnNextSet.addEventListener("click", () => {
        this._stopCountdown();
        this.close();
        if (typeof this.options.onNextSet === "function") {
          this.options.onNextSet();
        }
      });
    }

    const btnPlayAgain = this.modalEl.querySelector("#btn-stats-play-again");
    if (btnPlayAgain) {
      btnPlayAgain.addEventListener("click", () => {
        this._stopCountdown();
        this.close();
        if (typeof this.options.onPlayAgain === "function") {
          this.options.onPlayAgain();
        }
      });
    }

    const btnMenu = this.modalEl.querySelector("#btn-stats-menu");
    if (btnMenu) {
      btnMenu.addEventListener("click", () => {
        this._stopCountdown();
        this.close();
        if (typeof this.options.onReturnToMenu === "function") {
          this.options.onReturnToMenu();
        }
      });
    }
  }

  /**
   * Shows match or set statistics
   * @param {Object} data Statistics payload
   * @param {'set'|'match'|'view'} type Event type
   */
  show(data = {}, type = "match") {
    if (!this.modalEl) return;
    this._stopCountdown();
    this.currentData = data;
    this.currentType = type;

    this._renderContent(data, type);
    this.modalEl.classList.remove("hidden");
    this.modalEl.style.display = "flex";
    this.isVisible = true;

    // If it's a set end, set an optional friendly countdown to auto-continue after 8 seconds
    if (type === "set") {
      this._startCountdown(8);
    }
  }

  close() {
    this._stopCountdown();
    if (!this.modalEl) return;
    this.modalEl.classList.add("hidden");
    this.modalEl.style.display = "none";
    this.isVisible = false;
  }

  _stopCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  _startCountdown(seconds) {
    this.countdownRemaining = seconds;
    const countdownEl = this.modalEl.querySelector("#stats-next-set-countdown");
    if (countdownEl) {
      countdownEl.textContent = `(${this.countdownRemaining}s)`;
    }

    this.countdownTimer = setInterval(() => {
      this.countdownRemaining -= 1;
      if (countdownEl) {
        countdownEl.textContent = `(${this.countdownRemaining}s)`;
      }
      if (this.countdownRemaining <= 0) {
        this._stopCountdown();
        this.close();
        if (typeof this.options.onNextSet === "function") {
          this.options.onNextSet();
        }
      }
    }, 1000);
  }

  _renderContent(data, type) {
    const isSet = type === "set";
    const titleEl = this.modalEl.querySelector("#stats-modal-title");
    const subtitleEl = this.modalEl.querySelector("#stats-modal-subtitle");
    const badgeEl = this.modalEl.querySelector("#stats-badge-type");
    const p1NameEl = this.modalEl.querySelector("#stats-p1-header-name");
    const p2NameEl = this.modalEl.querySelector("#stats-p2-header-name");

    const p1Name = data.player1Name || "Tú (Jugador 1)";
    const p2Name = data.player2Name || (data.is1v1 ? "Jugador 2" : (data.isPro ? "Matt (IA Pro)" : "Club IA"));

    if (p1NameEl) p1NameEl.textContent = p1Name;
    if (p2NameEl) p2NameEl.textContent = p2Name;

    if (badgeEl) {
      badgeEl.textContent = isSet ? `SET ${data.currentSetNumber || 1} FINALIZADO` : "ESTADÍSTICAS FINALES";
      badgeEl.className = isSet ? "stats-badge badge-set" : "stats-badge badge-match";
    }

    if (titleEl) {
      titleEl.textContent = isSet
        ? `Estadísticas del Set ${data.currentSetNumber || 1}`
        : "Análisis y Estadísticas del Partido";
    }

    if (subtitleEl) {
      const pGames = Number(data.playerGames || 0);
      const oGames = Number(data.opponentGames || 0);
      const setScoreStr = isSet
        ? `Resultado del Set: ${data.setPlayerPoints || 0} - ${data.setOpponentPoints || 0}`
        : `Resultado Final: ${pGames} - ${oGames} Sets (${data.winner === "player" ? "Victoria Jugador 1" : "Victoria Rival"})`;
      subtitleEl.textContent = setScoreStr;
    }

    // Toggle Action Buttons depending on set vs match
    const nextSetWrap = this.modalEl.querySelector("#stats-actions-next-set");
    const matchActionsWrap = this.modalEl.querySelector("#stats-actions-match");
    if (nextSetWrap) nextSetWrap.classList.toggle("hidden", !isSet);
    if (matchActionsWrap) matchActionsWrap.classList.toggle("hidden", isSet);

    // Primary metrics extraction
    const pSmashes = Number(data.playerSmashes || 0);
    const oSmashes = Number(data.opponentSmashes || 0);
    const longestRally = Number(data.longestRally || 0);
    const pReturns = Number(data.playerReturns || 0);
    const oReturns = Number(data.opponentReturns || 0);
    const pPoints = Number(data.playerTotalPoints || 0);
    const oPoints = Number(data.opponentTotalPoints || 0);
    const pMaxSpeed = Number(data.playerMaxSpeedKmh || 0);
    const oMaxSpeed = Number(data.opponentMaxSpeedKmh || 0);
    const pServePoints = Number(data.playerServicePoints || 0);
    const oServePoints = Number(data.opponentServicePoints || 0);

    // Compute return accuracy if possible
    const pTotalShots = Math.max(1, pReturns + (data.playerErrors || 0));
    const oTotalShots = Math.max(1, oReturns + (data.opponentErrors || 0));
    const pReturnRate = Math.min(100, Math.round((pReturns / pTotalShots) * 100));
    const oReturnRate = Math.min(100, Math.round((oReturns / oTotalShots) * 100));

    // Fill Highlight Metric Cards
    this._setCardValue("stat-smashes-p1", pSmashes);
    this._setCardValue("stat-smashes-p2", oSmashes);
    this._setBar("bar-smashes-p1", "bar-smashes-p2", pSmashes, oSmashes);

    this._setCardValue("stat-longest-rally-val", `${longestRally} golpes`);
    const rallyBadge = this.modalEl.querySelector("#stat-rally-badge");
    if (rallyBadge) {
      if (longestRally >= 20) {
        rallyBadge.textContent = "🔥 ¡ÉPICO / CLASE MUNDIAL!";
        rallyBadge.className = "metric-pill pill-gold";
      } else if (longestRally >= 12) {
        rallyBadge.textContent = "⚡ RALLY INTENSO";
        rallyBadge.className = "metric-pill pill-cyan";
      } else if (longestRally >= 6) {
        rallyBadge.textContent = "🎾 BUEN INTERCAMBIO";
        rallyBadge.className = "metric-pill pill-green";
      } else {
        rallyBadge.textContent = "RALLY RÁPIDO";
        rallyBadge.className = "metric-pill pill-gray";
      }
    }

    this._setCardValue("stat-returns-p1", `${pReturns} (${pReturnRate}%)`);
    this._setCardValue("stat-returns-p2", `${oReturns} (${oReturnRate}%)`);
    this._setBar("bar-returns-p1", "bar-returns-p2", pReturns, oReturns);

    this._setCardValue("stat-speed-p1", `${pMaxSpeed > 0 ? pMaxSpeed : "--"} km/h`);
    this._setCardValue("stat-speed-p2", `${oMaxSpeed > 0 ? oMaxSpeed : "--"} km/h`);
    this._setBar("bar-speed-p1", "bar-speed-p2", pMaxSpeed, oMaxSpeed);

    this._setCardValue("stat-points-p1", pPoints);
    this._setCardValue("stat-points-p2", oPoints);
    this._setBar("bar-points-p1", "bar-points-p2", pPoints, oPoints);

    this._setCardValue("stat-serve-pts-p1", pServePoints);
    this._setCardValue("stat-serve-pts-p2", oServePoints);
    this._setBar("bar-serve-pts-p1", "bar-serve-pts-p2", pServePoints, oServePoints);

    // Render Set History
    const historyContainer = this.modalEl.querySelector("#stats-set-history-list");
    if (historyContainer) {
      const history = Array.isArray(data.setHistory) ? data.setHistory : [];
      if (history.length === 0) {
        historyContainer.innerHTML = `<div class="history-empty">Primer set en disputa</div>`;
      } else {
        historyContainer.innerHTML = history.map((s, idx) => {
          const isP1Won = s.playerPoints > s.opponentPoints;
          const winnerClass = isP1Won ? "set-p1-won" : "set-p2-won";
          const winnerTag = isP1Won ? `✓ Ganado por ${p1Name}` : `✓ Ganado por ${p2Name}`;
          return `
            <div class="set-history-row ${winnerClass}">
              <div class="set-row-label">
                <span class="set-number-tag">Set ${s.setNumber || idx + 1}</span>
                <span class="set-winner-label">${winnerTag}</span>
              </div>
              <div class="set-row-score">
                <span class="score-box p1 ${isP1Won ? 'winner' : ''}">${s.playerPoints}</span>
                <span class="score-hyphen">-</span>
                <span class="score-box p2 ${!isP1Won ? 'winner' : ''}">${s.opponentPoints}</span>
              </div>
            </div>
          `;
        }).join("");
      }
    }
  }

  _setCardValue(id, val) {
    const el = this.modalEl.querySelector(`#${id}`);
    if (el) el.textContent = String(val);
  }

  _setBar(id1, id2, v1, v2) {
    const el1 = this.modalEl.querySelector(`#${id1}`);
    const el2 = this.modalEl.querySelector(`#${id2}`);
    if (!el1 || !el2) return;

    const sum = v1 + v2;
    if (sum === 0) {
      el1.style.width = "50%";
      el2.style.width = "50%";
      return;
    }
    const pct1 = Math.max(8, Math.min(92, Math.round((v1 / sum) * 100)));
    const pct2 = 100 - pct1;
    el1.style.width = `${pct1}%`;
    el2.style.width = `${pct2}%`;
  }
}
