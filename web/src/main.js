// ==========================================================================
// DepPulse Web App — Interactive Controls & Terminal Simulator
// ==========================================================================

// --- 1. Quickstart Package Manager Switcher ---
const installCommands = {
  npx: 'npx deppulse scan .',
  npm: 'npm install -D deppulse\nnpx deppulse scan .',
  pnpm: 'pnpm add -D deppulse\npnpm deppulse scan .',
  yarn: 'yarn add -D deppulse\nyarn deppulse scan .',
  global: 'npm install -g deppulse\ndeppulse scan .',
};

const installTabs = document.querySelectorAll('.install-tab');
const installCode = document.getElementById('install-command-text');

installTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    installTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const pkg = tab.getAttribute('data-pkg');
    if (pkg && installCommands[pkg]) {
      installCode.textContent = installCommands[pkg];
    }
  });
});

// --- 2. Copy to Clipboard Utility with Toast ---
const toast = document.getElementById('toast');

function showToast(message = 'Copied to clipboard!') {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

function setupCopyButton(btnId, getText) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const text = typeof getText === 'function' ? getText() : getText;
    try {
      await navigator.clipboard.writeText(text);
      showToast();
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast();
    }
  });
}

setupCopyButton('btn-copy-quick', () => document.getElementById('quick-run-cmd')?.textContent || 'npx deppulse scan .');
setupCopyButton('btn-copy-install', () => installCode?.textContent || 'npx deppulse scan .');

