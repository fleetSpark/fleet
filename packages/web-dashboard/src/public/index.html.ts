export const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>Fleet Dashboard</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0a0a;--card:#1a1a1a;--border:#2a2a2a;--text:#e5e5e5;--muted:#888;
  --pending:#6b7280;--ready:#06b6d4;--assigned:#3b82f6;--in-progress:#f59e0b;
  --completed:#22c55e;--blocked:#ef4444;--stalled:#a855f7;--failed:#ef4444;
  --merge-queued:#4ade80;--merged:#4ade80;
  --accent:#3b82f6;--radius:8px;
}
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  background:var(--bg);color:var(--text);line-height:1.5;min-height:100vh}
a{color:var(--accent);text-decoration:none}

.top-bar{display:flex;align-items:center;justify-content:space-between;
  padding:8px 16px;background:#111;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100}
.top-bar .brand{font-weight:700;font-size:1.1rem;display:flex;align-items:center;gap:6px}
.top-bar .brand span{font-size:1.3rem}
.conn-badge{display:flex;align-items:center;gap:6px;font-size:.8rem;padding:4px 10px;
  border-radius:12px;background:var(--card);border:1px solid var(--border)}
.conn-dot{width:8px;height:8px;border-radius:50%;background:var(--completed);flex-shrink:0}
.conn-dot.disconnected{background:var(--failed);animation:pulse 1.5s infinite}
.conn-dot.connecting{background:var(--in-progress);animation:pulse 1s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}

.container{max-width:1200px;margin:0 auto;padding:16px}

.header-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);
  padding:20px;margin-bottom:16px}
.header-top{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px}
.fleet-name{font-size:1.5rem;font-weight:700}
.commander-info{font-size:.85rem;color:var(--muted);margin-top:4px}
.stats-row{display:flex;gap:16px;margin-top:16px;flex-wrap:wrap}
.stat{display:flex;flex-direction:column;align-items:center;min-width:70px;
  padding:8px 12px;background:var(--bg);border-radius:var(--radius);border:1px solid var(--border)}
.stat-value{font-size:1.4rem;font-weight:700;line-height:1}
.stat-label{font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-top:4px}

.tabs{display:flex;gap:0;margin-bottom:16px;border-bottom:1px solid var(--border)}
.tab{padding:10px 20px;cursor:pointer;font-size:.9rem;font-weight:500;color:var(--muted);
  border-bottom:2px solid transparent;transition:all .2s}
.tab:hover{color:var(--text)}
.tab.active{color:var(--text);border-bottom-color:var(--accent)}

.grid{display:grid;grid-template-columns:1fr;gap:16px}
@media(min-width:768px){.grid{grid-template-columns:1fr 320px}}

.panel{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden}
.panel-title{font-size:.85rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;
  padding:12px 16px;border-bottom:1px solid var(--border);color:var(--muted)}

.mission-row{display:flex;align-items:center;gap:12px;padding:12px 16px;
  border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s}
