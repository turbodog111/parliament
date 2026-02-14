/* ============================================================
   ui.js — Screen management, rendering, charts
   ============================================================ */

const UI = (() => {
  const screens = {};

  function init() {
    screens.title = $('screenTitle');
    screens.setup = $('screenSetup');
    screens.dashboard = $('screenDashboard');
    screens.campaign = $('screenCampaign');
    screens.parliament = $('screenParliament');
    screens.election = $('screenElection');
  }

  function showScreen(name) {
    Object.values(screens).forEach(s => { if (s) s.classList.remove('active'); });
    if (screens[name]) screens[name].classList.add('active');
  }

  // ---- Dashboard Rendering ----

  function renderDashboard() {
    const gs = gameState;
    if (!gs) return;

    // Header
    const party = PARTIES[gs.playerParty];
    const badge = $('headerBadge');
    if (badge) {
      badge.style.background = party.color;
      badge.textContent = party.short.slice(0, 3);
    }
    const hName = $('headerName');
    if (hName) hName.textContent = gs.playerName;
    const hDate = $('headerDate');
    if (hDate) hDate.textContent = formatDate(gs.turn);
    const hPhase = $('headerPhase');
    if (hPhase) hPhase.textContent = gs.isInGovernment ? 'In Government' : 'In Opposition';

    // Stat bar
    setText('statSeats', gs.seats[gs.playerParty] || 0);
    setText('statApproval', gs.approval + '%');
    setText('statUnity', gs.unity + '%');
    setText('statPolling', (gs.polling[gs.playerParty] || 0).toFixed(1) + '%');
    setText('statFunds', gs.partyFunds);
    setText('statTurn', `${gs.turnsInParliament}/${CONFIG.TURNS_PER_PARLIAMENT}`);

    // Seat chart
    renderSeatChart();

    // Polling bars
    renderPollingBars();

    // Approval display
    renderApproval();

    // Action bar buttons
    updateActionBar();
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function renderSeatChart() {
    const bar = $('seatBar');
    if (!bar) return;
    bar.innerHTML = '';

    const gs = gameState;
    const sorted = PARTY_ORDER.filter(p => (gs.seats[p] || 0) > 0);

    // Add independents and others
    if (gs.seats.ind > 0) sorted.push('ind');
    if (gs.seats.speaker > 0) sorted.push('speaker');
    if (gs.seats.other > 0) sorted.push('other');

    sorted.forEach(p => {
      const seats = gs.seats[p] || 0;
      if (seats === 0) return;
      const pct = (seats / CONFIG.TOTAL_SEATS * 100);
      const seg = document.createElement('div');
      seg.className = 'bar-segment';
      seg.style.width = pct + '%';
      seg.style.background = getPartyColor(p);
      if (pct > 4) {
        seg.innerHTML = `<span>${seats}</span>`;
      }
      seg.title = `${getPartyName(p)}: ${seats} seats`;
      bar.appendChild(seg);
    });

    // Legend
    const legend = $('seatLegend');
    if (legend) {
      legend.innerHTML = '';
      sorted.forEach(p => {
        const seats = gs.seats[p] || 0;
        if (seats === 0) return;
        const item = document.createElement('div');
        item.className = 'seat-legend-item';
        item.innerHTML = `<span class="dot" style="background:${getPartyColor(p)}"></span>${getPartyShort(p)} ${seats}`;
        legend.appendChild(item);
      });
    }
  }

  function renderPollingBars() {
    const container = $('pollingBars');
    if (!container) return;
    container.innerHTML = '';

    const gs = gameState;
    const parties = PARTY_ORDER.filter(p => (gs.polling[p] || 0) >= 1);

    parties.sort((a, b) => (gs.polling[b] || 0) - (gs.polling[a] || 0));

    parties.forEach(p => {
      const pct = gs.polling[p] || 0;
      const row = document.createElement('div');
      row.className = 'poll-row';
      row.innerHTML = `
        <span class="poll-label">${getPartyShort(p)}</span>
        <div class="poll-bar-track">
          <div class="poll-bar-fill" style="width:${pct}%;background:${getPartyColor(p)}">${pct >= 5 ? pct.toFixed(1) + '%' : ''}</div>
        </div>
      `;
      container.appendChild(row);
    });
  }

  function renderApproval() {
    const num = $('approvalNumber');
    const trend = $('approvalTrend');
    const meter = $('approvalMeter');
    if (!num || !gameState) return;

    const gs = gameState;
    num.textContent = gs.approval + '%';
    num.style.color = gs.approval >= CONFIG.APPROVAL_HIGH ? 'var(--success)' :
                      gs.approval <= CONFIG.APPROVAL_CRISIS ? 'var(--danger)' :
                      gs.approval <= CONFIG.APPROVAL_LOW ? 'var(--warning)' : 'var(--text-dark)';

    if (trend) {
      const t = gs.approvalTrend;
      trend.textContent = t > 0 ? `+${t}` : t < 0 ? `${t}` : '—';
      trend.className = 'approval-trend ' + (t > 0 ? 'up' : t < 0 ? 'down' : 'flat');
    }

    if (meter) {
      meter.style.width = gs.approval + '%';
      meter.className = 'meter-fill ' + (gs.approval >= CONFIG.APPROVAL_HIGH ? 'good' :
                          gs.approval <= CONFIG.APPROVAL_CRISIS ? 'danger' :
                          gs.approval <= CONFIG.APPROVAL_LOW ? 'warning' : 'info');
    }
  }

  function updateActionBar() {
    const gs = gameState;
    const btnElection = $('btnCallElection');
    if (btnElection) {
      btnElection.disabled = !Engine.canCallElection();
      btnElection.title = Engine.canCallElection() ? 'Call a General Election' :
        gs.isInGovernment ? `Cannot call election yet (${CONFIG.MIN_ELECTION_TURNS - gs.turnsInParliament} months remaining)` :
        'Only the PM can call an election';
    }

    const btnPMQ = $('btnPMQs');
    if (btnPMQ) {
      btnPMQ.disabled = !gs.isInGovernment;
      btnPMQ.title = gs.isInGovernment ? 'Face Prime Minister\'s Questions' : 'Only the PM faces PMQs';
    }
  }

  // ---- News Feed ----

  function renderNewsFeed(headlines) {
    const feed = $('newsFeed');
    if (!feed) return;

    if (!headlines || headlines.length === 0) return;

    headlines.forEach(h => {
      const item = document.createElement('div');
      item.className = 'news-item';
      const sourceClass = (h.source || 'bbc').toLowerCase().replace(/\s/g, '');
      item.innerHTML = `
        <div class="news-source ${sourceClass}">${escapeHtml(h.source || 'BBC')}</div>
        <div class="news-headline">${escapeHtml(h.headline)}</div>
        <div class="news-date">${formatDate(gameState.turn)}</div>
      `;
      feed.insertBefore(item, feed.firstChild);
    });

    // Keep max 30 items
    while (feed.children.length > 30) {
      feed.removeChild(feed.lastChild);
    }
  }

  // ---- Event Card ----

  function renderEventCard(event) {
    const card = $('eventCard');
    if (!card || !event) {
      if (card) card.classList.add('hidden');
      return;
    }

    card.classList.remove('hidden');
    const severity = $('eventSeverity');
    const category = $('eventCategory');
    const title = $('eventTitle');
    const desc = $('eventDesc');
    const choices = $('eventChoices');

    if (severity) {
      severity.textContent = event.severity || 'moderate';
      severity.className = 'event-severity ' + (event.severity || 'moderate');
    }
    if (category) category.textContent = event.category || '';
    if (title) title.textContent = event.title || 'Political Event';
    if (desc) desc.textContent = event.description || '';

    if (choices) {
      choices.innerHTML = '';
      (event.choices || []).forEach((choice, i) => {
        const btn = document.createElement('button');
        btn.className = 'event-choice';
        btn.innerHTML = `
          <div class="choice-label">${escapeHtml(choice.label)}</div>
          <div class="choice-hint">${escapeHtml(choice.hint || '')}</div>
        `;
        btn.onclick = () => handleEventChoice(i);
        choices.appendChild(btn);
      });
    }
  }

  function handleEventChoice(index) {
    const event = gameState.currentEvent;
    if (!event) return;

    const choice = Events.handleEventChoice(event, index);
    if (!choice) return;

    // Show outcome
    const card = $('eventCard');
    if (card) {
      const choices = $('eventChoices');
      if (choices) {
        choices.innerHTML = `
          <div class="event-outcome">
            <h4>You chose: ${escapeHtml(choice.label)}</h4>
            <div class="outcome-effects">
              ${choice.effects.approval ? `<span class="outcome-effect ${choice.effects.approval >= 0 ? 'positive' : 'negative'}">Approval ${choice.effects.approval >= 0 ? '+' : ''}${choice.effects.approval}</span>` : ''}
              ${choice.effects.unity ? `<span class="outcome-effect ${choice.effects.unity >= 0 ? 'positive' : 'negative'}">Unity ${choice.effects.unity >= 0 ? '+' : ''}${choice.effects.unity}</span>` : ''}
            </div>
          </div>
        `;
      }
    }

    // Update dashboard
    renderDashboard();

    // Hide event after delay
    setTimeout(() => {
      if (card) card.classList.add('hidden');
    }, 3000);
  }

  // ---- Campaign Screen ----

  function renderCampaign() {
    const gs = gameState;
    if (!gs) return;

    // Resources
    setText('campFunds', gs.campaignResources?.funds || 0);
    setText('campActivists', gs.campaignResources?.activists || 0);

    // Region grid
    const grid = $('regionGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const regions = Campaign.getRegions();
    const targetable = Campaign.getTargetableRegions();

    targetable.forEach(regionName => {
      const region = regions[regionName];
      if (!region) return;

      const card = document.createElement('div');
      card.className = 'region-card' + (gs.campaignTargets.includes(regionName) ? ' targeted' : '');

      // Top parties in region
      const topParties = Object.entries(region.avgLean)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);

      card.innerHTML = `
        <h4>${escapeHtml(regionName)}</h4>
        <div class="region-seats">${region.seats} seats (${region.country})</div>
        <div class="region-polling">
          ${topParties.map(([p, v]) => `<span class="region-party-chip" style="background:${getPartyColor(p)}">${getPartyShort(p)} ${(v * 100).toFixed(0)}%</span>`).join('')}
        </div>
      `;

      card.onclick = () => {
        if (!gs.campaignTargets.includes(regionName)) {
          Campaign.targetRegion(regionName);
          renderCampaign();
        }
      };

      grid.appendChild(card);
    });

    // Policy sliders
    renderPolicySliders();
  }

  function renderPolicySliders() {
    const container = $('policySliders');
    if (!container) return;
    container.innerHTML = '';

    Object.entries(POLICY_AXES).forEach(([axis, def]) => {
      const val = gameState.policy[axis] || 50;
      const group = document.createElement('div');
      group.className = 'policy-slider-group';
      group.innerHTML = `
        <label>${def.name}</label>
        <div class="policy-slider-row">
          <span class="axis-label">${def.left}</span>
          <input type="range" min="0" max="100" value="${val}" data-axis="${axis}">
          <span class="axis-label">${def.right}</span>
        </div>
      `;
      const slider = group.querySelector('input');
      slider.oninput = () => {
        Campaign.shiftPolicy(axis, parseInt(slider.value));
      };
      container.appendChild(group);
    });
  }

  // ---- Parliament Screen ----

  function renderParliament() {
    const gs = gameState;
    if (!gs) return;

    // Bill list
    const billList = $('billList');
    if (billList) {
      billList.innerHTML = '';
      gs.bills.forEach(bill => {
        const item = document.createElement('div');
        item.className = 'bill-item';
        item.innerHTML = `
          <h4>${escapeHtml(bill.title)}</h4>
          <div class="bill-meta">${escapeHtml(bill.summary?.slice(0, 80) || '')}...</div>
          <span class="bill-stage-badge">${bill.stage}</span>
        `;
        item.onclick = () => selectBill(bill);
        billList.appendChild(item);
      });

      if (gs.bills.length === 0) {
        billList.innerHTML = '<div class="text-muted text-center p-md">No active bills. Propose legislation to get started.</div>';
      }
    }

    // Bill history
    const histList = $('billHistoryList');
    if (histList) {
      histList.innerHTML = '';
      gs.billHistory.slice(-10).reverse().forEach(bill => {
        const item = document.createElement('div');
        item.className = 'bill-item';
        item.innerHTML = `
          <h4>${escapeHtml(bill.title)}</h4>
          <span class="bill-stage-badge" style="background:${bill.status === 'passed' ? 'var(--success)' : 'var(--danger)'};color:white">${bill.status === 'passed' ? 'Royal Assent' : 'Defeated'}</span>
        `;
        histList.appendChild(item);
      });
    }
  }

  // Stage descriptions and action button labels
  const STAGE_INFO = {
    'Introduced': {
      text: 'This bill has been introduced to the House of Commons. Put it to the House to debate and hold a division (vote).',
      action: 'Put to the House',
    },
    'Royal Assent': {
      text: 'This bill has passed the Commons and received Royal Assent. It is now an Act of Parliament.',
      action: null,
    },
  };

  let selectedBill = null;

  function selectBill(bill) {
    selectedBill = bill;

    // Show bill detail view tab
    showParliamentTab('bills');

    // Render stage pipeline
    const stagesEl = $('billStages');
    if (stagesEl) {
      stagesEl.innerHTML = '';
      CONFIG.BILL_STAGES.forEach(stage => {
        const el = document.createElement('span');
        const idx = CONFIG.BILL_STAGES.indexOf(stage);
        const currentIdx = CONFIG.BILL_STAGES.indexOf(bill.stage);
        el.className = 'bill-stage' +
          (stage === bill.stage ? ' current' : '') +
          (idx < currentIdx ? ' passed' : '');
        el.textContent = stage;
        stagesEl.appendChild(el);
      });
    }

    const detailTitle = $('billDetailTitle');
    if (detailTitle) detailTitle.textContent = bill.title;
    const detailSummary = $('billDetailSummary');
    if (detailSummary) detailSummary.textContent = bill.summary;

    // Stage info
    const stageInfo = STAGE_INFO[bill.stage];
    const infoEl = $('billStageInfo');
    if (infoEl) {
      infoEl.textContent = stageInfo ? stageInfo.text : '';
    }

    // Clear previous vote result
    const voteResult = $('billVoteResult');
    if (voteResult) voteResult.innerHTML = '';

    // Action button
    const actionBtn = $('btnBillAction');
    if (actionBtn) {
      if (stageInfo && stageInfo.action) {
        actionBtn.textContent = stageInfo.action;
        actionBtn.classList.remove('hidden');
        actionBtn.disabled = false;
        actionBtn.onclick = () => handleBillAction(bill);
      } else {
        actionBtn.classList.add('hidden');
      }
    }

    // Highlight selected bill in sidebar
    $$('.bill-item').forEach(el => el.classList.remove('active'));
    event?.target?.closest('.bill-item')?.classList.add('active');
  }

  async function handleBillAction(bill) {
    const actionBtn = $('btnBillAction');
    if (actionBtn) {
      actionBtn.disabled = true;
      actionBtn.textContent = 'Debating...';
    }

    // Clear previous vote result
    const voteResult = $('billVoteResult');
    if (voteResult) voteResult.innerHTML = '';

    // Switch to debate tab so player sees the transcript stream in
    showParliamentTab('debate');

    const result = await Parliament.advanceBill(bill);

    // Switch back to bill detail to show vote result
    showParliamentTab('bills');

    if (result.vote) {
      // Append Speaker announcement to debate transcript
      const debateContainer = $('debateTranscript');
      if (debateContainer) {
        const announcement = document.createElement('div');
        announcement.className = 'division-result-announcement';
        const v = result.vote;
        announcement.innerHTML = renderMarkdown(
          `\n\n**Mr Speaker:** The Ayes to the right: ${v.ayes}. The Noes to the left: ${v.noes}.\n\n**Mr Speaker:** ${v.passed ? 'The Ayes have it! The Ayes have it!' : 'The Noes have it! The Noes have it!'}`
        );
        debateContainer.appendChild(announcement);
      }

      renderVoteBreakdown(result.vote);

      if (result.passed) {
        showToast(`${bill.title} has passed and received Royal Assent!`, 'success');
      } else {
        showToast(`${bill.title} has been defeated.`, 'danger');
      }
    }

    // Re-render parliament sidebar
    renderParliament();

    // Bill is now in history — update detail view
    const detailTitle = $('billDetailTitle');
    if (detailTitle) detailTitle.textContent = bill.title;
    const infoEl = $('billStageInfo');
    if (infoEl) infoEl.textContent = bill.status === 'passed'
      ? 'This bill has passed the House of Commons and received Royal Assent. It is now an Act of Parliament.'
      : 'This bill was defeated in a division of the House of Commons.';
    if (actionBtn) actionBtn.classList.add('hidden');

    renderDashboard();
  }

  function renderVoteBreakdown(vote) {
    const panel = $('billVoteResult');
    if (!panel) return;

    // Header
    const passed = vote.passed;
    let html = `
      <div class="vote-breakdown">
        <div class="vote-breakdown-header" style="color:${passed ? 'var(--success)' : 'var(--danger)'}">
          ${passed ? 'The Ayes have it!' : 'The Noes have it!'}
        </div>
        <div class="whip-summary">
          <div class="whip-count for"><div class="count-value">${vote.ayes}</div><div class="count-label">Ayes</div></div>
          <div class="whip-count against"><div class="count-value">${vote.noes}</div><div class="count-label">Noes</div></div>
          <div class="whip-count abstain"><div class="count-value">${vote.abstentions}</div><div class="count-label">Abstain</div></div>
        </div>
        <div class="text-center text-muted text-sm mb-md">Majority: ${Math.abs(vote.majority)}</div>
    `;

    // Party-by-party breakdown table
    if (vote.partyBreakdown) {
      html += `<table class="vote-breakdown-table">
        <thead><tr><th>Party</th><th>Seats</th><th>Ayes</th><th>Noes</th></tr></thead><tbody>`;

      const entries = Object.entries(vote.partyBreakdown)
        .filter(([, data]) => data.seats > 0)
        .sort((a, b) => b[1].seats - a[1].seats);

      entries.forEach(([partyId, data]) => {
        const color = getPartyColor(partyId);
        const name = getPartyName(partyId);
        if (data.abstain) {
          html += `<tr class="vote-party-row">
            <td><span class="dot" style="background:${color}"></span>${name}</td>
            <td>${data.seats}</td>
            <td colspan="2" style="text-align:center;color:var(--text-muted)">Abstain</td>
          </tr>`;
        } else {
          html += `<tr class="vote-party-row">
            <td><span class="dot" style="background:${color}"></span>${name}</td>
            <td>${data.seats}</td>
            <td style="color:var(--success);font-weight:700">${data.ayes}</td>
            <td style="color:var(--danger);font-weight:700">${data.noes}</td>
          </tr>`;
        }
      });

      html += `<tr class="vote-party-row" style="font-weight:700;border-top:2px solid var(--parchment-dark)">
        <td>Total</td>
        <td></td>
        <td style="color:var(--success)">${vote.ayes}</td>
        <td style="color:var(--danger)">${vote.noes}</td>
      </tr>`;

      html += `</tbody></table>`;
    }

    html += `</div>`;
    panel.innerHTML = html;
  }

  // ---- Election Night ----

  function renderElectionNight(results) {
    const gs = gameState;
    const container = $('electionResults');
    if (!container) return;

    // Clear
    container.innerHTML = '';

    // Summary
    const gov = results.government;
    const summary = document.createElement('div');
    summary.className = 'card mb-md';
    summary.innerHTML = `
      <div class="card-header">Election Result</div>
      <div style="text-align:center;padding:20px">
        <h2 style="color:${getPartyColor(gov.pmParty)}">${getPartyName(gov.pmParty)} ${gov.hasMajority ? 'Majority' : 'Largest Party'}</h2>
        <div style="font-size:2rem;font-weight:700;color:${getPartyColor(gov.pmParty)}">${results.election.seats[gov.pmParty]} seats</div>
        ${gov.hasMajority ? `<div class="text-muted">Majority of ${results.election.seats[gov.pmParty] - gov.effectiveMajority + 1}</div>` : '<div style="color:var(--warning);font-weight:700">HUNG PARLIAMENT</div>'}
      </div>
    `;
    container.appendChild(summary);

    // Seat chart
    const chartCard = document.createElement('div');
    chartCard.className = 'card mb-md';
    chartCard.innerHTML = `
      <div class="card-header">Seats Won</div>
      <div class="stacked-bar" id="electionSeatBar" style="height:40px;margin:12px 0"></div>
      <div class="seat-legend" id="electionLegend" style="flex-wrap:wrap"></div>
    `;
    container.appendChild(chartCard);

    // Render election seat bar
    setTimeout(() => {
      const bar = $('electionSeatBar');
      const legend = $('electionLegend');
      if (!bar) return;

      PARTY_ORDER.forEach(p => {
        const seats = results.election.seats[p] || 0;
        if (seats === 0) return;
        const pct = seats / CONFIG.TOTAL_SEATS * 100;
        const seg = document.createElement('div');
        seg.className = 'bar-segment';
        seg.style.width = pct + '%';
        seg.style.background = getPartyColor(p);
        if (pct > 4) seg.innerHTML = `<span>${seats}</span>`;
        bar.appendChild(seg);

        if (legend) {
          const item = document.createElement('div');
          item.className = 'seat-legend-item';
          item.innerHTML = `<span class="dot" style="background:${getPartyColor(p)}"></span>${getPartyShort(p)} ${seats}`;
          legend.appendChild(item);
        }
      });
    }, 100);

    // Constituency results (top 20 most interesting)
    const constCard = document.createElement('div');
    constCard.className = 'card';
    constCard.innerHTML = `<div class="card-header">Key Results</div><div id="constResults"></div>`;
    container.appendChild(constCard);

    setTimeout(() => {
      const constResults = $('constResults');
      if (!constResults) return;

      // Show tightest margins
      const interesting = results.election.constituencies
        .sort((a, b) => a.margin - b.margin)
        .slice(0, 20);

      interesting.forEach(c => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--parchment-dark);font-size:0.85rem';
        row.innerHTML = `
          <span>${escapeHtml(c.name)}</span>
          <span style="font-weight:700;color:${getPartyColor(c.winner)}">${getPartyShort(c.winner)} <span class="text-muted">(margin ${(c.margin * 100).toFixed(1)}%)</span></span>
        `;
        constResults.appendChild(row);
      });
    }, 200);
  }

  async function animateElectionNight(results) {
    showScreen('election');
    const container = $('electionResults');
    if (!container) return;

    container.innerHTML = '<div class="text-center p-md"><h2>Votes are being counted...</h2><div class="ai-loading"><div class="spinner"></div>Results coming in...</div></div>';

    // Animate results trickling in
    const constituencies = [...results.election.constituencies].sort(() => Math.random() - 0.5);
    const tickerEl = $('electionTicker');
    const runningTotals = {};
    PARTY_ORDER.forEach(p => runningTotals[p] = 0);
    runningTotals.ind = 0;
    runningTotals.other = 0;
    runningTotals.speaker = 0;

    let declared = 0;
    const totalToShow = Math.min(constituencies.length, 50); // Show first 50 then skip ahead

    for (let i = 0; i < totalToShow; i++) {
      const c = constituencies[i];
      runningTotals[c.winner] = (runningTotals[c.winner] || 0) + 1;
      declared++;

      if (tickerEl) {
        const item = document.createElement('div');
        item.style.cssText = 'padding:4px 8px;font-size:0.8rem;border-bottom:1px solid var(--parchment-dark)';
        item.innerHTML = `<strong style="color:${getPartyColor(c.winner)}">${getPartyShort(c.winner)} gain</strong> ${escapeHtml(c.name)}`;
        tickerEl.insertBefore(item, tickerEl.firstChild);
        if (tickerEl.children.length > 15) tickerEl.removeChild(tickerEl.lastChild);
      }

      // Update running total display
      const totalEl = $('electionRunningTotal');
      if (totalEl) {
        totalEl.innerHTML = `<div class="text-sm text-muted">${declared}/${CONFIG.TOTAL_SEATS} declared</div>` +
          PARTY_ORDER.filter(p => runningTotals[p] > 0)
            .map(p => `<span style="color:${getPartyColor(p)};font-weight:700;margin-right:12px">${getPartyShort(p)}: ${runningTotals[p]}</span>`)
            .join('');
      }

      await sleep(150);
    }

    // Skip ahead to final
    await sleep(500);
    renderElectionNight(results);
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ---- Setup Screen ----

  function renderSetup() {
    const grid = $('partyGrid');
    if (!grid) return;
    grid.innerHTML = '';

    PLAYABLE_PARTIES.forEach(pid => {
      const p = PARTIES[pid];
      const card = document.createElement('div');
      card.className = 'card';
      card.style.cssText = `cursor:pointer;border:2px solid transparent;transition:all 0.2s`;
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="width:32px;height:32px;border-radius:50%;background:${p.color};display:flex;align-items:center;justify-content:center;color:${p.textColor};font-weight:700;font-size:0.75rem">${p.short.slice(0, 3)}</div>
          <div>
            <strong>${p.name}</strong>
            <div class="text-sm text-muted">Leader: ${p.leader}</div>
          </div>
        </div>
        <div class="text-sm">${p.description}</div>
        <div class="text-xs text-muted mt-sm">Base: ${p.baseRegions.join(', ')}</div>
      `;

      card.onclick = () => {
        $$('#partyGrid .card').forEach(c => c.style.borderColor = 'transparent');
        card.style.borderColor = p.color;
        $('setupPartyInput').value = pid;
        $('setupPartyName').textContent = p.name;
      };

      grid.appendChild(card);
    });
  }

  // ---- Settings Modal ----

  async function openSettings() {
    const gs = gameState;
    $('settingsEndpoint').value = gs?.ollamaEndpoint || CONFIG.OLLAMA_ENDPOINT;
    $('settingsAiEnabled').checked = gs?.aiEnabled !== false;

    $('settingsModal').classList.add('open');

    // Auto-fetch models and test connection on open
    await updateSettingsConnectionStatus();
    await refreshModels();
  }

  function closeSettings() {
    $('settingsModal').classList.remove('open');
  }

  function saveSettings() {
    const gs = gameState;
    if (!gs) return;

    gs.ollamaEndpoint = $('settingsEndpoint').value.trim().replace(/\/+$/, '') || CONFIG.OLLAMA_ENDPOINT;
    const newModel = $('settingsModel').value;
    const modelChanged = newModel !== gs.ollamaModel;
    gs.ollamaModel = newModel;
    gs.aiEnabled = $('settingsAiEnabled').checked;

    saveGame();
    closeSettings();
    updateAiBadge();

    if (modelChanged && newModel) {
      const modelName = newModel.length > 24 ? newModel.slice(0, 22) + '...' : newModel;
      showToast(`Switched to ${modelName}`, 'success');
    } else {
      showToast('Settings saved!', 'success');
    }
  }

  async function refreshModels(selectEl, endpointEl) {
    const select = selectEl || $('settingsModel');
    const endpointInput = endpointEl || $('settingsEndpoint');
    if (!select) return;
    select.innerHTML = '<option value="">Loading...</option>';

    const endpoint = (endpointInput?.value || '').trim().replace(/\/+$/, '') || CONFIG.OLLAMA_ENDPOINT;

    // Temporarily override for fetch
    const origEndpoint = gameState?.ollamaEndpoint;
    if (gameState) gameState.ollamaEndpoint = endpoint;

    const models = await AI.fetchModels();

    if (gameState) gameState.ollamaEndpoint = origEndpoint;

    select.innerHTML = '';
    if (models.length === 0) {
      select.innerHTML = '<option value="">No models found — is Ollama running?</option>';
      return models;
    }

    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label;
      select.appendChild(opt);
    });

    // Restore selection
    const current = gameState?.ollamaModel;
    if (current && models.some(m => m.id === current)) {
      select.value = current;
    }

    return models;
  }

  async function testConnection(endpointValue) {
    const endpoint = (endpointValue || '').trim().replace(/\/+$/, '') || CONFIG.OLLAMA_ENDPOINT;
    try {
      const res = await fetch(`${endpoint}/v1/models`, { signal: AbortSignal.timeout(5000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function updateSettingsConnectionStatus() {
    const dot = $('settingsAiDot');
    const text = $('settingsAiStatusText');
    if (!dot || !text) return;

    text.textContent = 'Checking...';
    dot.className = 'ai-status-dot';

    const endpoint = $('settingsEndpoint')?.value;
    const connected = await testConnection(endpoint);

    if (connected) {
      dot.className = 'ai-status-dot connected';
      text.textContent = 'Connected to Ollama';
      text.style.color = 'var(--success)';
    } else {
      dot.className = 'ai-status-dot disconnected';
      text.textContent = 'Not connected — is Ollama running?';
      text.style.color = 'var(--danger)';
    }
  }

  // ---- AI Status Badge (Header) ----

  async function updateAiBadge() {
    const dot = $('aiBadgeDot');
    const label = $('aiBadgeLabel');
    if (!dot || !label) return;

    const gs = gameState;
    if (!gs || gs.aiEnabled === false) {
      dot.className = 'ai-status-dot no-ai';
      label.textContent = 'No AI';
      return;
    }

    const connected = await testConnection(gs.ollamaEndpoint);
    if (connected && gs.ollamaModel) {
      dot.className = 'ai-status-dot connected';
      // Show shortened model name
      const modelName = gs.ollamaModel.length > 16 ? gs.ollamaModel.slice(0, 14) + '...' : gs.ollamaModel;
      label.textContent = modelName;
    } else if (connected) {
      dot.className = 'ai-status-dot no-ai';
      label.textContent = 'No model';
    } else {
      dot.className = 'ai-status-dot no-ai';
      label.textContent = 'No AI';
    }
  }

  // ---- Setup Screen AI Config ----

  async function initSetupAiConfig() {
    const dot = $('setupAiDot');
    const text = $('setupAiStatusText');
    const select = $('setupModel');
    const endpointInput = $('setupEndpoint');
    if (!dot || !text) return;

    text.textContent = 'Checking connection...';
    dot.className = 'ai-status-dot';

    const endpoint = endpointInput?.value;
    const connected = await testConnection(endpoint);

    if (connected) {
      dot.className = 'ai-status-dot connected';
      text.textContent = 'Connected to Ollama';
      text.style.color = 'var(--success)';
      // Auto-load models
      await refreshModels(select, endpointInput);
    } else {
      dot.className = 'ai-status-dot disconnected';
      text.textContent = 'Ollama not found — AI features will be disabled';
      text.style.color = 'var(--text-muted)';
    }
  }

  async function refreshSetupModels() {
    const select = $('setupModel');
    const endpointInput = $('setupEndpoint');
    const dot = $('setupAiDot');
    const text = $('setupAiStatusText');

    const models = await refreshModels(select, endpointInput);

    if (models && models.length > 0) {
      if (dot) dot.className = 'ai-status-dot connected';
      if (text) { text.textContent = 'Connected to Ollama'; text.style.color = 'var(--success)'; }
    } else {
      if (dot) dot.className = 'ai-status-dot disconnected';
      if (text) { text.textContent = 'Ollama not found — AI features will be disabled'; text.style.color = 'var(--text-muted)'; }
    }
  }

  // ---- Welcome Guide ----

  function showWelcomeGuide() {
    const guide = $('welcomeGuide');
    if (guide) guide.classList.remove('hidden');
  }

  function dismissWelcomeGuide() {
    const guide = $('welcomeGuide');
    if (guide) guide.classList.add('hidden');
  }

  // ---- Bill Proposal Modal ----

  function openBillModal() {
    $('billModal').classList.add('open');
    $('billTopicInput').value = '';
    $('billTopicInput').focus();
  }

  function closeBillModal() {
    $('billModal').classList.remove('open');
  }

  async function submitBill() {
    const topic = $('billTopicInput').value.trim();
    if (!topic) {
      showToast('Enter a topic for your bill.', 'danger');
      return;
    }

    $('btnSubmitBill').disabled = true;
    $('btnSubmitBill').textContent = 'Drafting...';
    closeBillModal();
    showAiLoading('Drafting legislation...');

    const bill = await Parliament.proposeBill(topic);

    hideAiLoading();
    $('btnSubmitBill').disabled = false;
    $('btnSubmitBill').textContent = 'Draft Bill';

    if (bill) {
      showToast(`${bill.title} introduced!`, 'success');
      renderParliament();
      renderDashboard();
    }
  }

  // ---- PMQ Modal ----

  function openPMQModal() {
    $('pmqModal').classList.add('open');
    const stratContainer = $('pmqStrategies');
    if (stratContainer) {
      stratContainer.innerHTML = '';
      PMQ_STRATEGIES.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'strategy-btn';
        btn.innerHTML = `<strong>${s.name}</strong><br><span class="text-sm text-muted">${s.desc}</span>`;
        btn.onclick = () => {
          $$('.strategy-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          $('pmqStrategyInput').value = s.id;
        };
        stratContainer.appendChild(btn);
      });
    }
  }

  function closePMQModal() {
    $('pmqModal').classList.remove('open');
  }

  async function startPMQ() {
    const strategy = $('pmqStrategyInput').value;
    if (!strategy) {
      showToast('Choose a strategy first!', 'danger');
      return;
    }

    closePMQModal();
    showScreen('parliament');

    // Show PMQ tab
    showParliamentTab('pmq');

    await Parliament.startPMQs(strategy);
    renderDashboard();
  }

  function showParliamentTab(tab) {
    $$('.chamber-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`.chamber-tab[data-tab="${tab}"]`);
    if (activeTab) activeTab.classList.add('active');

    // Show corresponding view
    ['debateView', 'pmqView', 'billDetailView'].forEach(id => {
      const el = $(id);
      if (el) el.classList.add('hidden');
    });
    const views = { debate: 'debateView', pmq: 'pmqView', bills: 'billDetailView' };
    const viewEl = $(views[tab]);
    if (viewEl) viewEl.classList.remove('hidden');
  }

  // ---- Save/Load Modal ----

  let saveLoadMode = 'save'; // 'save' or 'load'

  function openSaveLoadModal(mode) {
    saveLoadMode = mode;
    const title = $(saveLoadMode === 'save' ? 'saveLoadTitle' : 'saveLoadTitle');
    if (title) title.textContent = mode === 'save' ? 'Save Game' : 'Load Game';
    renderSaveSlots();
    $('saveLoadModal').classList.add('open');
  }

  function closeSaveLoadModal() {
    $('saveLoadModal').classList.remove('open');
  }

  function renderSaveSlots() {
    const container = $('saveSlots');
    if (!container) return;
    container.innerHTML = '';

    const slots = getSaveSlots();
    slots.forEach(slot => {
      const card = document.createElement('div');
      card.className = 'save-slot-card' + (slot.empty ? ' empty' : '') +
        (gameState && gameState.saveSlot === slot.slot ? ' active-slot' : '');

      if (slot.empty) {
        card.innerHTML = `
          <div class="save-slot-badge empty-badge">+</div>
          <div class="save-slot-info">
            <div class="slot-name">Empty Slot ${slot.slot}</div>
            <div class="slot-meta">${saveLoadMode === 'save' ? 'Click to save here' : 'No save data'}</div>
          </div>
        `;
        if (saveLoadMode === 'save') {
          card.onclick = () => {
            saveGameToSlot(slot.slot);
            closeSaveLoadModal();
            showToast(`Game saved to slot ${slot.slot}!`, 'success');
          };
        }
      } else {
        const party = PARTIES[slot.party];
        const partyColor = party ? party.color : '#999';
        const partyShort = party ? party.short.slice(0, 3) : '?';

        card.innerHTML = `
          <div class="save-slot-badge" style="background:${partyColor}">${escapeHtml(partyShort)}</div>
          <div class="save-slot-info">
            <div class="slot-name">${escapeHtml(slot.name)}</div>
            <div class="slot-meta">${escapeHtml(slot.date)} &mdash; Turn ${slot.turn}</div>
          </div>
          <div class="save-slot-actions">
            <button class="btn-delete-slot" title="Delete this save" data-slot="${slot.slot}">&times;</button>
          </div>
        `;

        // Click the card to save/load
        card.onclick = (e) => {
          if (e.target.closest('.btn-delete-slot')) return;
          if (saveLoadMode === 'save') {
            if (confirm(`Overwrite slot ${slot.slot} (${slot.name})?`)) {
              saveGameToSlot(slot.slot);
              closeSaveLoadModal();
              showToast(`Game saved to slot ${slot.slot}!`, 'success');
            }
          } else {
            loadGameFromSlot(slot.slot);
            closeSaveLoadModal();
            // Re-enter game with loaded state
            if (gameState) {
              showScreen('dashboard');
              renderDashboard();
              updateAiBadge();
              if (gameState.currentEvent) renderEventCard(gameState.currentEvent);
              // Re-render news feed from log
              const feed = $('newsFeed');
              if (feed) feed.innerHTML = '';
              const recent = (gameState.newsLog || []).slice(-10).reverse();
              if (recent.length > 0) renderNewsFeed(recent);
              showToast(`Loaded: ${gameState.playerName}`, 'success');
            }
          }
        };

        // Delete button
        const delBtn = card.querySelector('.btn-delete-slot');
        if (delBtn) {
          delBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Delete slot ${slot.slot} (${slot.name})? This cannot be undone.`)) {
              deleteSlot(slot.slot);
              renderSaveSlots();
              showToast(`Slot ${slot.slot} deleted.`);
            }
          };
        }
      }

      container.appendChild(card);
    });
  }

  // ---- AI Loading Overlay ----

  function showAiLoading(message) {
    const overlay = $('aiLoadingOverlay');
    const msg = $('aiLoadingMessage');
    if (overlay) overlay.classList.remove('hidden');
    if (msg) msg.textContent = message || 'Generating...';
  }

  function hideAiLoading() {
    const overlay = $('aiLoadingOverlay');
    if (overlay) overlay.classList.add('hidden');
  }

  // ---- Helpers ----

  function getPartyColor(id) {
    if (PARTIES[id]) return PARTIES[id].color;
    const map = { ind: '#AAAAAA', speaker: '#888888', other: '#999999' };
    return map[id] || '#999';
  }

  function getPartyName(id) {
    if (PARTIES[id]) return PARTIES[id].name;
    const map = { ind: 'Independent', speaker: 'Speaker', other: 'Other' };
    return map[id] || id;
  }

  function getPartyShort(id) {
    if (PARTIES[id]) return PARTIES[id].short;
    const map = { ind: 'Ind', speaker: 'Spkr', other: 'Oth' };
    return map[id] || id;
  }

  return {
    init,
    showScreen,
    renderDashboard,
    renderNewsFeed,
    renderEventCard,
    renderCampaign,
    renderParliament,
    renderVoteBreakdown,
    renderElectionNight,
    animateElectionNight,
    renderSetup,
    openSettings,
    closeSettings,
    saveSettings,
    refreshModels,
    testConnection,
    updateSettingsConnectionStatus,
    updateAiBadge,
    initSetupAiConfig,
    refreshSetupModels,
    showWelcomeGuide,
    dismissWelcomeGuide,
    openBillModal,
    closeBillModal,
    submitBill,
    openPMQModal,
    closePMQModal,
    startPMQ,
    showParliamentTab,
    openSaveLoadModal,
    closeSaveLoadModal,
    showAiLoading,
    hideAiLoading,
    getPartyColor,
    getPartyName,
    getPartyShort,
  };
})();