// --- 3. Interactive Terminal Simulator ---
const terminalOutputs = {
  'scan-terminal': `
<div class="term-line"><span class="term-prompt">$</span><span class="term-cmd">deppulse scan .</span></div>
<div class="term-line term-dim">Scanning dependencies in package.json & package-lock.json...</div>
<div class="term-line">&nbsp;</div>
<div class="term-line term-head">DepPulse v0.1.0 – Dependency Health & Maintenance Intelligence</div>
<div class="term-line term-dim">──────────────────────────────────────────────────────────────────────</div>
<div class="term-line">Manifest: <span class="term-cyan">package.json</span> (npm-v3, coverage: <span class="term-low">full</span>)</div>
<div class="term-line">Scanned: <span class="term-head">228 dependencies</span> (14 direct, 214 transitive, 0 skipped)</div>
<div class="term-line">&nbsp;</div>
<div class="term-line">Health Overview: <span class="term-critical">Critical: 2</span> | <span class="term-high">High: 1</span> | <span class="term-medium">Medium: 7</span> | <span class="term-low">Low (Healthy): 208</span> | <span class="term-dim">Unknown: 10</span></div>
<div class="term-line">Average Health Score: <span class="term-low">97/100</span></div>
<div class="term-line term-dim">──────────────────────────────────────────────────────────────────────</div>
<div class="term-line">&nbsp;</div>
<div class="term-line term-head">Actionable Maintenance Alerts:</div>
<div class="term-line">&nbsp;</div>
<div class="term-line"><span class="term-critical">CRITICAL</span> <span class="term-cmd">eslint@9.39.5</span> <span class="term-dim">[direct]</span> Score: <span class="term-critical">20</span></div>
<div class="term-line term-critical">&nbsp;&nbsp;✖ Package is deprecated: This version is no longer supported. Please see https://eslint.org/version-support for options.</div>
<div class="term-line">&nbsp;</div>
<div class="term-line"><span class="term-critical">CRITICAL</span> <span class="term-cmd">eslint-visitor-keys@3.4.3</span> <span class="term-dim">[transitive]</span> Score: <span class="term-critical">25</span></div>
<div class="term-line term-yellow">&nbsp;&nbsp;⚠ Last release was 1163 days ago. As a mature-stable package, core functionality remains established. (-5)</div>
<div class="term-line term-critical">&nbsp;&nbsp;✖ Upstream GitHub repository eslint/eslint-visitor-keys has been archived by maintainers. (Fatal Cap: 25)</div>
<div class="term-line">&nbsp;</div>
<div class="term-line"><span class="term-high">HIGH</span> <span class="term-cmd">@napi-rs/lzma-linux-x64-gnu@1.5.1</span> <span class="term-dim">[transitive]</span> Score: <span class="term-high">40</span></div>
<div class="term-line term-high">&nbsp;&nbsp;✖ Declared engines.node '^22.20 || ^24.12 || &gt;=25' is incompatible with all current Node.js LTS runtimes.</div>
<div class="term-line">&nbsp;</div>
<div class="term-line"><span class="term-medium">MEDIUM</span> <span class="term-cmd">concat-map@0.0.1</span> <span class="term-dim">[transitive]</span> Score: <span class="term-medium">75</span></div>
<div class="term-line term-yellow">&nbsp;&nbsp;⚠ Stagnant release cadence: no published releases in 4643 days (&gt;2 years). (-25)</div>
<div class="term-line">&nbsp;</div>
<div class="term-line term-dim">──────────────────────────────────────────────────────────────────────</div>
<div class="term-line term-danger-bold">✖ POLICY FAILED: Found 3 policy violation(s):</div>
<div class="term-line term-critical">&nbsp;&nbsp;• eslint-visitor-keys@3.4.3 carries critical maintenance risk (score: 25). (Rule: failOnRisk contains 'critical')</div>
<div class="term-line term-critical">&nbsp;&nbsp;• eslint@9.39.5 carries critical maintenance risk (score: 20). (Rule: failOnRisk contains 'critical')</div>
<div class="term-line term-high">&nbsp;&nbsp;• Project contains 1 high risk dependencies, exceeding allowed limit of 0. (Rule: maxHighRiskAllowed (0))</div>
<div class="term-line">&nbsp;</div>
<div class="term-line term-dim">Process completed with exit code 1.</div>
`,

  'scan-markdown': `
<div class="term-line"><span class="term-prompt">$</span><span class="term-cmd">deppulse scan . --format markdown</span></div>
<div class="term-line">&nbsp;</div>
<div class="term-line term-cyan">## 🛡️ DepPulse Dependency Health Report</div>
<div class="term-line">&nbsp;</div>
<div class="term-line">| Metric | Value |</div>
<div class="term-line">| :--- | :--- |</div>
<div class="term-line">| **Scanned Dependencies** | 228 (14 direct, 214 transitive) |</div>
<div class="term-line">| **Average Score** | **97 / 100** |</div>
<div class="term-line">| **Critical Risk** | 2 |</div>
<div class="term-line">| **High Risk** | 1 |</div>
<div class="term-line">| **Status** | ❌ **Policy Breached** |</div>
<div class="term-line">&nbsp;</div>
<div class="term-line term-cyan">### ⚠️ Flagged Dependencies</div>
<div class="term-line">&nbsp;</div>
<div class="term-line">- 🔴 **eslint@9.39.5** (Score: 20) — *Deprecated: version is no longer supported.*</div>
<div class="term-line">- 🔴 **eslint-visitor-keys@3.4.3** (Score: 25) — *Upstream GitHub repo eslint/eslint-visitor-keys archived.*</div>
<div class="term-line">- 🟠 **@napi-rs/lzma-linux-x64-gnu@1.5.1** (Score: 40) — *Node LTS engine incompatibility.*</div>
<div class="term-line">&nbsp;</div>
<div class="term-line term-dim">&gt; Generated automatically by DepPulse in GitHub Actions.</div>
`,

  'scan-json': `
<div class="term-line"><span class="term-prompt">$</span><span class="term-cmd">deppulse scan . --format json</span></div>
<div class="term-line">{</div>
<div class="term-line">&nbsp;&nbsp;<span class="term-cyan">"schemaVersion"</span>: <span class="term-yellow">"1.0.0"</span>,</div>
<div class="term-line">&nbsp;&nbsp;<span class="term-cyan">"manifestPath"</span>: <span class="term-yellow">"./package.json"</span>,</div>
<div class="term-line">&nbsp;&nbsp;<span class="term-cyan">"coverage"</span>: <span class="term-yellow">"full"</span>,</div>
<div class="term-line">&nbsp;&nbsp;<span class="term-cyan">"scannedDependenciesCount"</span>: <span class="term-yellow">228</span>,</div>
<div class="term-line">&nbsp;&nbsp;<span class="term-cyan">"summary"</span>: {</div>
<div class="term-line">&nbsp;&nbsp;&nbsp;&nbsp;<span class="term-cyan">"lowRisk"</span>: <span class="term-yellow">208</span>,</div>
<div class="term-line">&nbsp;&nbsp;&nbsp;&nbsp;<span class="term-cyan">"mediumRisk"</span>: <span class="term-yellow">7</span>,</div>
<div class="term-line">&nbsp;&nbsp;&nbsp;&nbsp;<span class="term-cyan">"highRisk"</span>: <span class="term-yellow">1</span>,</div>
<div class="term-line">&nbsp;&nbsp;&nbsp;&nbsp;<span class="term-cyan">"criticalRisk"</span>: <span class="term-yellow">2</span>,</div>
<div class="term-line">&nbsp;&nbsp;&nbsp;&nbsp;<span class="term-cyan">"averageScore"</span>: <span class="term-yellow">97</span></div>
<div class="term-line">&nbsp;&nbsp;},</div>
<div class="term-line">&nbsp;&nbsp;<span class="term-cyan">"policyResult"</span>: {</div>
<div class="term-line">&nbsp;&nbsp;&nbsp;&nbsp;<span class="term-cyan">"isPassed"</span>: <span class="term-critical">false</span>,</div>
<div class="term-line">&nbsp;&nbsp;&nbsp;&nbsp;<span class="term-cyan">"violations"</span>: [</div>
<div class="term-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{ <span class="term-cyan">"dependencyId"</span>: <span class="term-yellow">"eslint@9.39.5"</span>, <span class="term-cyan">"risk"</span>: <span class="term-critical">"critical"</span> },</div>
<div class="term-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{ <span class="term-cyan">"dependencyId"</span>: <span class="term-yellow">"eslint-visitor-keys@3.4.3"</span>, <span class="term-cyan">"risk"</span>: <span class="term-critical">"critical"</span> }</div>
<div class="term-line">&nbsp;&nbsp;&nbsp;&nbsp;]</div>
<div class="term-line">&nbsp;&nbsp;}</div>
<div class="term-line">}</div>
`,

  'explain-wrappy': `
<div class="term-line"><span class="term-prompt">$</span><span class="term-cmd">deppulse explain wrappy</span></div>
<div class="term-line">&nbsp;</div>
<div class="term-line term-head">Scoring Breakdown: wrappy@1.0.2</div>
<div class="term-line">Calculated Score: <span class="term-low">100 / 100</span> (Risk: <span class="term-low">LOW</span>)</div>
<div class="term-line">Lifecycle Classification: <span class="term-cyan">Mature-Stable Single Purpose Utility</span></div>
<div class="term-line term-dim">──────────────────────────────────────────────────────────────────────</div>
<div class="term-line term-head">Evidence Trace:</div>
<div class="term-line">&nbsp;&nbsp;• <span class="term-low">[+10]</span> Initial release &gt;4 years ago (published in 2014) with 10+ stable releases.</div>
<div class="term-line">&nbsp;&nbsp;• <span class="term-cyan">[  0]</span> <span class="term-head">Mature-Stable Waiver Applied</span>: Inactivity over 36 months incurs 0 penalty.</div>
<div class="term-line">&nbsp;&nbsp;• <span class="term-low">[ +5]</span> Verified npm provenance signature and active GitHub repository.</div>
<div class="term-line">&nbsp;&nbsp;• <span class="term-low">[ +5]</span> Full compatibility with current active Node.js LTS runtimes.</div>
<div class="term-line">&nbsp;</div>
<div class="term-line term-pass-bold">Conclusion: Package is finished, stable, and safe for enterprise production.</div>
`,

  'compare-pkgs': `
<div class="term-line"><span class="term-prompt">$</span><span class="term-cmd">deppulse compare axios got</span></div>
<div class="term-line">&nbsp;</div>
<div class="term-line term-head">Comparative Maintenance Health: axios vs got</div>
<div class="term-line term-dim">──────────────────────────────────────────────────────────────────────</div>
<div class="term-line">Metric&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| axios&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| got</div>
<div class="term-line">────────────────────────┼────────────────────────┼───────────────────────</div>
<div class="term-line">Health Score&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| <span class="term-low">95 / 100 (Low)</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| <span class="term-low">92 / 100 (Low)</span></div>
<div class="term-line">Days Since Release&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| <span class="term-cyan">18 days ago</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| <span class="term-cyan">45 days ago</span></div>
<div class="term-line">Node LTS Compatibility&nbsp;&nbsp;| <span class="term-low">Node 18, 20, 22</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| <span class="term-low">Node 18, 20, 22</span></div>
<div class="term-line">Upstream Repo Status&nbsp;&nbsp;&nbsp;&nbsp;| <span class="term-low">Active (105k stars)</span>&nbsp;&nbsp;&nbsp;&nbsp;| <span class="term-low">Active (14k stars)</span></div>
<div class="term-line">npm Provenance&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| <span class="term-low">Verified Attestation</span>&nbsp;&nbsp;&nbsp;| <span class="term-low">Verified Attestation</span></div>
<div class="term-line">Deprecation Flag&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| <span class="term-low">No</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;| <span class="term-low">No</span></div>
<div class="term-line">&nbsp;</div>
<div class="term-line term-dim">Recommendation: Both libraries demonstrate robust maintenance health.</div>
`,

  'analyze-dep': `
<div class="term-line"><span class="term-prompt">$</span><span class="term-cmd">deppulse analyze request@2.88.2</span></div>
<div class="term-line">&nbsp;</div>
<div class="term-line term-head">Deep Telemetry Inspection: request@2.88.2</div>
<div class="term-line">Maintenance Health Score: <span class="term-critical">0 / 100</span> (Risk: <span class="term-critical">CRITICAL</span>)</div>
<div class="term-line">Telemetry Confidence: <span class="term-yellow">0.70</span> (Verified upstream telemetry)</div>
<div class="term-line term-dim">──────────────────────────────────────────────────────────────────────</div>
<div class="term-line term-head">Observed Telemetry Facts:</div>
<div class="term-line term-critical">&nbsp;&nbsp;✖ [FATAL CAP: 20] Package officially deprecated: "request has been deprecated, see https://github.com/request/request/issues/3142"</div>
<div class="term-line term-yellow">&nbsp;&nbsp;⚠ Stagnant release cadence: 0 releases in 2480 days (&gt;6 years).</div>
<div class="term-line term-critical">&nbsp;&nbsp;✖ Upstream repository github.com/request/request is archived and read-only.</div>
<div class="term-line">&nbsp;</div>
<div class="term-line term-danger-bold">Recommendation: Immediately replace with native fetch, undici, or axios.</div>
`,
};

