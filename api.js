/* ============================================================
   WisdomGuide — api.js
   All Anthropic API calls live here.
   ============================================================ */

// ── BASE CALL ──
async function claude(system, messages) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system,
      messages,
    }),
  });
  const data = await response.json();
  return data.content?.[0]?.text || '';
}

// ── FETCH GUIDANCE ──
// Fetches guidance from a single source OR from a composite council.
// Stores result in cache[cacheKey].guidance and re-renders.
async function fetchGuidance(p, w, cacheKey, isCouncil) {
  let system, user;

  if (isCouncil) {
    // ── Council mode: each member speaks in their own voice, then a synthesis ──
    const members    = (p.sources || []).filter(s => w.memberIds.includes(s.id));
    const memberDesc = members
      .map(m => `- ${m.name} (${m.type})${m.ctx ? ': ' + m.ctx : ''}`)
      .join('\n');

    system = `You are a composite council advisor synthesizing the wisdom of these sources/personalities:
${memberDesc}

Your response MUST have two parts:

1. For EACH source/personality, write a dedicated section showing how THEY would address this problem.
   Use their real style, language, known teachings, and actual principles.
   Format each section exactly like this HTML:
   <div class="voice-section">
     <div class="voice-hd">
       <div class="voice-icon">EMOJI</div>
       <div class="voice-name">FULL NAME</div>
     </div>
     <div class="voice-body">
       ... their guidance using <p>, <blockquote>, <strong> ...
     </div>
   </div>

2. After all individual voices, add a final synthesis block:
   <div class="synthesis-block">
     <div class="syn-label">⚡ The Council Speaks</div>
     <div class="syn-text">
       <p>... unified, powerful advice combining all their insights ...</p>
     </div>
   </div>

Make each voice feel DISTINCTLY like that person or source. Do NOT be generic.`;

    user = `Problem: ${p.title}\n${p.desc ? 'Context: ' + p.desc : ''}`;

  } else {
    // ── Single source mode ──
    system = `You are channeling the wisdom of "${w.name}" (${w.type}).${w.ctx ? ' Context: ' + w.ctx : ''}
Give deep, specific guidance on the user's problem from this source's authentic perspective.
Reference real teachings, verses, principles, or known ideas from this source.
Format with HTML: <h3> for section titles, <p> for paragraphs, <blockquote> for quotes or verses, <ul><li> for lists.
Be specific and grounded in this source — not generic self-help advice.`;

    user = `Problem: ${p.title}\n${p.desc ? 'Context: ' + p.desc : ''}`;
  }

  try {
    const text = await claude(system, [{ role: 'user', content: user }]);
    if (!cache[cacheKey]) cache[cacheKey] = { qa: [] };
    cache[cacheKey].guidance = text;
    save();
    if (activePid === p.id && activeTab === 'guidance') renderDetail();
  } catch (e) {
    if (!cache[cacheKey]) cache[cacheKey] = { qa: [] };
    cache[cacheKey].guidance = '<p style="color:#e07b5a">Could not fetch guidance. Please check your connection and try again.</p>';
    save();
    if (activeTab === 'guidance') renderDetail();
  }
}

// ── FETCH ACTION PLAN ──
// Returns a JSON array of { action, ref, src } objects.
async function fetchPlan(p, w, cacheKey, isCouncil) {
  let system;

  if (isCouncil) {
    const members    = (p.sources || []).filter(s => w.memberIds.includes(s.id));
    const memberDesc = members.map(m => m.name).join(', ');
    system = `You are a composite council of: ${memberDesc}.
Create a powerful, integrated action plan for the user's problem that draws from ALL their combined wisdom.
Each step should cite the specific source/personality whose thinking inspired it.
Respond ONLY with a valid JSON array — no markdown, no preamble, no backticks:
[
  { "action": "concrete step description", "ref": "principle, quote, or verse", "src": "source name who inspired this step" },
  ...
]
Include 6–9 strong, concrete steps.`;

  } else {
    system = `You are "${w.name}" (${w.type}).${w.ctx ? ' Context: ' + w.ctx : ''}
Create a practical step-by-step action plan grounded in your real teachings and principles.
Respond ONLY with a valid JSON array — no markdown, no preamble, no backticks:
[
  { "action": "concrete step description", "ref": "relevant quote, verse, or principle from your source" },
  ...
]
Include 6–8 strong, actionable steps.`;
  }

  try {
    const text  = await claude(system, [{
      role: 'user',
      content: `Problem: ${p.title}\n${p.desc ? 'Context: ' + p.desc : ''}`,
    }]);
    const steps = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (!cache[cacheKey]) cache[cacheKey] = { qa: [] };
    cache[cacheKey].plan = steps;
    save();
    if (activePid === p.id && activeTab === 'plan') renderDetail();
  } catch (e) {
    if (!cache[cacheKey]) cache[cacheKey] = { qa: [] };
    cache[cacheKey].plan = [{ action: 'Could not generate plan. Please try again.', ref: '' }];
    save();
    if (activeTab === 'plan') renderDetail();
  }
}

// ── SEND QUESTION ──
// Appends a user message to the Q&A history, calls the API, appends the answer.
async function sendQ(p, w) {
  const input = document.getElementById('qa-in');
  const q     = input?.value?.trim();
  if (!q) return;

  const isCouncil = w.ctype === 'council';
  const cacheKey  = isCouncil ? `${p.id}_council_${w.id}` : `${p.id}_src_${w.id}`;

  if (!cache[cacheKey]) cache[cacheKey] = { qa: [] };
  cache[cacheKey].qa.push({ role: 'user', text: q });
  cache[cacheKey].qaLoading = true;

  input.value = '';
  input.disabled = true;
  document.getElementById('qa-snd').disabled = true;
  save();
  renderDetail();

  // Build system prompt
  let system;
  if (isCouncil) {
    const members = (p.sources || []).filter(s => w.memberIds.includes(s.id));
    system = `You are a composite council of: ${members.map(m => m.name).join(', ')}.
The user's problem: "${p.title}". ${p.desc || ''}
Answer from the combined perspective of all these sources/personalities.
Reference specific ideas, teachings, or principles from each member where relevant.
Use HTML formatting: <p>, <blockquote>, <strong>.`;
  } else {
    system = `You are "${w.name}" (${w.type}).${w.ctx ? ' ' + w.ctx : ''}
The user's problem: "${p.title}". ${p.desc || ''}
Answer from your authentic perspective with specific references to your teachings, ideas, or principles.
Use HTML formatting: <p>, <blockquote>.`;
  }

  // Build conversation history for multi-turn context
  const history = cache[cacheKey].qa.map(m => ({
    role:    m.role === 'user' ? 'user' : 'assistant',
    content: m.text,
  }));

  try {
    const ans = await claude(system, history);
    cache[cacheKey].qa.push({ role: 'source', text: ans });
  } catch (e) {
    cache[cacheKey].qa.push({ role: 'source', text: '<p style="color:#e07b5a">Connection error. Please try again.</p>' });
  }

  cache[cacheKey].qaLoading = false;
  save();
  renderDetail();

  // Scroll Q&A to bottom
  setTimeout(() => {
    const msgs = document.getElementById('qa-msgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }, 80);
}