/* ============================================================
   campaign.js — Campaign phase: resources, targeting, events
   ============================================================ */

const Campaign = (() => {

  // ---- Region Data ----

  function getRegions() {
    const regions = {};
    CONSTITUENCIES.forEach(con => {
      if (!regions[con.region]) {
        regions[con.region] = {
          name: con.region,
          country: con.country,
          seats: 0,
          constituencies: [],
          avgLean: {},
          targeted: false,
        };
      }
      regions[con.region].seats++;
      regions[con.region].constituencies.push(con);

      // Accumulate lean for averaging
      Object.entries(con.lean).forEach(([party, val]) => {
        regions[con.region].avgLean[party] = (regions[con.region].avgLean[party] || 0) + val;
      });
    });

    // Average the leans
    Object.values(regions).forEach(r => {
      Object.keys(r.avgLean).forEach(p => {
        r.avgLean[p] = Math.round((r.avgLean[p] / r.seats) * 1000) / 1000;
      });
    });

    return regions;
  }

  // ---- Constituency Targeting ----

  function getMarginalSeats(region, count = 20) {
    const cons = CONSTITUENCIES.filter(c => c.region === region);
    return cons
      .sort((a, b) => b.marginality - a.marginality)
      .slice(0, count);
  }

  function getTargetableRegions() {
    return CONFIG.REGIONS.filter(r => {
      // Can't target NI if not an NI party
      const party = PARTIES[gameState.playerParty];
      if (r === 'Northern Ireland' && party?.country !== 'Northern Ireland') return false;
      if (r === 'Scotland' && party?.country === 'Northern Ireland') return false;
      // Country-locked parties can only target their country
      if (party?.country === 'Scotland' && !['Scotland'].includes(r)) return false;
      if (party?.country === 'Wales' && !['Wales'].includes(r)) return false;
      if (party?.country === 'Northern Ireland' && r !== 'Northern Ireland') return false;
      return true;
    });
  }

  // ---- Campaign Actions ----

  function targetRegion(region) {
    const gs = gameState;
    const cost = { funds: 50, activists: 25 };

    if (gs.partyFunds < cost.funds) {
      showToast('Not enough funds!', 'danger');
      return false;
    }
    if (gs.activists < cost.activists) {
      showToast('Not enough activists!', 'danger');
      return false;
    }

    if (gs.campaignTargets.includes(region)) {
      showToast('Region already targeted!');
      return false;
    }

    gs.partyFunds -= cost.funds;
    gs.activists -= cost.activists;
    gs.campaignTargets.push(region);

    // Apply polling boost in region
    applyRegionalBoost(region, 1.5);

    saveGame();
    showToast(`Now targeting ${region}!`, 'success');
    return true;
  }

  function applyRegionalBoost(region, amount) {
    const gs = gameState;
    const regionCons = CONSTITUENCIES.filter(c => c.region === region);
    if (regionCons.length === 0) return;

    // Boost player's national polling slightly based on region size
    const boostFactor = (regionCons.length / CONFIG.TOTAL_SEATS) * amount;
    gs.polling[gs.playerParty] = Math.max(0.5, gs.polling[gs.playerParty] + boostFactor);

    // Reduce a competitor slightly
    const competitors = Object.keys(gs.polling).filter(p => p !== gs.playerParty && p !== 'other' && gs.polling[p] > 2);
    if (competitors.length > 0) {
      const target = pick(competitors);
      gs.polling[target] = Math.max(0.1, gs.polling[target] - boostFactor * 0.5);
    }

    Engine.normalizePolling();
  }

  // ---- Campaign Actions ----

  function holdRally(region) {
    const gs = gameState;
    const cost = { funds: 30, activists: 15 };

    if (gs.partyFunds < cost.funds || gs.activists < cost.activists) {
      showToast('Not enough resources!', 'danger');
      return false;
    }

    gs.partyFunds -= cost.funds;
    gs.activists -= cost.activists;

    // Rally effect
    const roll = Math.random();
    if (roll > 0.3) {
      applyRegionalBoost(region, 1.0);
      gs.approval = clamp(gs.approval + randInt(1, 3), 0, 100);
      gs.unity = clamp(gs.unity + randInt(1, 4), 0, 100);
      showToast('Rally was a success!', 'success');
    } else {
      gs.approval = clamp(gs.approval - randInt(1, 2), 0, 100);
      showToast('Rally had poor turnout.');
    }

    saveGame();
    return true;
  }

  function doorknock(region) {
    const gs = gameState;
    const cost = { funds: 10, activists: 30 };

    if (gs.partyFunds < cost.funds || gs.activists < cost.activists) {
      showToast('Not enough resources!', 'danger');
      return false;
    }

    gs.partyFunds -= cost.funds;
    gs.activists -= cost.activists;

    // Doorknocking is reliable but modest
    applyRegionalBoost(region, 0.7);
    showToast('Canvassers report good reception.', 'success');

    saveGame();
    return true;
  }

  function runAd(region) {
    const gs = gameState;
    const cost = { funds: 80, activists: 5 };

    if (gs.partyFunds < cost.funds) {
      showToast('Not enough funds!', 'danger');
      return false;
    }

    gs.partyFunds -= cost.funds;
    gs.activists -= cost.activists;

    // Ads are expensive but effective
    const roll = Math.random();
    if (roll > 0.25) {
      applyRegionalBoost(region, 2.0);
      gs.approval = clamp(gs.approval + randInt(1, 4), 0, 100);
      showToast('Campaign ad making an impact!', 'success');
    } else {
      gs.approval = clamp(gs.approval - randInt(1, 3), 0, 100);
      showToast('Ad backfired — opponents mocking it.', 'danger');
    }

    saveGame();
    return true;
  }

  // ---- Policy Shift ----

  function shiftPolicy(axis, value) {
    if (!POLICY_AXES[axis]) return;
    gameState.policy[axis] = clamp(value, 0, 100);

    // Policy shifts can affect unity and polling
    const party = PARTIES[gameState.playerParty];
    const diff = Math.abs(value - party.ideology[axis]);
    if (diff > 30) {
      gameState.unity = clamp(gameState.unity - 2, 0, 100);
    }

    saveGame();
  }

  // ---- Election Projection ----

  function getProjection() {
    return Engine.calculateElection();
  }

  return {
    getRegions,
    getMarginalSeats,
    getTargetableRegions,
    targetRegion,
    holdRally,
    doorknock,
    runAd,
    shiftPolicy,
    getProjection,
  };
})();