const terminalScreen = document.getElementById('terminal-output-area');
const cmdButtons = document.querySelectorAll('.cmd-btn');

function renderTerminal(cmdKey) {
  if (!terminalScreen || !terminalOutputs[cmdKey]) return;
  terminalScreen.innerHTML = terminalOutputs[cmdKey];
}

cmdButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    cmdButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cmd = btn.getAttribute('data-cmd');
    if (cmd) renderTerminal(cmd);
  });
});

// Initial terminal render
renderTerminal('scan-terminal');

// --- 4. Interactive Health & Risk Scoring Calculator ---
const paramAge = document.getElementById('param-age');
const paramReleases = document.getElementById('param-releases');
const paramRecency = document.getElementById('param-recency');

const valAge = document.getElementById('val-age');
const valReleases = document.getElementById('val-releases');
const valRecency = document.getElementById('val-recency');

const toggleDeprecated = document.getElementById('toggle-deprecated');
const toggleArchived = document.getElementById('toggle-archived');
const toggleEngines = document.getElementById('toggle-engines');
const toggleRepoVerified = document.getElementById('toggle-repo-verified');
const toggleCve = document.getElementById('toggle-cve');

const calcScoreVal = document.getElementById('calc-score-val');
const calcRiskBadge = document.getElementById('calc-risk-badge');
const calcMaturePill = document.getElementById('calc-mature-pill');
const calcEvidenceList = document.getElementById('calc-evidence-list');
const calcScoreCircle = document.getElementById('calc-score-circle');

