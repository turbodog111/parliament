/* ============================================================
   app.js — Initialization, event listener wiring
   ============================================================ */

(function () {
  'use strict';

  // ---- Init ----

  document.addEventListener('DOMContentLoaded', () => {
    UI.init();

    // Check for saved game
    if (hasSave()) {
      loadGame();
      showTitleScreen(true);
    } else {
      showTitleScreen(false);
    }

    wireEvents();
  });

  function showTitleScreen(hasSavedGame) {
    UI.showScreen('title');
    const continueBtn = $('btnContinue');
    if (continueBtn) {
      continueBtn.classList.toggle('hidden', !hasSavedGame);
    }
  }

  // ---- Wire All Events ----

  function wireEvents() {
    // Title screen
    on('btnNewGame', 'click', () => {
      UI.renderSetup();
      UI.showScreen('setup');
      UI.initSetupAiConfig();
    });
    on('btnContinue', 'click', () => {
      if (gameState) {
        enterGame();
      }
    });

    // How to Play modal
    on('btnHowToPlay', 'click', () => {
      $('howToPlayModal').classList.add('open');
    });
    on('btnCloseHowToPlay', 'click', () => {
      $('howToPlayModal').classList.remove('open');
    });

    // Setup screen
    on('btnStartGame', 'click', startNewGame);
    on('btnBackToTitle', 'click', () => UI.showScreen('title'));

    // Dashboard actions
    on('btnAdvanceMonth', 'click', advanceMonth);
    on('btnCallElection', 'click', callElection);
    on('btnProposeBill', 'click', () => UI.openBillModal());
    on('btnParliament', 'click', () => {
      UI.showScreen('parliament');
      UI.renderParliament();
    });
    on('btnCampaignView', 'click', () => {
      UI.showScreen('campaign');
      UI.renderCampaign();
    });
    on('btnPMQs', 'click', () => UI.openPMQModal());
    on('btnSettings', 'click', () => UI.openSettings());

    // Setup AI config
    on('btnSetupRefreshModels', 'click', () => UI.refreshSetupModels());

    // Welcome guide
    on('btnDismissWelcome', 'click', () => UI.dismissWelcomeGuide());

    // AI badge in header — opens settings
    on('aiBadge', 'click', () => UI.openSettings());

    // Settings modal
    on('btnSaveSettings', 'click', () => UI.saveSettings());
    on('btnCancelSettings', 'click', () => UI.closeSettings());
    on('btnRefreshModels', 'click', async () => {
      await UI.updateSettingsConnectionStatus();
      await UI.refreshModels();
    });
    on('btnTestConnection', 'click', () => UI.updateSettingsConnectionStatus());

    // Bill modal
    on('btnSubmitBill', 'click', () => UI.submitBill());
    on('btnCancelBill', 'click', () => UI.closeBillModal());

    // PMQ modal
    on('btnStartPMQ', 'click', () => UI.startPMQ());
    on('btnCancelPMQ', 'click', () => UI.closePMQModal());

    // Parliament screen
    on('btnBackDashboard', 'click', () => {
      UI.showScreen('dashboard');
      UI.renderDashboard();
    });
    on('btnBackDashboardCamp', 'click', () => {
      UI.showScreen('dashboard');
      UI.renderDashboard();
    });
    on('btnBackDashboardElection', 'click', () => {
      UI.showScreen('dashboard');
      UI.renderDashboard();
    });

    // Parliament tabs
    $$('.chamber-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        UI.showParliamentTab(tab.dataset.tab);
      });
    });

    // Campaign actions
    on('btnCampRally', 'click', () => {
      const selected = getSelectedRegion();
      if (selected) {
        Campaign.holdRally(selected);
        UI.renderCampaign();
      } else {
        showToast('Select a region first!', 'danger');
      }
    });
    on('btnCampDoorknock', 'click', () => {
      const selected = getSelectedRegion();
      if (selected) {
        Campaign.doorknock(selected);
        UI.renderCampaign();
      } else {
        showToast('Select a region first!', 'danger');
      }
    });
    on('btnCampAd', 'click', () => {
      const selected = getSelectedRegion();
      if (selected) {
        Campaign.runAd(selected);
        UI.renderCampaign();
      } else {
        showToast('Select a region first!', 'danger');
      }
    });
    on('btnRunElection', 'click', runElectionFromCampaign);

    // Election screen
    on('btnElectionContinue', 'click', () => {
      UI.showScreen('dashboard');
      UI.renderDashboard();
    });

    // Close modals on overlay click
    $$('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('open');
        }
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        $$('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      }
    });
  }

  function on(id, event, handler) {
    const el = $(id);
    if (el) el.addEventListener(event, handler);
  }

  function getSelectedRegion() {
    const targeted = document.querySelector('.region-card.targeted');
    if (targeted) {
      return targeted.querySelector('h4')?.textContent;
    }
    // Use last targeted region
    if (gameState.campaignTargets.length > 0) {
      return gameState.campaignTargets[gameState.campaignTargets.length - 1];
    }
    return null;
  }

  // ---- Game Flow ----

  function startNewGame() {
    const partyId = $('setupPartyInput')?.value;
    const playerName = $('playerNameInput')?.value?.trim();

    if (!partyId) {
      showToast('Please select a party!', 'danger');
      return;
    }
    if (!playerName) {
      showToast('Please enter your name!', 'danger');
      return;
    }

    gameState = createGameState(partyId, playerName);

    // If player picked the incumbent party (Labour 2024), they're PM
    if (partyId === 'lab') {
      gameState.isInGovernment = true;
      gameState.pmParty = 'lab';
    } else {
      // Player is in opposition
      gameState.isInGovernment = false;
      gameState.pmParty = 'lab';
      gameState.oppositionLeader = partyId;
    }

    // Apply AI config from setup screen
    const setupEndpoint = $('setupEndpoint')?.value?.trim().replace(/\/+$/, '');
    const setupModel = $('setupModel')?.value;
    if (setupEndpoint) gameState.ollamaEndpoint = setupEndpoint;
    if (setupModel) gameState.ollamaModel = setupModel;
    // If no model or endpoint, AI will be auto-disabled gracefully
    gameState.aiEnabled = !!(setupModel);

    saveGame();
    enterGame();
  }

  function enterGame() {
    UI.showScreen('dashboard');
    UI.renderDashboard();
    UI.updateAiBadge();

    // Check if there's a pending event
    if (gameState.currentEvent) {
      UI.renderEventCard(gameState.currentEvent);
    }

    // Show welcome guide on first turn
    if (gameState.turn === 0 && !gameState._welcomeShown) {
      gameState._welcomeShown = true;
      saveGame();
      UI.showWelcomeGuide();
    } else {
      showToast(`Welcome back, ${gameState.playerName}!`, 'success');
    }
  }

  async function advanceMonth() {
    const btn = $('btnAdvanceMonth');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Processing...';
    }

    // Check if election is due
    if (Engine.isElectionDue()) {
      showToast('Parliament has been dissolved. Election called!', 'danger');
      gameState.phase = 'campaign';
      saveGame();
      UI.showScreen('campaign');
      UI.renderCampaign();
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Advance Month';
      }
      return;
    }

    // Advance turn
    const result = Engine.advanceTurn();

    // Generate event
    const event = await Events.generateTurnEvent();
    if (event) {
      gameState.currentEvent = event;
      saveGame();
      UI.renderEventCard(event);
    }

    // Generate headlines
    const headlines = await Events.generateTurnHeadlines();
    if (headlines) {
      gameState.newsLog.push(...headlines.map(h => ({ ...h, turn: gameState.turn })));
      saveGame();
      UI.renderNewsFeed(headlines);
    }

    // Update display
    UI.renderDashboard();

    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Advance Month';
    }

    showToast(`Advanced to ${result.date}`);
  }

  function callElection() {
    if (!Engine.canCallElection()) {
      showToast('Cannot call election yet!', 'danger');
      return;
    }
    Engine.callElection();
    UI.showScreen('campaign');
    UI.renderCampaign();
    showToast('Election called! Campaign season begins.', 'success');
  }

  async function runElectionFromCampaign() {
    const btn = $('btnRunElection');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Election Day...';
    }

    const results = Engine.runElection();
    await UI.animateElectionNight(results);

    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Hold Election';
    }
  }

})();
