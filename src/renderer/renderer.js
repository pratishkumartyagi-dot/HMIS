const api = window.taskAPI;

let settings = {
  clientId: '',
  clientSecret: '',
  apiRelease: '2026-01',
  apiLanguage: 'en'
};

let accessToken = null;
let tokenExpiry = null;

let currentCase = {
  id: Date.now().toString(36),
  patientId: '',
  encounterId: '',
  dischargeDate: '',
  dischargeDisposition: '',
  attendingPhysician: '',
  coder: '',
  principalDiagnosis: null,
  secondaryDiagnoses: [],
  createdAt: Date.now(),
  updatedAt: Date.now()
};

const els = {
  patientId: document.getElementById('patientId'),
  encounterId: document.getElementById('encounterId'),
  dischargeDate: document.getElementById('dischargeDate'),
  dischargeDisposition: document.getElementById('dischargeDisposition'),
  attendingPhysician: document.getElementById('attendingPhysician'),
  coder: document.getElementById('coder'),
  icdSearch: document.getElementById('icdSearch'),
  linearization: document.getElementById('linearization'),
  searchBtn: document.getElementById('searchBtn'),
  searchResults: document.getElementById('searchResults'),
  principalDiag: document.getElementById('principalDiag'),
  secondaryDiags: document.getElementById('secondaryDiags'),
  addSecondaryBtn: document.getElementById('addSecondaryBtn'),
  saveCaseBtn: document.getElementById('saveCaseBtn'),
  statusInfo: document.getElementById('statusInfo'),
  settingsBtn: document.getElementById('settingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  closeSettings: document.getElementById('closeSettings'),
  saveSettings: document.getElementById('saveSettings'),
  clientId: document.getElementById('clientId'),
  clientSecret: document.getElementById('clientSecret'),
  apiRelease: document.getElementById('apiRelease'),
  apiLanguage: document.getElementById('apiLanguage'),
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn')
};

async function loadSettings() {
  const stored = await api.loadSettings();
  if (stored) {
    settings = { ...settings, ...stored };
  }
  els.clientId.value = settings.clientId;
  els.clientSecret.value = settings.clientSecret;
  els.apiRelease.value = settings.apiRelease;
  els.apiLanguage.value = settings.apiLanguage;
}

async function saveSettingsToStorage() {
  settings.clientId = els.clientId.value;
  settings.clientSecret = els.clientSecret.value;
  settings.apiRelease = els.apiRelease.value;
  settings.apiLanguage = els.apiLanguage.value;
  await api.saveSettings(settings);
  accessToken = null;
  tokenExpiry = null;
  updateStatus('Settings saved');
  els.settingsModal.hidden = true;
}

async function authenticate() {
  if (!settings.clientId || !settings.clientSecret) {
    updateStatus('API credentials required - configure in Settings');
    return null;
  }
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }
  
  try {
    updateStatus('Authenticating...');
    const response = await fetch('https://icdaccessmanagement.who.int/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'icdapi_access',
        client_id: settings.clientId,
        client_secret: settings.clientSecret
      })
    });
    
    if (!response.ok) {
      throw new Error(`Auth failed: ${response.status}`);
    }
    
    const data = await response.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;
    updateStatus('Authenticated');
    return accessToken;
  } catch (err) {
    updateStatus(`Auth error: ${err.message}`);
    return null;
  }
}