function updateCalculator() {
  const ageYears = Number(paramAge?.value || 5);
  const totalReleases = Number(paramReleases?.value || 15);
  const recencyDays = Number(paramRecency?.value || 600);

  if (valAge) valAge.textContent = `${ageYears} ${ageYears === 1 ? 'year' : 'years'}`;
  if (valReleases) valReleases.textContent = `${totalReleases} releases`;
  if (valRecency) valRecency.textContent = `${recencyDays} days`;

  const isDeprecated = Boolean(toggleDeprecated?.checked);
  const isArchived = Boolean(toggleArchived?.checked);
  const isEnginesCompatible = Boolean(toggleEngines?.checked);
  const isRepoVerified = Boolean(toggleRepoVerified?.checked);
  const hasCve = Boolean(toggleCve?.checked);

  // 1. Mature-Stable Determination
  const isMatureStable = ageYears >= 4 && totalReleases >= 6 && isEnginesCompatible && !isDeprecated && !isArchived;

  // 2. Base Score Calculation
  let rawScore = 100;
  const evidence = [];

  // Recency Signal
  if (isMatureStable) {
    if (recencyDays > 1095) {
      rawScore -= 5;
      evidence.push({
        text: `Last release was ${recencyDays} days ago. As a mature-stable package, mild warning only.`,
        pts: '-5 pts',
        type: 'pts-penalty',
      });
    } else {
      evidence.push({
        text: `Mature-Stable Waiver Applied: Inactivity over ${recencyDays} days incurs 0 penalty.`,
        pts: '0 pts',
        type: 'pts-bonus',
      });
    }
  } else {
    if (recencyDays <= 180) {
      rawScore += 10;
      evidence.push({ text: `Active release cadence: last published ${recencyDays} days ago.`, pts: '+10 pts', type: 'pts-bonus' });
    } else if (recencyDays <= 365) {
      evidence.push({ text: `Moderate release cadence: published ${recencyDays} days ago.`, pts: '0 pts', type: 'pts-neutral' });
    } else if (recencyDays <= 730) {
      rawScore -= 15;
      evidence.push({ text: `Slow maintenance: no releases in ${recencyDays} days (>1 year).`, pts: '-15 pts', type: 'pts-penalty' });
    } else {
      rawScore -= 25;
      evidence.push({ text: `Stagnant cadence: no releases in ${recencyDays} days (>2 years).`, pts: '-25 pts', type: 'pts-penalty' });
    }
  }

  // Engines LTS Compatibility
  if (!isEnginesCompatible) {
    rawScore -= 25;
    evidence.push({ text: 'Incompatible with all active Node.js LTS runtimes.', pts: '-25 pts', type: 'pts-penalty' });
  } else {
    evidence.push({ text: 'Engine declaration verified compatible with Node.js LTS.', pts: '+5 pts', type: 'pts-bonus' });
  }

  // Upstream Repo Verification
  if (!isRepoVerified) {
    rawScore -= 20;
    evidence.push({ text: 'Upstream repository link is missing or unverified.', pts: '-20 pts', type: 'pts-penalty' });
  } else if (!isArchived) {
    rawScore += 5;
    evidence.push({ text: 'Verified GitHub repository with active community.', pts: '+5 pts', type: 'pts-bonus' });
  }

  // CVE Context (Strictly 0 score contribution)
  if (hasCve) {
    evidence.push({
      text: 'Security advisory context: 2 known CVEs recorded (0 score deduction, tracked separately).',
      pts: '0 pts',
      type: 'pts-neutral',
    });
  }

  // 3. Fatal Caps
  let finalScore = rawScore;
  if (!isEnginesCompatible) {
    finalScore = Math.min(finalScore, 40);
    evidence.push({ text: 'Fatal Cap Triggered: Incompatible engines capped at max 40.', pts: 'Cap 40', type: 'pts-cap' });
  }
  if (!isRepoVerified) {
    finalScore = Math.min(finalScore, 30);
    evidence.push({ text: 'Fatal Cap Triggered: Unverified repo capped at max 30.', pts: 'Cap 30', type: 'pts-cap' });
  }
  if (isArchived) {
    finalScore = Math.min(finalScore, 25);
    evidence.push({ text: 'Fatal Cap Triggered: Upstream repository archived by author.', pts: 'Cap 25', type: 'pts-cap' });
  }
  if (isDeprecated) {
    finalScore = Math.min(finalScore, 20);
    evidence.push({ text: 'Fatal Cap Triggered: Package officially marked deprecated.', pts: 'Cap 20', type: 'pts-cap' });
  }

  finalScore = Math.max(0, Math.min(100, Math.round(finalScore)));

  // 4. Risk Level
  let riskClass = 'badge-low';
  let riskText = 'Low Maintenance Risk';
  let circleColor = '#10b981';

  if (finalScore <= 25) {
    riskClass = 'badge-critical';
    riskText = 'Critical Maintenance Risk';
    circleColor = '#ef4444';
  } else if (finalScore < 50) {
    riskClass = 'badge-high';
    riskText = 'High Maintenance Risk';
    circleColor = '#f97316';
  } else if (finalScore < 80) {
    riskClass = 'badge-medium';
    riskText = 'Medium Maintenance Risk';
    circleColor = '#eab308';
  }

  if (calcScoreVal) calcScoreVal.textContent = String(finalScore);
  if (calcScoreCircle) calcScoreCircle.style.borderColor = circleColor;
  if (calcRiskBadge) {
    calcRiskBadge.className = `risk-badge ${riskClass}`;
    calcRiskBadge.textContent = riskText;
  }

  if (calcMaturePill) {
    calcMaturePill.style.display = isMatureStable ? 'block' : 'none';
  }

  if (calcEvidenceList) {
    calcEvidenceList.innerHTML = evidence
      .map(
        e => `
      <li class="evidence-item">
        <span class="evidence-text">${e.text}</span>
        <span class="evidence-pts ${e.type}">${e.pts}</span>
      </li>
    `,
      )
      .join('');
  }
}

