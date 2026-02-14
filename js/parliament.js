/* ============================================================
   parliament.js — Governing phase: bills, debates, PMQs, whipping
   ============================================================ */

const Parliament = (() => {

  let currentDebateStream = null;
  let currentPMQStream = null;

  // ---- Bill Management ----

  async function proposeBill(topic) {
    if (!topic) return null;

    // Try AI bill drafting
    if (gameState.aiEnabled && gameState.ollamaModel) {
      try {
        const draft = await AI.generateBillDraft(topic);
        if (draft) {
          return Engine.createBill(draft.title, draft.summary, draft.ideology);
        }
      } catch (e) {
        console.warn('AI bill draft failed:', e);
      }
    }

    // Fallback: create a generic bill
    const year = getYear(gameState.turn);
    return Engine.createBill(
      `${topic} Act ${year}`,
      `A bill to address ${topic.toLowerCase()} through comprehensive legislative reform.`,
      { ...gameState.policy }
    );
  }

  function getBills() {
    return gameState.bills;
  }

  function getBillHistory() {
    return gameState.billHistory;
  }

  // ---- Debates ----

  async function startDebate(bill, onChunk) {
    if (!bill) return null;

    const debateContainer = $('debateTranscript');
    if (debateContainer) {
      debateContainer.innerHTML = '';
      debateContainer.classList.add('streaming-cursor');
    }

    let transcript = '';

    const chunkHandler = (chunk) => {
      transcript += chunk;
      if (debateContainer) {
        debateContainer.innerHTML = renderMarkdown(transcript);
        debateContainer.scrollTop = debateContainer.scrollHeight;
      }
      if (onChunk) onChunk(chunk);
    };

    // Try AI debate
    if (gameState.aiEnabled && gameState.ollamaModel) {
      try {
        const result = await AI.generateDebate(bill, chunkHandler);
        if (debateContainer) debateContainer.classList.remove('streaming-cursor');
        if (result) {
          bill.debates.push({ turn: gameState.turn, transcript: result });
          saveGame();
          return result;
        }
      } catch (e) {
        console.warn('AI debate failed:', e);
      }
    }

    // Fallback debate
    const fallback = generateFallbackDebate(bill);
    if (debateContainer) {
      debateContainer.innerHTML = renderMarkdown(fallback);
      debateContainer.classList.remove('streaming-cursor');
    }
    bill.debates.push({ turn: gameState.turn, transcript: fallback });
    saveGame();
    return fallback;
  }

  function generateFallbackDebate(bill) {
    const gs = gameState;
    const proposer = PARTIES[bill.proposer];
    const pm = PARTIES[gs.pmParty];
    const opp = PARTIES[gs.oppositionLeader];
    const isGovBill = bill.proposer === gs.pmParty;
    const proposerName = proposer?.leader || 'The Minister';
    const oppName = opp?.leader || 'The Opposition Leader';
    const pmName = gs.pmParty === gs.playerParty ? gs.playerName : (pm?.leader || 'The Prime Minister');

    const govLabel = isGovBill ? 'Government' : proposer?.name || 'Opposition';
    const benchReaction = isGovBill ? 'Government' : proposer?.name || 'Opposition';

    return `**Mr Speaker:** Order! Order! The House will come to order. We now come to the ${bill.title}. I call upon the ${isGovBill ? 'Minister' : 'Honourable Member for ' + (proposer?.name || 'the Opposition')} to move that the bill be now read.

**${proposerName} (${proposer?.name}):** Mr Speaker, I rise to present this bill to the House. ${bill.summary} This legislation represents a vital step forward for our nation under this ${pm?.name || 'Government'} government, and I commend it to the House.

*[Cries of "Hear, hear!" from the ${benchReaction} benches]*

**${oppName} (${opp?.name}):** Mr Speaker, ${isGovBill ? 'the Government' : 'the Honourable Member'} asks us to support this measure, yet we on these benches have grave concerns. ${isGovBill ? `The ${pm?.name} government has` : 'This proposal has'} once again shown ${isGovBill ? 'it is' : 'itself to be'} out of touch with the needs of ordinary working people across this country.

*[Cries of "Shame!" from ${benchReaction} benches, cheers from ${isGovBill ? 'Opposition' : 'Government'} benches]*

**Mr Speaker:** Order! The honourable members will contain themselves.

**Backbench MP:** Mr Speaker, will the ${isGovBill ? 'Minister' : 'Honourable Member'} give way? I represent a constituency that will be directly affected by this legislation, and my constituents deserve answers.

**${proposerName}:** I thank the honourable member for their intervention. I can assure them and the House that this bill has been carefully drafted with their constituents in mind.

**Mr Speaker:** I think we have heard sufficient debate. The Question is that the bill be now read. As many as are of that opinion say "Aye."

*[Cries of "Aye!"]*

**Mr Speaker:** Of the contrary, "No."

*[Cries of "No!"]*

**Mr Speaker:** Division! Clear the lobbies!`;
  }

  // ---- PMQs ----

  async function startPMQs(strategy, onChunk) {
    const gs = gameState;
    if (!gs.isInGovernment) return null;

    const transcriptEl = $('pmqTranscript');
    if (transcriptEl) {
      transcriptEl.innerHTML = '';
      transcriptEl.classList.add('streaming-cursor');
    }

    let transcript = '';
    const chunkHandler = (chunk) => {
      transcript += chunk;
      if (transcriptEl) {
        transcriptEl.innerHTML = renderMarkdown(transcript);
        transcriptEl.scrollTop = transcriptEl.scrollHeight;
      }
      if (onChunk) onChunk(chunk);
    };

    // Determine topic from recent events
    const recentEvent = gs.eventLog[gs.eventLog.length - 1];
    const topic = recentEvent ? recentEvent.title : 'the economy and public services';

    // Try AI
    if (gs.aiEnabled && gs.ollamaModel) {
      try {
        const result = await AI.generatePMQ(strategy, topic, chunkHandler);
        if (transcriptEl) transcriptEl.classList.remove('streaming-cursor');
        if (result) {
          applyPMQEffects(strategy);
          return result;
        }
      } catch (e) {
        console.warn('AI PMQ failed:', e);
      }
    }

    // Fallback
    const fallback = generateFallbackPMQ(strategy);
    if (transcriptEl) {
      transcriptEl.innerHTML = renderMarkdown(fallback);
      transcriptEl.classList.remove('streaming-cursor');
    }
    applyPMQEffects(strategy);
    return fallback;
  }

  function generateFallbackPMQ(strategy) {
    const gs = gameState;
    const pm = gs.playerName;
    const pmParty = PARTIES[gs.playerParty];
    const opp = PARTIES[gs.oppositionLeader];
    const oppLeader = opp?.leader || 'The Leader of the Opposition';

    const strategyResponses = {
      attack: `**The Prime Minister (${pm}):** Mr Speaker, I must say, the Right Honourable member's question reveals a fundamental misunderstanding of the issue. Perhaps if ${opp?.name || 'the opposition'} spent less time plotting and more time proposing solutions, we might get somewhere.

*[Roar of approval from Government benches, cries of "More!" ]*`,
      defend: `**The Prime Minister (${pm}):** Mr Speaker, I am proud of this Government's record. Since taking office, we have delivered on our promises, and the results speak for themselves.

*[Cries of "Hear, hear!" from the Government benches]*`,
      pivot: `**The Prime Minister (${pm}):** Mr Speaker, the real question the country is asking is not what the Right Honourable member has raised, but rather what this Government is doing to improve the lives of working people — and on that, our record is clear.

*[Mixed reactions from both sides]*`,
      humour: `**The Prime Minister (${pm}):** Mr Speaker, I thank the Right Honourable member for that question — though I suspect even they have forgotten what point they were trying to make!

*[Laughter across the House]*`,
    };

    return `**Mr Speaker:** Prime Minister's Questions! Questions to the Prime Minister. Question number one — ${oppLeader}.

**${oppLeader} (${opp?.name || 'Opposition'}):** Mr Speaker, the Prime Minister promised the British people real change, yet we see more of the same. Can the Prime Minister explain why ordinary families are still worse off?

*[Cheers from Opposition benches]*

${strategyResponses[strategy] || strategyResponses.defend}

**${oppLeader}:** Mr Speaker, the Prime Minister did not answer my question — as usual. Will the Right Honourable member admit that this Government has failed on the issues that matter most to people?

*[Cries of "Answer the question!" from Opposition]*

**The Prime Minister (${pm}):** Mr Speaker, I reject that characterisation entirely. This Government is focused on delivering results, not trading soundbites.

**Mr Speaker:** Order! Order! I remind members that the public are watching these proceedings.`;
  }

  function applyPMQEffects(strategy) {
    const roll = Math.random();
    const effects = {};

    switch (strategy) {
      case 'attack':
        if (roll > 0.5) {
          effects.approval = randInt(2, 6);
          effects.unity = randInt(1, 4);
        } else {
          effects.approval = randInt(-4, -1);
          effects.unity = randInt(-2, 2);
        }
        break;
      case 'defend':
        effects.approval = randInt(-1, 3);
        effects.unity = randInt(1, 3);
        break;
      case 'pivot':
        effects.approval = randInt(0, 4);
        effects.unity = randInt(0, 2);
        break;
      case 'humour':
        if (roll > 0.4) {
          effects.approval = randInt(3, 8);
          effects.unity = randInt(2, 5);
        } else {
          effects.approval = randInt(-6, -2);
          effects.unity = randInt(-3, -1);
        }
        break;
    }

    Engine.applyEventEffects(effects);
    showToast(`PMQs concluded. Approval ${effects.approval >= 0 ? '+' : ''}${effects.approval}%`, effects.approval >= 0 ? 'success' : 'danger');
  }

  // ---- Bill Advancement Orchestrator ----

  async function advanceBill(bill, onDebateChunk) {
    // Debate the bill, then vote
    await startDebate(bill, onDebateChunk);
    const vote = Engine.calculateBillVote(bill);
    Engine.advanceBillStage(bill, vote);
    return {
      type: 'vote',
      vote,
      bill,
      passed: vote.passed,
      newStage: bill.stage,
    };
  }

  // ---- Vote Analysis ----

  async function analyseVote(bill) {
    if (gameState.aiEnabled && gameState.ollamaModel) {
      try {
        return await AI.generateVoteAnalysis(bill);
      } catch (e) {
        console.warn('AI vote analysis failed:', e);
      }
    }

    // Fallback analysis
    const vote = Engine.calculateBillVote(bill);
    const prediction = vote.majority > 20 ? 'likely_pass' : vote.majority < -20 ? 'likely_fail' : 'too_close';
    return {
      prediction,
      analysis: `Based on current party positions, the vote is expected to be ${vote.ayes} Ayes to ${vote.noes} Noes. ${prediction === 'too_close' ? 'This will be a tight vote.' : ''}`,
      keyFactors: ['Party discipline', 'Ideological alignment'],
      potentialRebels: vote.majority < 30 ? 'Some backbenchers may rebel on this issue.' : 'Rebellion unlikely given the comfortable margin.',
    };
  }

  return {
    proposeBill,
    getBills,
    getBillHistory,
    startDebate,
    advanceBill,
    startPMQs,
    analyseVote,
  };
})();
