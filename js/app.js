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
      // If multiple slots occupied, open load modal; otherwise load directly
      const slots = getSaveSlots();
      const occupied = slots.filter(s => !s.empty);
      if (occupied.length > 1) {
        UI.openSaveLoadModal('load');
      } else if (gameState) {
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

    // Save/Load modal
    on('btnSaveGame', 'click', () => UI.openSaveLoadModal('save'));
    on('btnLoadGame', 'click', () => UI.openSaveLoadModal('load'));
    on('btnCloseSaveLoad', 'click', () => UI.closeSaveLoadModal());

    // Settings modal
    on('btnSaveSettings', 'click', () => UI.saveSettings());
    on('btnCancelSettings', 'click', () => UI.closeSettings());
    on('btnRefreshModels', 'click', async () => {
      UI.showAiLoading('Loading models...');
      await UI.updateSettingsConnectionStatus();
      await UI.refreshModels();
      UI.hideAiLoading();
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
      // Ctrl+S to quick-save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (gameState) {
          saveGame();
          showToast(`Saved to slot ${gameState.saveSlot || 1}`, 'success');
        }
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

    // Assign first available save slot
    const slots = getSaveSlots();
    const emptySlot = slots.find(s => s.empty);
    gameState.saveSlot = emptySlot ? emptySlot.slot : 1;

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

    // Model guard: warn if AI enabled but no model selected
    if (gameState.aiEnabled && !gameState.ollamaModel) {
      showToast('No AI model selected — open Settings to choose one', 'danger');
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

    // Show AI loading overlay
    UI.showAiLoading('Generating events...');

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
    UI.showAiLoading('Generating headlines...');
    const headlines = await Events.generateTurnHeadlines();
    if (headlines) {
      gameState.newsLog.push(...headlines.map(h => ({ ...h, turn: gameState.turn })));
      saveGame();
      UI.renderNewsFeed(headlines);
    }

    // Hide AI loading overlay
    UI.hideAiLoading();

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
    // Guard: only allow during campaign phase
    if (!gameState || gameState.phase !== 'campaign') {
      showToast('No election has been called!', 'danger');
      return;
    }

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
