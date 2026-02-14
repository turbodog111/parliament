/* ============================================================
   events.js — Event system: AI generation + fallback pool
   ============================================================ */

const Events = (() => {

  // ---- Fallback Event Pool ----
  const FALLBACK_EVENTS = [
    {
      title: 'NHS Winter Crisis',
      description: 'A&E departments across England report record waiting times as winter pressures mount. The BMA calls for emergency funding while opposition parties demand action.',
      severity: 'major',
      category: 'health',
      choices: [
        { label: 'Announce emergency NHS funding package', hint: 'Costly but popular', effects: { approval: 8, unity: -3, funds: -100, polling: {} } },
        { label: 'Defend current NHS investment levels', hint: 'Safe but uninspiring', effects: { approval: -3, unity: 5, polling: {} } },
        { label: 'Blame the opposition for legacy underfunding', hint: 'Partisan but risky', effects: { approval: -2, unity: 8, polling: {} } },
      ]
    },
    {
      title: 'Channel Crossing Surge',
      description: 'Record numbers of small boat crossings in the Channel dominate the news cycle. Pressure mounts from all sides for a clear policy response.',
      severity: 'major',
      category: 'immigration',
      choices: [
        { label: 'Announce tougher border measures', hint: 'Plays well with right, alienates left', effects: { approval: 5, unity: -5, polling: {} } },
        { label: 'Propose international cooperation deal', hint: 'Moderate approach', effects: { approval: 2, unity: 3, polling: {} } },
        { label: 'Focus on asylum processing reform', hint: 'Technocratic solution', effects: { approval: -1, unity: 2, polling: {} } },
      ]
    },
    {
      title: 'Interest Rate Decision',
      description: 'The Bank of England is expected to announce its latest interest rate decision. Markets are uncertain and mortgage holders are anxious.',
      severity: 'moderate',
      category: 'economy',
      choices: [
        { label: 'Publicly support the Bank\'s independence', hint: 'Responsible but passive', effects: { approval: 1, unity: 2, polling: {} } },
        { label: 'Announce support for mortgage holders', hint: 'Popular but costly', effects: { approval: 6, unity: 0, funds: -50, polling: {} } },
        { label: 'Call for a review of monetary policy', hint: 'Bold but controversial', effects: { approval: -2, unity: -4, polling: {} } },
      ]
    },
    {
      title: 'Backbench Rebellion Brewing',
      description: 'A group of backbenchers are threatening to vote against the party whip on an upcoming vote, citing concerns about the leadership\'s direction.',
      severity: 'moderate',
      category: 'party-politics',
      choices: [
        { label: 'Meet with rebels privately to negotiate', hint: 'Diplomatic but may look weak', effects: { approval: -1, unity: 8, polling: {} } },
        { label: 'Threaten to withdraw the whip', hint: 'Strong but divisive', effects: { approval: 2, unity: -10, polling: {} } },
        { label: 'Make a public speech rallying the party', hint: 'Risky but could unite', effects: { approval: 3, unity: 5, polling: {} } },
      ]
    },
    {
      title: 'Climate Protest Disruption',
      description: 'Climate protesters have blocked major roads in London, causing widespread disruption. Public opinion is divided between sympathy for the cause and frustration at the methods.',
      severity: 'minor',
      category: 'environment',
      choices: [
        { label: 'Express sympathy for climate concerns', hint: 'Green-friendly but alienates drivers', effects: { approval: -3, unity: -2, polling: {} } },
        { label: 'Call for tougher protest laws', hint: 'Popular with many, dismays liberals', effects: { approval: 4, unity: 0, polling: {} } },
        { label: 'Announce new green policy commitments', hint: 'Pivot to your agenda', effects: { approval: 2, unity: 3, polling: {} } },
      ]
    },
    {
      title: 'Foreign Affairs Crisis',
      description: 'A developing international crisis requires the UK to take a position. Allies are watching closely, and the press demands a response.',
      severity: 'major',
      category: 'foreign-affairs',
      choices: [
        { label: 'Take a strong, hawkish stance', hint: 'Decisive but escalatory', effects: { approval: 5, unity: 4, polling: {} } },
        { label: 'Call for diplomatic mediation', hint: 'Moderate and measured', effects: { approval: 2, unity: 2, polling: {} } },
        { label: 'Focus on domestic impact', hint: 'Inward-looking but relatable', effects: { approval: 1, unity: 0, polling: {} } },
      ]
    },
    {
      title: 'Housing Affordability Report',
      description: 'A damning report reveals housing affordability has reached crisis levels in major cities. Young voters are especially frustrated.',
      severity: 'moderate',
      category: 'housing',
      choices: [
        { label: 'Announce a major housebuilding programme', hint: 'Bold but upsets NIMBYs', effects: { approval: 6, unity: -3, polling: {} } },
        { label: 'Offer help-to-buy extension', hint: 'Popular but accused of inflating prices', effects: { approval: 3, unity: 2, polling: {} } },
        { label: 'Promise planning reform review', hint: 'Cautious, low impact', effects: { approval: 0, unity: 1, polling: {} } },
      ]
    },
    {
      title: 'Education Standards Row',
      description: 'OFSTED inspection results trigger a fierce debate about education standards, teacher recruitment, and school funding.',
      severity: 'minor',
      category: 'education',
      choices: [
        { label: 'Pledge increased education spending', hint: 'Popular with parents and teachers', effects: { approval: 5, unity: 1, funds: -50, polling: {} } },
        { label: 'Defend current education reforms', hint: 'Steady approach', effects: { approval: -1, unity: 3, polling: {} } },
        { label: 'Announce curriculum review', hint: 'Kicks the can but shows concern', effects: { approval: 1, unity: 0, polling: {} } },
      ]
    },
    {
      title: 'Royal Controversy',
      description: 'A member of the Royal Family makes controversial public comments about government policy, sparking a constitutional debate.',
      severity: 'minor',
      category: 'royal',
      choices: [
        { label: 'Diplomatically note constitutional boundaries', hint: 'Statesmanlike', effects: { approval: 3, unity: 2, polling: {} } },
        { label: 'Publicly criticise the intervention', hint: 'Risky — could backfire', effects: { approval: -4, unity: 5, polling: {} } },
        { label: 'Ignore and redirect to policy agenda', hint: 'Avoids the trap', effects: { approval: 0, unity: 0, polling: {} } },
      ]
    },
    {
      title: 'Transport Strike Wave',
      description: 'Rail workers announce a series of strikes over pay and conditions. Commuters face weeks of disruption.',
      severity: 'moderate',
      category: 'transport',
      choices: [
        { label: 'Support workers\' right to fair pay', hint: 'Union-friendly but disruption continues', effects: { approval: -3, unity: 4, polling: {} } },
        { label: 'Call for minimum service legislation', hint: 'Tough approach, divides opinion', effects: { approval: 3, unity: -3, polling: {} } },
        { label: 'Offer to mediate between sides', hint: 'Moderate but could satisfy neither', effects: { approval: 1, unity: 1, polling: {} } },
      ]
    },
    {
      title: 'Ministerial Scandal',
      description: 'A senior minister is accused of breaking the ministerial code. The press demands accountability and opposition calls for resignation.',
      severity: 'major',
      category: 'scandal',
      choices: [
        { label: 'Sack the minister immediately', hint: 'Decisive but loses an ally', effects: { approval: 7, unity: -8, polling: {} } },
        { label: 'Launch an independent inquiry', hint: 'Measured but looks like delay', effects: { approval: -2, unity: 3, polling: {} } },
        { label: 'Publicly back the minister', hint: 'Loyal but politically dangerous', effects: { approval: -8, unity: 6, polling: {} } },
      ]
    },
    {
      title: 'Cost of Living Squeeze',
      description: 'New inflation figures show the cost of living is still rising faster than wages. Families across the country are struggling.',
      severity: 'major',
      category: 'economy',
      choices: [
        { label: 'Announce targeted household support', hint: 'Popular but expensive', effects: { approval: 7, unity: 1, funds: -80, polling: {} } },
        { label: 'Point to long-term economic plan', hint: 'On-message but tone-deaf', effects: { approval: -4, unity: 4, polling: {} } },
        { label: 'Blame global economic conditions', hint: 'Deflects but unconvincing', effects: { approval: -2, unity: 2, polling: {} } },
      ]
    },
    {
      title: 'Scottish Independence Push',
      description: 'The Scottish Government announces plans for a new independence referendum. Constitutional tensions escalate.',
      severity: 'major',
      category: 'party-politics',
      choices: [
        { label: 'Firmly reject any referendum', hint: 'Unionist-friendly, angers Scotland', effects: { approval: 2, unity: 3, polling: {} } },
        { label: 'Offer enhanced devolution instead', hint: 'Compromise approach', effects: { approval: 1, unity: -2, polling: {} } },
        { label: 'Agree to talks on the constitution', hint: 'Open but politically dangerous', effects: { approval: -3, unity: -5, polling: {} } },
      ]
    },
    {
      title: 'Crime Wave Headlines',
      description: 'A series of high-profile violent crimes dominate the tabloids. The public demands tougher action on law and order.',
      severity: 'moderate',
      category: 'crime',
      choices: [
        { label: 'Announce more police funding', hint: 'Direct response', effects: { approval: 5, unity: 2, funds: -60, polling: {} } },
        { label: 'Propose tougher sentencing laws', hint: 'Populist but effective', effects: { approval: 4, unity: 0, polling: {} } },
        { label: 'Highlight root causes and prevention', hint: 'Evidence-based but seen as soft', effects: { approval: -2, unity: 3, polling: {} } },
      ]
    },
    {
      title: 'Media Ethics Inquiry',
      description: 'Allegations of phone hacking at a major newspaper resurface, reigniting the debate over press regulation.',
      severity: 'minor',
      category: 'media',
      choices: [
        { label: 'Call for stronger press regulation', hint: 'Principled but makes press enemies', effects: { approval: 2, unity: -2, polling: {} } },
        { label: 'Defend press freedom', hint: 'Wins media support', effects: { approval: 0, unity: 2, polling: {} } },
        { label: 'Stay neutral, let inquiry proceed', hint: 'Safe but unremarkable', effects: { approval: 0, unity: 0, polling: {} } },
      ]
    },
  ];

  // Track which fallbacks have been used
  let usedFallbackIndices = [];

  function getRandomFallbackEvent() {
    // Reset if all used
    if (usedFallbackIndices.length >= FALLBACK_EVENTS.length) {
      usedFallbackIndices = [];
    }

    let idx;
    do {
      idx = randInt(0, FALLBACK_EVENTS.length - 1);
    } while (usedFallbackIndices.includes(idx));

    usedFallbackIndices.push(idx);

    // Deep clone and add player-specific polling effects
    const event = JSON.parse(JSON.stringify(FALLBACK_EVENTS[idx]));
    event.choices.forEach(choice => {
      if (choice.effects.approval) {
        choice.effects.polling = choice.effects.polling || {};
        choice.effects.polling[gameState.playerParty] = choice.effects.approval * 0.3;
      }
    });

    return event;
  }

  // ---- Generate Event (AI with fallback) ----

  async function generateTurnEvent() {
    // 70% chance of event each turn
    if (Math.random() > 0.7) return null;

    // Try AI first
    if (gameState.aiEnabled && gameState.ollamaModel) {
      try {
        const aiEvent = await AI.generateEvent();
        if (aiEvent) {
          // Validate and sanitize effects
          aiEvent.choices.forEach(c => {
            c.effects = c.effects || {};
            c.effects.approval = clamp(c.effects.approval || 0, -15, 15);
            c.effects.unity = clamp(c.effects.unity || 0, -15, 15);
            c.effects.polling = c.effects.polling || {};
          });
          aiEvent.aiGenerated = true;
          return aiEvent;
        }
      } catch (e) {
        console.warn('AI event generation failed, using fallback:', e);
      }
    }

    // Fallback
    return getRandomFallbackEvent();
  }

  // ---- Generate Headlines ----

  const FALLBACK_HEADLINES = [
    [
      { source: 'BBC', headline: 'Government faces mounting pressure over policy direction' },
      { source: 'Guardian', headline: 'Critics say PM\'s approach is failing working families' },
      { source: 'Telegraph', headline: 'PM must show stronger leadership, say backbenchers' },
    ],
    [
      { source: 'BBC', headline: 'Latest polling shows tightening race ahead of next election' },
      { source: 'Sun', headline: 'CRUNCH TIME for PM as polls narrow' },
      { source: 'Times', headline: 'Westminster insiders predict cabinet reshuffle' },
    ],
    [
      { source: 'BBC', headline: 'Economy dominates Parliamentary agenda this week' },
      { source: 'Guardian', headline: 'Inequality gap widens under current government, report finds' },
      { source: 'Telegraph', headline: 'Business leaders call for tax reform and deregulation' },
    ],
    [
      { source: 'BBC', headline: 'Cross-party talks on key legislation expected this week' },
      { source: 'Times', headline: 'Backbench rebellion threatens government majority' },
      { source: 'Sun', headline: 'PM in HOT WATER as party rebels circle' },
    ],
    [
      { source: 'BBC', headline: 'NHS waiting list figures prompt urgent Commons debate' },
      { source: 'Guardian', headline: 'Health service at breaking point, warn senior doctors' },
      { source: 'Telegraph', headline: 'Throwing money at NHS won\'t fix structural problems' },
    ],
  ];

  async function generateTurnHeadlines() {
    if (gameState.aiEnabled && gameState.ollamaModel) {
      try {
        const headlines = await AI.generateHeadlines();
        if (headlines) return headlines;
      } catch (e) {
        console.warn('AI headline generation failed:', e);
      }
    }
    return pick(FALLBACK_HEADLINES);
  }

  // ---- Handle Event Choice ----

  function handleEventChoice(event, choiceIndex) {
    const choice = event.choices[choiceIndex];
    if (!choice) return;

    // Apply mechanical effects
    Engine.applyEventEffects(choice.effects);

    // Log the event
    gameState.eventLog.push({
      title: event.title,
      description: event.description,
      severity: event.severity,
      category: event.category,
      chosenLabel: choice.label,
      chosenEffects: choice.effects,
      turn: gameState.turn,
      date: formatDate(gameState.turn),
    });

    gameState.currentEvent = null;
    saveGame();

    return choice;
  }

  return {
    generateTurnEvent,
    generateTurnHeadlines,
    handleEventChoice,
    FALLBACK_EVENTS,
  };
})();
