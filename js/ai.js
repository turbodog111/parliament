/* ============================================================
   ai.js — Ollama API layer (streaming + non-streaming)
   Adapted from moni-talk pattern — Ollama only
   ============================================================ */

const AI = (() => {
  // ---- Model Discovery ----

  async function fetchModels() {
    const endpoint = gameState?.ollamaEndpoint || CONFIG.OLLAMA_ENDPOINT;
    try {
      const res = await fetch(`${endpoint}/v1/models`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data || []).map(m => ({ id: m.id, label: m.id }));
    } catch {
      return [];
    }
  }

  // ---- Core API Calls ----

  async function chat(messages, { temperature = 0.7, maxTokens = 600, stream = false, onChunk = null } = {}) {
    const endpoint = gameState?.ollamaEndpoint || CONFIG.OLLAMA_ENDPOINT;
    const model = gameState?.ollamaModel || CONFIG.OLLAMA_MODEL;

    if (!model) {
      throw new Error('No Ollama model selected. Open Settings to choose one.');
    }

    const body = {
      model,
      messages,
      stream,
      options: {
        temperature,
        num_predict: maxTokens,
      },
    };

    if (stream && onChunk) {
      return await streamNDJSON(endpoint, body, onChunk);
    } else {
      return await fetchJSON(endpoint, body);
    }
  }

  async function fetchJSON(endpoint, body) {
    body.stream = false;
    const res = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Ollama error (${res.status}): ${errText}`);
    }
    const data = await res.json();
    return data.message?.content?.trim() || '';
  }

  async function streamNDJSON(endpoint, body, onChunk) {
    body.stream = true;
    const res = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Ollama error (${res.status}): ${errText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '', buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const j = JSON.parse(line);
          const c = j.message?.content || '';
          if (c) { full += c; onChunk(c); }
        } catch {}
      }
    }
    if (buf.trim()) {
      try {
        const j = JSON.parse(buf);
        const c = j.message?.content || '';
        if (c) { full += c; onChunk(c); }
      } catch {}
    }
    return full.trim() || '';
  }

  // ---- JSON Parsing (3-tier fallback) ----

  function parseJSON(text) {
    // Tier 1: Direct parse
    try { return JSON.parse(text); } catch {}

    // Tier 2: Extract from markdown code block
    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) {
      try { return JSON.parse(codeBlock[1].trim()); } catch {}
    }

    // Tier 3: Find JSON object/array with regex
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[1]); } catch {}
    }

    return null;
  }

  // ---- Game Context Builder ----

  function buildContext() {
    const gs = gameState;
    const playerParty = PARTIES[gs.playerParty];
    const pmParty = PARTIES[gs.pmParty];
    const oppParty = PARTIES[gs.oppositionLeader];
    const date = formatDate(gs.turn);

    // Government majority calculation
    const govSeats = gs.seats[gs.pmParty] || 0;
    const sfSeats = gs.seats.sf || 0;
    const effectiveHouse = CONFIG.TOTAL_SEATS - sfSeats - 1;
    const majoritySize = govSeats - Math.floor(effectiveHouse / 2);
    const majorityDesc = majoritySize > 0
      ? `a working majority of ${majoritySize}`
      : `no majority (${majoritySize} short, minority/coalition government)`;

    // Seat breakdown (only parties with seats)
    const seatBreakdown = Object.entries(gs.seats)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([p, s]) => `${PARTIES[p]?.name || p}: ${s} seats`)
      .join(', ');

    // Polling breakdown
    const pollBreakdown = Object.entries(gs.polling)
      .filter(([p, v]) => v >= 1 && p !== 'other')
      .sort((a, b) => b[1] - a[1])
      .map(([p, v]) => `${PARTIES[p]?.name || p}: ${v.toFixed(1)}%`)
      .join(', ');

    // Recent events for context
    const recentEvents = gs.eventLog.slice(-3)
      .map(e => e.title)
      .filter(Boolean);
    const eventContext = recentEvents.length > 0
      ? `Recent political events: ${recentEvents.join('; ')}`
      : 'No major recent events.';

    // Recent headlines
    const recentHeadlines = (gs.newsLog || []).slice(-3)
      .map(h => `"${h.headline}" (${h.source})`)
      .filter(Boolean);
    const headlineContext = recentHeadlines.length > 0
      ? `Recent headlines: ${recentHeadlines.join('; ')}`
      : '';

    // Active bills
    const billContext = gs.bills.length > 0
      ? `Bills before Parliament: ${gs.bills.map(b => `"${b.title}" (proposed by ${PARTIES[b.proposer]?.name || b.proposer})`).join('; ')}`
      : 'No bills currently before Parliament.';

    return `UK political situation as of ${date}:

GOVERNMENT: The ${pmParty?.name || gs.pmParty} is in power, led by Prime Minister ${gs.pmParty === gs.playerParty ? gs.playerName : (pmParty?.leader || 'the PM')}. They hold ${govSeats} of ${CONFIG.TOTAL_SEATS} seats in the House of Commons, giving them ${majorityDesc}.

OPPOSITION: The Leader of the Opposition is ${oppParty?.leader || 'unknown'} (${oppParty?.name || gs.oppositionLeader}), with ${gs.seats[gs.oppositionLeader] || 0} seats.

HOUSE OF COMMONS: ${seatBreakdown}.

NATIONAL POLLING: ${pollBreakdown}.

PM APPROVAL: ${gs.approval}% (${gs.approval >= 50 ? 'positive' : gs.approval >= 35 ? 'middling' : 'poor'}). Government party unity: ${gs.unity}% (${gs.unity >= 70 ? 'strong' : gs.unity >= 50 ? 'shaky' : 'fractured'}).

${eventContext}
${headlineContext}
${billContext}

The player controls ${playerParty?.name || gs.playerParty}${gs.isInGovernment ? ' (the governing party)' : ' (in opposition)'}, led by ${gs.playerName}.`;
  }

  // ---- Prompt Types ----

  async function generateEvent() {
    const context = buildContext();
    const messages = [{
      role: 'system',
      content: `You are a British political event generator for a Parliament simulator game. Generate realistic UK political events.
Return ONLY a JSON object (no markdown, no explanation) with this exact structure:
{"title":"Event title","description":"2-3 sentence description","severity":"minor|moderate|major|crisis","category":"economy|health|immigration|crime|environment|foreign-affairs|education|housing|transport|party-politics|scandal|media","choices":[{"label":"Choice text","hint":"Brief mechanical hint","effects":{"approval":0,"unity":0,"polling":{"partyId":0}}},{"label":"Choice text","hint":"Hint","effects":{"approval":0,"unity":0}},{"label":"Choice text","hint":"Hint","effects":{"approval":0,"unity":0}}]}`
    }, {
      role: 'user',
      content: `${context}\n\nGenerate a political event appropriate for this situation. Make it specific to the current government, naming the governing party and PM where relevant. Reference real policy areas and the political dynamics described above. The three choices should have different risk/reward profiles. Effects should range from -15 to +15 for approval/unity.`
    }];

    try {
      const raw = await chat(messages, { temperature: 0.85, maxTokens: 600 });
      const parsed = parseJSON(raw);
      if (parsed && parsed.title && parsed.choices && parsed.choices.length >= 2) {
        return parsed;
      }
    } catch (e) {
      console.warn('AI event generation failed:', e);
    }
    return null;
  }

  async function generateDebate(bill, onChunk) {
    const context = buildContext();
    const gs = gameState;
    const proposerParty = PARTIES[bill.proposer];
    const oppParty = PARTIES[gs.oppositionLeader];
    const pmParty = PARTIES[gs.pmParty];

    const messages = [{
      role: 'system',
      content: `You are writing a vivid Parliamentary debate transcript for the UK House of Commons. Write in the style of Hansard but more dramatic.

Key rules:
- The ${pmParty?.name || 'governing party'} is the GOVERNMENT. Their MPs sit on the government benches.
- The ${oppParty?.name || 'opposition'} is the OFFICIAL OPPOSITION. Their leader is ${oppParty?.leader || 'unknown'}.
- This bill was proposed by ${proposerParty?.name || 'the government'}. ${bill.proposer === gs.pmParty ? 'As a government bill, it carries the weight of the front bench.' : 'As an opposition bill, the government may resist it.'}
- Include multiple speakers from different parties, reactions from backbenchers (e.g., "Hear, hear!" or "Shame!"), and the Speaker maintaining order.
- Use British political language and Commons conventions.
- End with the Speaker calling the division: "The Question is that the Bill be now read. As many as are of that opinion say Aye... of the contrary No... Division! Clear the lobbies!" Do NOT include the vote result numbers — those will be shown separately.`
    }, {
      role: 'user',
      content: `${context}\n\nWrite a Commons debate on the bill: "${bill.title}" — ${bill.summary}\nProposed by: ${proposerParty?.name} (${bill.proposer === gs.pmParty ? 'Government bill' : 'Opposition/backbench bill'})\n\nWrite 4-6 speech exchanges. Include the proposing minister or MP's opening, the opposition response, at least one backbench intervention, and Speaker interjections. Make the debate feel grounded in the current political situation described above.`
    }];

    try {
      return await chat(messages, { temperature: 0.8, maxTokens: 1200, stream: true, onChunk });
    } catch (e) {
      console.warn('AI debate failed:', e);
      return null;
    }
  }

  async function generatePMQ(strategy, topic, onChunk) {
    const context = buildContext();
    const gs = gameState;
    const oppositionParty = PARTIES[gs.oppositionLeader] || PARTIES.con;

    const messages = [{
      role: 'system',
      content: `You are writing Prime Minister's Questions (PMQs) for the UK House of Commons. Write a dramatic, combative exchange between the PM and Leader of the Opposition. Include jeering, cheering, Speaker interventions ("Order! Order!"), and the theatrical atmosphere of PMQs. The PM's strategy is: ${strategy}.`
    }, {
      role: 'user',
      content: `${context}\n\nWrite a PMQ exchange (4-6 rounds) between:
PM: ${gs.playerName} (${PARTIES[gs.playerParty]?.name})
Opposition Leader: ${oppositionParty.leader} (${oppositionParty.name})
Topic: ${topic || 'general questioning'}
PM strategy: ${strategy}

Include Speaker calls, backbench reactions, and dramatic tension.`
    }];

    try {
      return await chat(messages, { temperature: 0.8, maxTokens: 800, stream: true, onChunk });
    } catch (e) {
      console.warn('AI PMQ failed:', e);
      return null;
    }
  }

  async function generateHeadlines() {
    const context = buildContext();
    const gs = gameState;
    const lastEvent = gs.eventLog[gs.eventLog.length - 1];
    const eventContext = lastEvent ? `\nLatest event: "${lastEvent.title}" — Player chose: "${lastEvent.chosenLabel}"` : '';
    const pmParty = PARTIES[gs.pmParty];

    const messages = [{
      role: 'system',
      content: `You are generating British newspaper headlines for a Parliament simulator. The ${pmParty?.name || 'governing party'} is currently in government. Return ONLY a JSON array of 3-4 headline objects.
Format: [{"source":"BBC|Guardian|Telegraph|Sun|Times","headline":"The headline text"}]
Each outlet has a distinct voice: BBC is neutral, Guardian is left-leaning, Telegraph is right-leaning, Sun is tabloid/populist, Times is establishment. Headlines should reflect the current political situation — who is in power, their policies, and recent events.`
    }, {
      role: 'user',
      content: `${context}${eventContext}\n\nGenerate 3-4 newspaper headlines about the current political situation. Make them specific to the parties and leaders involved — name names, reference the government and opposition by party.`
    }];

    try {
      const raw = await chat(messages, { temperature: 0.7, maxTokens: 200 });
      const parsed = parseJSON(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {
      console.warn('AI headlines failed:', e);
    }
    return null;
  }

  async function generateVoteAnalysis(bill) {
    const context = buildContext();
    const messages = [{
      role: 'system',
      content: `You are a Parliamentary vote analyst. Provide a brief analysis of how a bill vote is likely to go, considering party positions, whipping, and potential rebels. Return ONLY a JSON object:
{"prediction":"likely_pass|likely_fail|too_close","analysis":"2-3 sentence analysis","keyFactors":["factor1","factor2"],"potentialRebels":"description of likely rebels"}`
    }, {
      role: 'user',
      content: `${context}\n\nAnalyse the upcoming vote on: "${bill.title}" - ${bill.summary}\nStage: ${bill.stage}, Proposed by: ${PARTIES[bill.proposer]?.name}`
    }];

    try {
      const raw = await chat(messages, { temperature: 0.4, maxTokens: 400 });
      const parsed = parseJSON(raw);
      if (parsed && parsed.prediction) return parsed;
    } catch (e) {
      console.warn('AI vote analysis failed:', e);
    }
    return null;
  }

  async function generateBillDraft(topic, position) {
    const context = buildContext();
    const messages = [{
      role: 'system',
      content: `You are a Parliamentary bill drafter. Generate a bill for the UK Parliament. Return ONLY a JSON object:
{"title":"Short Bill Title Act 20XX","summary":"One paragraph describing what the bill does","ideology":{"economy":50,"tax":50,"nhs":50,"immigration":50,"environment":50,"defence":50,"devolution":50}}`
    }, {
      role: 'user',
      content: `${context}\n\nDraft a bill about: ${topic}\nPolitical leaning: ${position || 'aligned with the proposing party\'s ideology'}`
    }];

    try {
      const raw = await chat(messages, { temperature: 0.6, maxTokens: 600 });
      const parsed = parseJSON(raw);
      if (parsed && parsed.title) return parsed;
    } catch (e) {
      console.warn('AI bill draft failed:', e);
    }
    return null;
  }

  // ---- Connection Test ----

  async function testConnection() {
    const endpoint = gameState?.ollamaEndpoint || CONFIG.OLLAMA_ENDPOINT;
    try {
      const res = await fetch(`${endpoint}/v1/models`, { signal: AbortSignal.timeout(5000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  return {
    fetchModels,
    chat,
    parseJSON,
    buildContext,
    generateEvent,
    generateDebate,
    generatePMQ,
    generateHeadlines,
    generateVoteAnalysis,
    generateBillDraft,
    testConnection,
  };
})();
