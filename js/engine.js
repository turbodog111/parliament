/* ============================================================
   engine.js — Deterministic game mechanics
   Election calculator, polling model, vote arithmetic
   ============================================================ */

const Engine = (() => {

  // ---- Polling Model ----

  function updatePolling() {
    const gs = gameState;
    const parties = Object.keys(gs.polling);

    // Random noise
    parties.forEach(p => {
      if (p === 'other' || p === 'speaker') return;
      const noise = (Math.random() - 0.5) * CONFIG.POLL_NOISE * 2;
      gs.polling[p] = Math.max(0.1, gs.polling[p] + noise);
    });

    // Player party: approval affects polling
    const approvalEffect = (gs.approval - 50) * 0.03;
    gs.polling[gs.playerParty] = Math.max(0.5, gs.polling[gs.playerParty] + approvalEffect);

    // Unity effect — low unity costs support
    if (gs.unity < CONFIG.UNITY_LOW) {
      const unityPenalty = (CONFIG.UNITY_LOW - gs.unity) * 0.02;
      gs.polling[gs.playerParty] = Math.max(0.5, gs.polling[gs.playerParty] - unityPenalty);
    }

    // Mean reversion toward baseline
    parties.forEach(p => {
      if (p === 'other' || p === 'speaker') return;
      const baseline = BASELINE_POLLING[p] || 0;
      const diff = baseline - gs.polling[p];
      gs.polling[p] += diff * CONFIG.POLL_REVERSION;
    });

    // Normalize to ~100%
    normalizePolling();
  }

  function normalizePolling() {
    const gs = gameState;
    const total = Object.values(gs.polling).reduce((s, v) => s + v, 0);
    if (total > 0 && Math.abs(total - 100) > 0.5) {
      const factor = 100 / total;
      Object.keys(gs.polling).forEach(p => {
        gs.polling[p] = Math.round(gs.polling[p] * factor * 10) / 10;
      });
    }
  }

  // ---- Election Calculator ----

  function calculateElection() {
    const gs = gameState;
    const results = {};
    PARTY_ORDER.forEach(p => results[p] = 0);
    results.ind = 0;
    results.speaker = 1; // Speaker always wins
    results.other = 0;

    const constituencyResults = [];

    // Calculate national swing from last election result
    const lastPolling = gs.lastElectionPolling || BASELINE_POLLING;
    const swings = {};
    Object.keys(gs.polling).forEach(p => {
      swings[p] = (gs.polling[p] || 0) - (lastPolling[p] || 0);
    });

    CONSTITUENCIES.forEach(con => {
      const votes = {};
      let totalVote = 0;

      // Apply national swing with regional modifiers
      const regionFactor = getRegionFactor(con.region, con.country);

      Object.keys(con.lean).forEach(party => {
        let baseVote = con.lean[party];
        let swing = (swings[party] || 0) / 100;

        // Regional modifier — parties do better in their base regions
        const partyDef = PARTIES[party];
        if (partyDef && partyDef.baseRegions && partyDef.baseRegions.includes(con.region)) {
          swing *= 1.3; // Amplify swing in base regions
        }

        // Country-locked parties
        if (partyDef && partyDef.country && partyDef.country !== con.country) {
          baseVote = 0;
          swing = 0;
        }

        // Marginality effect — marginals swing more
        const marginalBoost = 1 + con.marginality * 0.3;
        swing *= marginalBoost;

        votes[party] = Math.max(0, baseVote + swing);
        totalVote += votes[party];
      });

      // Add small "other" vote if not accounted
      if (totalVote < 0.95) {
        votes.other = (votes.other || 0) + (1 - totalVote) * 0.5;
      }

      // FPTP: winner takes all
      let winner = 'other';
      let winnerVote = 0;
      let runnerUp = 'other';
      let runnerUpVote = 0;

      Object.entries(votes).forEach(([party, vote]) => {
        if (vote > winnerVote) {
          runnerUp = winner;
          runnerUpVote = winnerVote;
          winner = party;
          winnerVote = vote;
        } else if (vote > runnerUpVote) {
          runnerUp = party;
          runnerUpVote = vote;
        }
      });

      if (results[winner] !== undefined) {
        results[winner]++;
      } else {
        results.other++;
      }

      constituencyResults.push({
        name: con.name,
        region: con.region,
        winner,
        margin: winnerVote - runnerUpVote,
        runnerUp,
        votes,
      });
    });

    // Sort by margin for dramatic reveal
    constituencyResults.sort((a, b) => b.margin - a.margin);

    return { seats: results, constituencies: constituencyResults };
  }

  function getRegionFactor(region, country) {
    // Regional variation factors
    const factors = {
      'Scotland': 0.7,       // Scottish seats less responsive to GB-wide swing
      'Northern Ireland': 0.3, // NI very different
      'Wales': 0.85,
      'London': 1.1,          // London amplifies national trends
    };
    return factors[country] || factors[region] || 1.0;
  }

  // ---- Government Formation ----

  function determineGovernment(seatResults) {
    const sorted = Object.entries(seatResults)
      .filter(([p]) => p !== 'speaker' && p !== 'other' && p !== 'ind')
      .sort((a, b) => b[1] - a[1]);

    const largest = sorted[0];
    const largestParty = largest[0];
    const largestSeats = largest[1];

    // Count effective house (minus SF abstentions and speaker)
    const sfSeats = seatResults.sf || 0;
    const effectiveHouse = CONFIG.TOTAL_SEATS - sfSeats - 1; // -1 for speaker
    const effectiveMajority = Math.floor(effectiveHouse / 2) + 1;

    const hasMajority = largestSeats >= effectiveMajority;

    return {
      pmParty: largestParty,
      hasMajority,
      effectiveMajority,
      governmentSeats: largestSeats,
      hungParliament: !hasMajority,
      sorted,
    };
  }

  // ---- Bill Vote Calculator ----

  function calculateBillVote(bill) {
    const gs = gameState;
    let ayes = 0;
    let noes = 0;
    let abstentions = 0;
    const partyBreakdown = {};

    PARTY_ORDER.forEach(partyId => {
      const party = PARTIES[partyId];
      if (!party) return;
      const seats = gs.seats[partyId] || 0;
      if (seats === 0) return;

      if (party.abstentionist) {
        abstentions += seats;
        partyBreakdown[partyId] = { ayes: 0, noes: 0, seats, abstain: true };
        return;
      }

      // Calculate ideological alignment with bill
      let alignment = 0;
      let axes = 0;
      if (bill.ideology) {
        Object.keys(bill.ideology).forEach(axis => {
          if (party.ideology[axis] !== undefined) {
            const diff = Math.abs(party.ideology[axis] - bill.ideology[axis]);
            alignment += (100 - diff) / 100;
            axes++;
          }
        });
        if (axes > 0) alignment /= axes;
      }

      // Government whip
      const isGovernment = partyId === gs.pmParty || gs.coalitionPartners.includes(partyId);
      const isProposer = partyId === bill.proposer;

      let partyAyes = 0;
      let partyNoes = 0;

      if (isGovernment || isProposer) {
        // Government party — higher rebellion rates for balance
        const rebelRate = isProposer ? 0.15 : 0.2;
        const unityFactor = partyId === gs.playerParty ? gs.unity / 100 : 0.75;
        const rebels = Math.floor(seats * rebelRate * (1 - unityFactor * 0.7));
        partyAyes = seats - rebels;
        partyNoes = rebels;
      } else {
        // Opposition — vote based on ideology alignment with more resistance
        if (alignment > 0.65) {
          // High alignment — some cross-party support
          const supportRate = alignment * 0.6;
          partyAyes = Math.floor(seats * supportRate);
          partyNoes = seats - partyAyes;
        } else if (alignment > 0.4) {
          // Mixed — mostly oppose but some support
          const supportRate = alignment * 0.3;
          partyAyes = Math.floor(seats * supportRate);
          partyNoes = seats - partyAyes;
        } else {
          // Low alignment — firm opposition
          partyAyes = Math.floor(seats * 0.05);
          partyNoes = seats - partyAyes;
        }
      }

      // Add random noise per party (±5 seats, clamped)
      const noise = randInt(-5, 5);
      partyAyes = Math.max(0, Math.min(seats, partyAyes + noise));
      partyNoes = seats - partyAyes;

      ayes += partyAyes;
      noes += partyNoes;
      partyBreakdown[partyId] = { ayes: partyAyes, noes: partyNoes, seats };
    });

    // Speaker doesn't vote (except tie-break)
    const passed = ayes > noes;

    return { ayes, noes, abstentions, passed, majority: ayes - noes, partyBreakdown };
  }

  // ---- Turn Advancement ----

  function advanceTurn() {
    const gs = gameState;
    gs.turn++;
    gs.turnsInParliament++;

    // Update polling
    updatePolling();

    // Approval drift — tends toward 40 over time (gravity of office)
    const approvalDrift = (40 - gs.approval) * 0.02;
    gs.approval = clamp(Math.round(gs.approval + approvalDrift), 0, 100);

    // Unity drift — tends toward 60
    const unityDrift = (60 - gs.unity) * 0.03;
    gs.unity = clamp(Math.round(gs.unity + unityDrift), 0, 100);

    // Resource generation — funds and activists grow each turn
    gs.partyFunds += CONFIG.CAMPAIGN_FUNDS_PER_TURN;
    gs.activists += CONFIG.CAMPAIGN_ACTIVISTS_PER_TURN;

    // Save
    saveGame();

    return {
      date: formatDate(gs.turn),
      turn: gs.turn,
    };
  }

  function advanceBillStage(bill, vote) {
    if (bill.stage === 'Introduced') {
      // Commons vote — vote result passed in from caller
      if (vote) {
        bill.lastVote = vote;
        if (vote.passed) {
          bill.stage = 'Royal Assent';
          bill.status = 'passed';
          gameState.billHistory.push({ ...bill, passedTurn: gameState.turn });
          gameState.bills = gameState.bills.filter(b => b.id !== bill.id);
        } else {
          bill.status = 'defeated';
          gameState.billHistory.push({ ...bill, defeatedTurn: gameState.turn });
          gameState.bills = gameState.bills.filter(b => b.id !== bill.id);
        }
      }
    }
  }

  // ---- Apply Event Effects ----

  function applyEventEffects(effects) {
    if (!effects || !gameState) return;
    const gs = gameState;
    const oldApproval = gs.approval;

    if (effects.approval) {
      gs.approval = clamp(gs.approval + effects.approval, 0, 100);
    }
    if (effects.unity) {
      gs.unity = clamp(gs.unity + effects.unity, 0, 100);
    }
    if (effects.polling) {
      Object.entries(effects.polling).forEach(([party, change]) => {
        if (gs.polling[party] !== undefined) {
          gs.polling[party] = Math.max(0.1, gs.polling[party] + change);
        }
      });
      normalizePolling();
    }
    if (effects.funds) {
      gs.partyFunds = Math.max(0, gs.partyFunds + effects.funds);
    }
    if (effects.activists) {
      gs.activists = Math.max(0, gs.activists + effects.activists);
    }

    gs.approvalTrend = gs.approval - oldApproval;
    saveGame();
  }

  // ---- Create Bill ----

  function createBill(title, summary, ideology) {
    const bill = {
      id: 'bill_' + Date.now(),
      title,
      summary,
      proposer: gameState.playerParty,
      stage: 'Introduced',
      status: 'active',
      ideology: ideology || { ...gameState.policy },
      debates: [],
      lastVote: null,
      introducedTurn: gameState.turn,
    };
    gameState.bills.push(bill);
    saveGame();
    return bill;
  }

  // ---- Call Election ----

  function callElection() {
    const gs = gameState;
    gs.phase = 'campaign';
    gs.campaignTargets = [];
    saveGame();
  }

  function runElection() {
    const gs = gameState;
    const result = calculateElection();

    // Store results and snapshot polling as new baseline for next election
    gs.seats = result.seats;
    gs.lastElectionPolling = { ...gs.polling };
    gs.electionCount++;
    gs.electionHistory.push({
      turn: gs.turn,
      date: formatDate(gs.turn),
      seats: { ...result.seats },
      polling: { ...gs.polling },
    });

    // Determine government
    const gov = determineGovernment(result.seats);
    gs.pmParty = gov.pmParty;
    gs.isInGovernment = gs.playerParty === gov.pmParty;
    gs.oppositionLeader = gov.sorted.find(([p]) => p !== gov.pmParty)?.[0] || 'con';
    gs.coalitionPartners = [];
    gs.turnsInParliament = 0;

    // Reset governing state
    gs.phase = 'governing';
    gs.bills = [];
    gs.governmentBudget = 100;

    // Post-election approval boost for winner
    if (gs.isInGovernment) {
      gs.approval = clamp(gs.approval + 10, 0, 100);
      gs.unity = clamp(gs.unity + 15, 0, 100);
    } else {
      gs.approval = clamp(gs.approval - 5, 0, 100);
      gs.unity = clamp(gs.unity - 10, 0, 100);
    }

    saveGame();
    return { election: result, government: gov };
  }

  // ---- Utility: check if election is due ----

  function isElectionDue() {
    return gameState.turnsInParliament >= CONFIG.TURNS_PER_PARLIAMENT;
  }

  function canCallElection() {
    return gameState.isInGovernment && gameState.turnsInParliament >= CONFIG.MIN_ELECTION_TURNS;
  }

  return {
    updatePolling,
    normalizePolling,
    calculateElection,
    determineGovernment,
    calculateBillVote,
    advanceBillStage,
    advanceTurn,
    applyEventEffects,
    createBill,
    callElection,
    runElection,
    isElectionDue,
    canCallElection,
  };
})();