async function searchICD11() {
  const query = els.icdSearch.value.trim();
  if (!query) return;
  
  const token = await authenticate();
  if (!token) return;
  
  updateStatus('Searching ICD-11...');
  els.searchResults.innerHTML = '';
  els.searchResults.hidden = false;
  
  try {
    const release = settings.apiRelease || '2026-01';
    const linearization = els.linearization.value;
    const url = `https://id.who.int/icd/release/11/${release}/${linearization}/search?q=${encodeURIComponent(query)}&useFlexisearch=false&flatResults=true`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Accept-Language': settings.apiLanguage || 'en',
        'API-Version': 'v2'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }
    
    const data = await response.json();
    const results = data.destinationEntities || [];
    
    if (results.length === 0) {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = '<span class="search-result-title">No results found</span>';
      els.searchResults.appendChild(item);
    } else {
      for (const result of results.slice(0, 20)) {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
          <span class="search-result-code">${result.theCode || result.code || ''}</span>
          <span class="search-result-title">${result.title || result.stemId || ''}</span>
        `;
        item.addEventListener('click', () => {
          selectDiagnosis(result);
          els.searchResults.hidden = true;
          els.icdSearch.value = '';
        });
        els.searchResults.appendChild(item);
      }
    }
    updateStatus(`Found ${results.length} result(s)`);
  } catch (err) {
    updateStatus(`Search error: ${err.message}`);
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.innerHTML = `<span class="search-result-title">Error: ${err.message}</span>`;
    els.searchResults.appendChild(item);
  }
}

let pendingDiagnosisType = 'principal'; // or 'secondary'

function selectDiagnosis(result) {
  const diagnosis = {
    id: Date.now().toString(36),
    code: result.theCode || result.code || '',
    title: result.title || '',
    uri: result.id || result.stemId || '',
    linearization: els.linearization.value
  };
  
  if (pendingDiagnosisType === 'principal') {
    currentCase.principalDiagnosis = diagnosis;
    renderPrincipalDiagnosis();
  } else {
    currentCase.secondaryDiagnoses.push(diagnosis);
    renderSecondaryDiagnoses();
  }
}

function renderPrincipalDiagnosis() {
  els.principalDiag.innerHTML = '';
  if (!currentCase.principalDiagnosis) {
    const placeholder = document.createElement('div');
    placeholder.className = 'diagnosis-placeholder';
    placeholder.textContent = 'No principal diagnosis assigned';
    els.principalDiag.appendChild(placeholder);
    return;
  }
  
  const diag = currentCase.principalDiagnosis;
  const item = document.createElement('div');
  item.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <span class="diagnosis-code">${diag.code}</span>
        <span class="diagnosis-title">${diag.title}</span>
      </div>
      <button class="ghost" type="button" id="removePrincipal">Remove</button>
    </div>
  `;
  els.principalDiag.appendChild(item);
  document.getElementById('removePrincipal').addEventListener('click', (e) => {
    e.stopPropagation();
    currentCase.principalDiagnosis = null;
    renderPrincipalDiagnosis();
  });

}

function renderSecondaryDiagnoses() {
  els.secondaryDiags.innerHTML = '';
  for (let i = 0; i < currentCase.secondaryDiagnoses.length; i++) {
    const diag = currentCase.secondaryDiagnoses[i];
    const item = document.createElement('div');
    item.className = 'diagnosis-item';
    item.innerHTML = `
      <div class="diagnosis-info">
        <span class="diagnosis-code">${diag.code}</span>
        <span class="diagnosis-title">${diag.title}</span>
      </div>
      <div class="diagnosis-actions">
        <button class="ghost" type="button" data-idx="${i}" data-action="remove">Remove</button>
      </div>
    `;
    els.secondaryDiags.appendChild(item);
  }
  
  els.secondaryDiags.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const action = btn.dataset.action;
      if (action === 'remove') {
        currentCase.secondaryDiagnoses.splice(idx, 1);
        renderSecondaryDiagnoses();
      }
    });
  });
}

function updateStatus(msg) {
  els.statusInfo.textContent = msg;
}

els.searchBtn.addEventListener('click', searchICD11);
els.icdSearch.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    searchICD11();
  }
});

els.addSecondaryBtn.addEventListener('click', () => {
  pendingDiagnosisType = 'secondary';
  els.icdSearch.focus();
  updateStatus('Search and select to add secondary diagnosis');
});

els.principalDiag.addEventListener('click', (e) => {
  if (e.target.id === 'removePrincipal') return;
  pendingDiagnosisType = 'principal';
  els.icdSearch.focus();
  updateStatus('Search and select to set principal diagnosis');
});

els.saveCaseBtn.addEventListener('click', async () => {
  currentCase.patientId = els.patientId.value;
  currentCase.encounterId = els.encounterId.value;
  currentCase.dischargeDate = els.dischargeDate.value;
  currentCase.dischargeDisposition = els.dischargeDisposition.value;
  currentCase.attendingPhysician = els.attendingPhysician.value;
  currentCase.coder = els.coder.value;
  currentCase.updatedAt = Date.now();
  
  if (!currentCase.patientId && !currentCase.encounterId) {
    if (!confirm('No patient/encounter ID provided. Save anyway?')) return;
  }
  if (!currentCase.principalDiagnosis) {
    if (!confirm('No principal diagnosis assigned. Save anyway?')) return;
  }
  
  const stored = await api.load();
  const cases = Array.isArray(stored) ? stored : [];
  const idx = cases.findIndex(c => c.id === currentCase.id);
  if (idx >= 0) {
    cases[idx] = currentCase;
  } else {
    cases.push(currentCase);
  }
  
  const res = await api.save(cases);
  if (res && res.ok) {
    updateStatus('Case saved');
    alert('Discharge case saved successfully');
  } else {
    updateStatus('Save failed');
    alert('Save failed: ' + (res?.error || 'Unknown error'));
  }
});

els.settingsBtn.addEventListener('click', () => {
  els.settingsModal.hidden = false;
});

els.closeSettings.addEventListener('click', () => {
  els.settingsModal.hidden = true;
});

els.saveSettings.addEventListener('click', saveSettingsToStorage);

els.exportBtn.addEventListener('click', async () => {
  const stored = await api.load();
  const res = await api.exportCases(stored || []);
  if (res && res.ok) alert('Exported to:\n' + res.filePath);
  else if (res && res.error) alert('Export failed: ' + res.error);
});

els.importBtn.addEventListener('click', async () => {
  const res = await api.importCases();
  if (!res || !res.ok) {
    if (res && res.error) alert('Import failed: ' + res.error);
    return;
  }
  alert(`Imported ${res.cases.length} case(s).`);
});

async function init() {
  await loadSettings();
  renderPrincipalDiagnosis();
  renderSecondaryDiagnoses();
  updateStatus('Ready - Configure API settings to search ICD-11');
}

init();