[paramAge, paramReleases, paramRecency].forEach(slider => {
  slider?.addEventListener('input', updateCalculator);
});

[toggleDeprecated, toggleArchived, toggleEngines, toggleRepoVerified, toggleCve].forEach(toggle => {
  toggle?.addEventListener('change', updateCalculator);
});

updateCalculator();

// --- 5. Interactive Config Generator ---
const cfgFailRisk = document.getElementById('cfg-fail-risk');
const cfgMaxHigh = document.getElementById('cfg-max-high');
const cfgCacheTtl = document.getElementById('cfg-cache-ttl');
const cfgAllowName = document.getElementById('cfg-allow-name');
const cfgAllowReason = document.getElementById('cfg-allow-reason');
const btnAddAllow = document.getElementById('btn-add-allow');
const configJsonOutput = document.getElementById('config-json-output');

const customAllowList = [
  { package: 'legacy-crypto@^1.2.0', reason: 'Upgrading to v2 in upcoming Q4 sprint' },
];

function updateConfigJson() {
  const failRiskValues = (cfgFailRisk?.value || 'critical,high').split(',');
  const maxHigh = Number(cfgMaxHigh?.value || 0);
  const ttl = Number(cfgCacheTtl?.value || 24);

  const configObj = {
    $schema: 'https://raw.githubusercontent.com/arnnnnaaavvvvv/DepPlus/main/docs/config.schema.json',
    version: '1.0.0',
    policy: {
      failOnRisk: failRiskValues,
      maxHighRiskAllowed: maxHigh,
      allowList: customAllowList,
    },
    cache: {
      enabled: true,
      ttlHours: ttl,
    },
    network: {
      timeoutMs: 10000,
      maxRetries: 3,
    },
  };

  if (configJsonOutput) {
    configJsonOutput.textContent = JSON.stringify(configObj, null, 2);
  }
}

btnAddAllow?.addEventListener('click', () => {
  const name = cfgAllowName?.value?.trim();
  const reason = cfgAllowReason?.value?.trim() || 'Temporary exemption';
  if (name) {
    customAllowList.push({ package: name, reason });
    if (cfgAllowName) cfgAllowName.value = '';
    if (cfgAllowReason) cfgAllowReason.value = '';
    updateConfigJson();
    showToast(`Added ${name} to exemption list`);
  }
});

[cfgFailRisk, cfgMaxHigh, cfgCacheTtl].forEach(el => {
  el?.addEventListener('input', updateConfigJson);
  el?.addEventListener('change', updateConfigJson);
});

setupCopyButton('btn-copy-config', () => configJsonOutput?.textContent || '');
updateConfigJson();