.mission-row:last-child{border-bottom:none}
.mission-row:hover{background:#222}
.status-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.mission-info{flex:1;min-width:0}
.mission-name{font-weight:600;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mission-meta{font-size:.75rem;color:var(--muted);display:flex;gap:8px;flex-wrap:wrap}
.mission-status{font-size:.75rem;font-weight:600;padding:2px 8px;border-radius:10px;
  white-space:nowrap;text-transform:uppercase;letter-spacing:.3px}
.mission-progress{font-size:.75rem;color:var(--muted);white-space:nowrap}

.ship-card{padding:12px 16px;border-bottom:1px solid var(--border)}
.ship-card:last-child{border-bottom:none}
.ship-header{display:flex;justify-content:space-between;align-items:center}
.ship-name{font-weight:600;font-size:.85rem;display:flex;align-items:center;gap:8px}
.ship-heartbeat{font-size:.75rem;color:var(--muted)}
.ship-health{font-size:.7rem;font-weight:600;padding:2px 8px;border-radius:10px}
.health-alive{background:rgba(34,197,94,.15);color:var(--completed)}
.health-stale{background:rgba(245,158,11,.15);color:var(--in-progress)}
.health-dead{background:rgba(239,68,68,.15);color:var(--failed)}

.merge-item{padding:10px 16px;border-bottom:1px solid var(--border);font-size:.85rem}
.merge-item:last-child{border-bottom:none}
.merge-id{font-weight:600}
.merge-ci{font-size:.7rem;font-weight:600;padding:2px 6px;border-radius:8px;margin-left:8px}
.ci-passing{background:rgba(34,197,94,.15);color:var(--completed)}
.ci-pending{background:rgba(245,158,11,.15);color:var(--in-progress)}
.ci-failing{background:rgba(239,68,68,.15);color:var(--failed)}

.log-panel{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);
  padding:20px;margin-top:16px;display:none}
.log-panel.visible{display:block}
.log-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.log-title{font-size:1.1rem;font-weight:700}
.log-close{cursor:pointer;font-size:1.2rem;color:var(--muted);padding:4px 8px;border:none;
  background:none;color:var(--text)}
.log-close:hover{color:var(--failed)}
.log-section{margin-bottom:16px}
.log-section h4{font-size:.8rem;text-transform:uppercase;color:var(--muted);letter-spacing:.5px;margin-bottom:8px}
.log-brief{font-size:.9rem;color:var(--text);line-height:1.6}
.step-list{list-style:none}
.step-item{padding:4px 0;font-size:.85rem;display:flex;align-items:flex-start;gap:8px}
.step-check{color:var(--completed);flex-shrink:0;font-size:1rem}
.step-check.pending{color:var(--muted)}
.blocker-list{list-style:none}
.blocker-item{padding:4px 0;font-size:.85rem;color:var(--failed)}
.blocker-item::before{content:"\\26A0 ";margin-right:4px}

.empty{padding:32px;text-align:center;color:var(--muted);font-size:.9rem}
.updated-time{font-size:.75rem;color:var(--muted)}

@media(max-width:767px){
  .header-top{flex-direction:column}
  .stats-row{gap:8px}
  .stat{min-width:60px;padding:6px 8px}
  .stat-value{font-size:1.1rem}
  .mission-row{padding:10px 12px}
  .grid{grid-template-columns:1fr}
  .sidebar{display:none}
  .sidebar.mobile-visible{display:block}
}
</style>
</head>
<body>

<div class="top-bar">
  <div class="brand"><span>&#9889;</span> Fleet Dashboard</div>
  <div class="conn-badge">
    <div class="conn-dot" id="conn-dot"></div>
    <span id="conn-text">Connecting</span>
  </div>
</div>

<div class="container">
  <div class="header-card" id="header">
    <div class="header-top">
      <div>
        <div class="fleet-name" id="fleet-name">Fleet</div>
        <div class="commander-info" id="commander-info">Waiting for data...</div>
      </div>
      <div class="updated-time" id="updated-time"></div>
    </div>
    <div class="stats-row" id="stats-row"></div>
  </div>

  <div class="tabs" id="tab-bar">
    <div class="tab active" data-tab="board">Board</div>
    <div class="tab" data-tab="ships">Ships</div>
  </div>

  <div class="grid">
    <div id="board-view">
      <div class="panel" id="mission-panel">
        <div class="panel-title">Missions</div>
        <div id="mission-list"><div class="empty">Waiting for fleet state...</div></div>
      </div>
    </div>
    <div class="sidebar" id="sidebar">
      <div class="panel" id="ship-panel" style="margin-bottom:16px">
        <div class="panel-title">Ship Health</div>
        <div id="ship-list"><div class="empty">No ships</div></div>
      </div>
      <div class="panel" id="merge-panel">
        <div class="panel-title">Merge Queue</div>
        <div id="merge-list"><div class="empty">Queue empty</div></div>
      </div>
    </div>
  </div>

  <div class="log-panel" id="log-panel">
    <div class="log-header">
      <div class="log-title" id="log-title">Mission Log</div>
      <button class="log-close" id="log-close">&times;</button>
    </div>
    <div id="log-body"></div>
  </div>
</div>

<script>
(function(){
  const STATUS_COLORS = {
    'pending':'var(--pending)','ready':'var(--ready)','assigned':'var(--assigned)',
    'in-progress':'var(--in-progress)','completed':'var(--completed)','blocked':'var(--blocked)',
    'stalled':'var(--stalled)','failed':'var(--failed)','merge-queued':'var(--merge-queued)',
    'merged':'var(--merged)'
  };
  const STATUS_ICONS = {
    'pending':'\\u25CB','ready':'\\u25CE','assigned':'\\u25C9','in-progress':'\\u25CF',
    'completed':'\\u2713','blocked':'\\u2717','stalled':'\\u26A0','failed':'\\u2717',
    'merge-queued':'\\u2197','merged':'\\u2713'
  };

  let currentSnapshot = null;
  let eventSource = null;
  let reconnectDelay = 1000;
  let reconnectTimer = null;
  let activeTab = 'board';

  // Elements
  const connDot = document.getElementById('conn-dot');
  const connText = document.getElementById('conn-text');
  const fleetName = document.getElementById('fleet-name');
  const commanderInfo = document.getElementById('commander-info');
  const updatedTime = document.getElementById('updated-time');
  const statsRow = document.getElementById('stats-row');
  const missionList = document.getElementById('mission-list');
  const shipList = document.getElementById('ship-list');
  const mergeList = document.getElementById('merge-list');
  const logPanel = document.getElementById('log-panel');
  const logTitle = document.getElementById('log-title');
  const logBody = document.getElementById('log-body');
  const logClose = document.getElementById('log-close');
  const sidebar = document.getElementById('sidebar');
  const tabBar = document.getElementById('tab-bar');

  // Tab switching
  tabBar.addEventListener('click', function(e) {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    const target = tab.dataset.tab;
    activeTab = target;
    tabBar.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    tab.classList.add('active');
    if (target === 'board') {
      document.getElementById('board-view').style.display = '';
      sidebar.classList.remove('mobile-visible');
    } else {
      if (window.innerWidth < 768) {
        document.getElementById('board-view').style.display = 'none';
        sidebar.classList.add('mobile-visible');
      }
    }
  });

  logClose.addEventListener('click', function() {
    logPanel.classList.remove('visible');
  });

  // Time ago utility
  function timeAgo(isoString) {
    if (!isoString) return 'unknown';
    var diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 0) diff = 0;
    if (diff < 60) return diff + 's ago';
    var m = Math.floor(diff / 60);
    if (m < 60) return m + 'm ago';
    var h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    var d = Math.floor(h / 24);
    return d + 'd ago';
  }

  function setConnection(state) {
    connDot.className = 'conn-dot' + (state === 'connected' ? '' : state === 'connecting' ? ' connecting' : ' disconnected');
    connText.textContent = state === 'connected' ? 'Live' : state === 'connecting' ? 'Connecting' : 'Disconnected';
  }

  // SSE connection with exponential backoff
  function connectSSE() {
    setConnection('connecting');
    try {
      eventSource = new EventSource('/events');
    } catch(e) {
      fallbackPoll();
      return;
    }

    eventSource.onopen = function() {
      setConnection('connected');
      reconnectDelay = 1000;
    };

    eventSource.onmessage = function(e) {
      try {
        var data = JSON.parse(e.data);
        currentSnapshot = data;
        render(data);
      } catch(err) {
        console.error('Failed to parse SSE data', err);
      }
    };

    eventSource.onerror = function() {
      setConnection('disconnected');
      eventSource.close();
      eventSource = null;
      reconnectTimer = setTimeout(function() {
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
        connectSSE();
      }, reconnectDelay);
    };
  }

  // Polling fallback
  function fallbackPoll() {
    setConnection('connecting');
    fetch('/api/state').then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function(data) {
      setConnection('connected');
      currentSnapshot = data;
      render(data);
    }).catch(function() {
      setConnection('disconnected');
    });
    setTimeout(fallbackPoll, 15000);
  }

  // Main render
  function render(snap) {
    renderHeader(snap);
    renderBoard(snap);
    renderShips(snap);
    renderMergeQueue(snap);
  }

  function renderHeader(snap) {
    var m = snap.manifest;
    fleetName.textContent = '\\u26A1 Fleet';
    var cmd = m.commander;
    var statusClass = cmd.status === 'active' ? 'var(--completed)' : 'var(--failed)';
    commanderInfo.innerHTML = 'Commander: <strong>' + esc(cmd.host) + '</strong> '
      + '<span style="color:' + statusClass + '">' + esc(cmd.status) + '</span>'
      + ' \\u00B7 checked in ' + timeAgo(cmd.lastCheckin);
    updatedTime.textContent = 'Updated ' + timeAgo(m.updated);

    var t = snap.telemetry;
    var missions = t.missions;
    statsRow.innerHTML = makeStat(missions.total, 'Total')
      + makeStat(missions.pending, 'Pending', '--pending')
      + makeStat(missions.inProgress, 'Active', '--in-progress')
      + makeStat(missions.completed, 'Done', '--completed')
      + makeStat(missions.failed, 'Failed', '--failed')
      + makeStat(missions.merged, 'Merged', '--merged')
      + makeStat(t.ships.active + '/' + (t.ships.active + t.ships.idle), 'Ships')
      + makeStat(Math.round(t.ships.utilizationPct) + '%', 'Util');
  }

  function makeStat(value, label, colorVar) {
    var style = colorVar ? ' style="color:var(' + colorVar + ')"' : '';
    return '<div class="stat"><div class="stat-value"' + style + '>' + value + '</div><div class="stat-label">' + label + '</div></div>';
  }

  function renderBoard(snap) {
    var missions = snap.manifest.missions;
    if (missions.length === 0) {
      missionList.innerHTML = '<div class="empty">No active missions</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < missions.length; i++) {
      var m = missions[i];
      var color = STATUS_COLORS[m.status] || 'var(--muted)';
      var icon = STATUS_ICONS[m.status] || '?';
      var ship = m.ship || '\\u2014';
      var progress = '';
      if (snap.logs && snap.logs[m.id]) {
        var log = snap.logs[m.id];
        if (log.steps && log.steps.length > 0) {
          var done = log.steps.filter(function(s) { return s.done; }).length;
          progress = done + '/' + log.steps.length;
        }
      }
      var depends = m.depends && m.depends.length > 0 ? m.depends.join(', ') : '';

      html += '<div class="mission-row" data-id="' + esc(m.id) + '">'
        + '<div class="status-dot" style="background:' + color + '"></div>'
        + '<div class="mission-info">'
        + '<div class="mission-name">' + esc(m.id) + ' \\u2014 ' + esc(m.branch) + '</div>'
        + '<div class="mission-meta">'
        + '<span>' + icon + ' ' + esc(ship) + '</span>'
        + (m.agent ? '<span>' + esc(m.agent) + '</span>' : '')
        + (depends ? '<span>dep: ' + esc(depends) + '</span>' : '')
        + '</div></div>'
        + '<div style="display:flex;align-items:center;gap:8px">'
        + (progress ? '<div class="mission-progress">' + progress + '</div>' : '')
        + '<div class="mission-status" style="background:' + color + '22;color:' + color + '">' + esc(m.status) + '</div>'
        + '</div></div>';
    }
    missionList.innerHTML = html;

    // Click handlers
    var rows = missionList.querySelectorAll('.mission-row');
    for (var j = 0; j < rows.length; j++) {
      rows[j].addEventListener('click', function() {
        var id = this.dataset.id;
        fetchMissionLog(id);
      });
    }
  }

  function renderShips(snap) {
    var missions = snap.manifest.missions;
    var ships = {};
    for (var i = 0; i < missions.length; i++) {
      var m = missions[i];
      if (!m.ship) continue;
      if (!ships[m.ship]) {
        ships[m.ship] = { name: m.ship, status: 'idle', missions: [], heartbeat: null };
      }
      ships[m.ship].missions.push(m);
      if (m.status === 'in-progress' || m.status === 'assigned') {
        ships[m.ship].status = 'active';
      }
    }

    // Enrich with heartbeat info from logs
    for (var shipName in ships) {
      var s = ships[shipName];
      for (var j = 0; j < s.missions.length; j++) {
        var mid = s.missions[j].id;
        if (snap.logs && snap.logs[mid] && snap.logs[mid].heartbeat) {
          var hb = snap.logs[mid].heartbeat;
          s.heartbeat = hb;
          break;
        }
      }
    }

    var names = Object.keys(ships);
    if (names.length === 0) {
      shipList.innerHTML = '<div class="empty">No ships reporting</div>';
      return;
    }

    var html = '';
    for (var k = 0; k < names.length; k++) {
      var ship = ships[names[k]];
      var health = 'alive';
      var healthLabel = 'Alive';
      if (ship.heartbeat && ship.heartbeat.lastPush) {
        var age = (Date.now() - new Date(ship.heartbeat.lastPush).getTime()) / 1000;
        var interval = ship.heartbeat.pushInterval || 60;
        if (age > interval * 5) { health = 'dead'; healthLabel = 'Dead'; }
        else if (age > interval * 2) { health = 'stale'; healthLabel = 'Stale'; }
      } else {
        health = 'stale'; healthLabel = 'Unknown';
      }
      var hbText = ship.heartbeat && ship.heartbeat.lastPush ? timeAgo(ship.heartbeat.lastPush) : 'no data';
      var missionCount = ship.missions.length;

      html += '<div class="ship-card">'
        + '<div class="ship-header">'
        + '<div class="ship-name"><div class="status-dot" style="background:var(--' + (health === 'alive' ? 'completed' : health === 'stale' ? 'in-progress' : 'failed') + ')"></div>' + esc(ship.name) + '</div>'
        + '<span class="ship-health health-' + health + '">' + healthLabel + '</span>'
        + '</div>'
        + '<div class="ship-heartbeat">' + missionCount + ' mission' + (missionCount !== 1 ? 's' : '') + ' \\u00B7 heartbeat ' + hbText + '</div>'
        + '</div>';
    }
    shipList.innerHTML = html;
  }

  function renderMergeQueue(snap) {
    var queue = snap.manifest.mergeQueue;
    if (!queue || queue.length === 0) {
      mergeList.innerHTML = '<div class="empty">Queue empty</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < queue.length; i++) {
      var item = queue[i];
      var ciClass = 'ci-pending';
      var ciLabel = item.ciStatus || 'unknown';
      if (item.ciStatus === 'passing' || item.ciStatus === 'success') ciClass = 'ci-passing';
      else if (item.ciStatus === 'failing' || item.ciStatus === 'failure') ciClass = 'ci-failing';

      html += '<div class="merge-item">'
        + '<span class="merge-id">' + esc(item.missionId) + '</span>'
        + '<span class="merge-ci ' + ciClass + '">' + esc(ciLabel) + '</span>'
        + '<br><span style="color:var(--muted);font-size:.8rem">' + esc(item.branch) + (item.note ? ' \\u2014 ' + esc(item.note) : '') + '</span>'
        + '</div>';
    }
    mergeList.innerHTML = html;
  }

  function fetchMissionLog(missionId) {
    fetch('/api/mission/' + encodeURIComponent(missionId) + '/log')
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(log) {
        renderLog(missionId, log);
      })
      .catch(function(err) {
        logTitle.textContent = 'Mission ' + missionId;
        logBody.innerHTML = '<div class="empty">No log available for this mission</div>';
        logPanel.classList.add('visible');
      });
  }

  function renderLog(missionId, log) {
    logTitle.textContent = 'Mission ' + missionId + ' \\u2014 ' + log.branch;
    var html = '';

    // Status & ship
    html += '<div class="log-section"><h4>Status</h4>'
      + '<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:.9rem">'
      + '<span>Status: <strong style="color:' + (STATUS_COLORS[log.status] || 'inherit') + '">' + esc(log.status) + '</strong></span>'
      + '<span>Ship: <strong>' + esc(log.ship) + '</strong></span>'
      + '<span>Agent: <strong>' + esc(log.agent) + '</strong></span>'
      + '</div></div>';

    // Brief
    if (log.brief) {
      html += '<div class="log-section"><h4>Brief</h4><div class="log-brief">' + esc(log.brief) + '</div></div>';
    }

    // Steps
    if (log.steps && log.steps.length > 0) {
      html += '<div class="log-section"><h4>Steps</h4><ul class="step-list">';
      for (var i = 0; i < log.steps.length; i++) {
        var step = log.steps[i];
        html += '<li class="step-item"><span class="step-check ' + (step.done ? '' : 'pending') + '">'
          + (step.done ? '\\u2713' : '\\u25CB') + '</span>' + esc(step.text) + '</li>';
      }
      html += '</ul></div>';
    }

    // Blockers
    if (log.blockers && log.blockers.length > 0) {
      html += '<div class="log-section"><h4>Blockers</h4><ul class="blocker-list">';
      for (var j = 0; j < log.blockers.length; j++) {
        html += '<li class="blocker-item">' + esc(log.blockers[j]) + '</li>';
      }
      html += '</ul></div>';
    }

    // Heartbeat
    if (log.heartbeat) {
      html += '<div class="log-section"><h4>Heartbeat</h4>'
        + '<div style="font-size:.85rem;color:var(--muted)">'
        + 'Last push: ' + timeAgo(log.heartbeat.lastPush)
        + ' \\u00B7 Interval: ' + log.heartbeat.pushInterval + 's'
        + '</div></div>';
    }

    logBody.innerHTML = html;
    logPanel.classList.add('visible');
    logPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function esc(str) {
    if (str == null) return '';
    var d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  // Start connection
  if (typeof EventSource !== 'undefined') {
    connectSSE();
  } else {
    fallbackPoll();
  }

  // Update relative times every 30s
  setInterval(function() {
    if (currentSnapshot) {
      updatedTime.textContent = 'Updated ' + timeAgo(currentSnapshot.manifest.updated);
    }
  }, 30000);
})();
</script>
</body>
</html>`;
