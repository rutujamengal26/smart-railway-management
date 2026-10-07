const stations = ['Mumbai CSMT', 'Dadar', 'Thane', 'Kalyan Jn', 'Kasara', 'Igatpuri', 'Karjat', 'Lonavala', 'Pune Jn'];
const connections = [
  ['Mumbai CSMT', 'Dadar', 10], ['Dadar', 'Thane', 22], ['Thane', 'Kalyan Jn', 20],
  ['Kalyan Jn', 'Kasara', 95], ['Kasara', 'Igatpuri', 35], ['Kalyan Jn', 'Karjat', 55],
  ['Karjat', 'Lonavala', 40], ['Lonavala', 'Pune Jn', 60]
];
const stationCoordinates = {
  'Mumbai CSMT': [55, 185], Dadar: [166, 126], Thane: [274, 158], 'Kalyan Jn': [384, 101],
  Kasara: [500, 157], Igatpuri: [625, 193], Karjat: [384, 205], Lonavala: [516, 48], 'Pune Jn': [648, 38]
};
const stationMapLabels = {
  'Mumbai CSMT': 'Mumbai CSMT', Dadar: 'Dadar', Thane: 'Thane', 'Kalyan Jn': 'Kalyan Jn',
  Kasara: 'Kasara', Igatpuri: 'Igatpuri', Karjat: 'Karjat', Lonavala: 'Lonavala', 'Pune Jn': 'Pune Jn'
};
const initialTrains = [
  { id: '12123', route: 'DECCAN QUEEN', origin: 'Mumbai CSMT', destination: 'Pune Jn', departure: '17:10', eta: '20:25', status: 'On time', delay: 0 },
  { id: '12124', route: 'DECCAN QUEEN', origin: 'Pune Jn', destination: 'Mumbai CSMT', departure: '07:15', eta: '10:25', status: 'On time', delay: 0 },
  { id: '11007', route: 'DECCAN EXPRESS', origin: 'Mumbai CSMT', destination: 'Pune Jn', departure: '07:00', eta: '10:25', status: 'Boarding', delay: 0 },
  { id: '11008', route: 'DECCAN EXPRESS', origin: 'Pune Jn', destination: 'Mumbai CSMT', departure: '15:00', eta: '18:25', status: 'Delayed', delay: 6 },
  { id: '11009', route: 'SINHAGAD EXPRESS', origin: 'Mumbai CSMT', destination: 'Pune Jn', departure: '06:00', eta: '09:25', status: 'On time', delay: 0 },
  { id: '11010', route: 'SINHAGAD EXPRESS', origin: 'Pune Jn', destination: 'Mumbai CSMT', departure: '14:00', eta: '17:25', status: 'On time', delay: 0 }
];
const initialIncidents = [
  { id: 1, title: 'Signal check near Thane', location: 'Thane', team: 'Signal engineering', priority: 3, createdAt: Date.now() - 600000 },
  { id: 2, title: 'Track inspection at Kasara', location: 'Kasara', team: 'Track maintenance', priority: 2, createdAt: Date.now() - 1200000 },
  { id: 3, title: 'Platform service at Dadar', location: 'Dadar', team: 'Station operations', priority: 1, createdAt: Date.now() - 2100000 }
];
const initialMaintenance = [
  { id: 1, description: 'Inspect switch points · Kalyan Jn', time: '08:24' },
  { id: 2, description: 'Replace platform light · Dadar', time: '08:31' },
  { id: 3, description: 'Routine signal test · Lonavala', time: '08:39' }
];
const initialTickets = [];
let trains = readCollection('trackline.india.trains', initialTrains);
let incidents = readCollection('trackline.india.incidents', initialIncidents);
let maintenance = readCollection('trackline.india.maintenance', initialMaintenance);
let tickets = readCollection('trackline.india.tickets', initialTickets);
let nextIncidentId = Math.max(0, ...incidents.map((incident) => incident.id)) + 1;
let nextMaintenanceId = Math.max(0, ...maintenance.map((job) => job.id)) + 1;
let selectedTrainId = trains[0]?.id ?? null;
const mapSimulationStartedAt = Date.now();
let toastTimeout;

function readCollection(key, fallback) {
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    return Array.isArray(stored) ? stored : JSON.parse(JSON.stringify(fallback));
  } catch {
    return JSON.parse(JSON.stringify(fallback));
  }
}
function persistData() {
  try {
    localStorage.setItem('trackline.india.trains', JSON.stringify(trains));
    localStorage.setItem('trackline.india.incidents', JSON.stringify(incidents));
    localStorage.setItem('trackline.india.maintenance', JSON.stringify(maintenance));
    localStorage.setItem('trackline.india.tickets', JSON.stringify(tickets));
  } catch {
    showToast('Browser storage is unavailable; changes will not persist after closing this page.');
  }
}

class BinaryHeap {
  constructor(compare) {
    this.items = [];
    this.compare = compare;
  }
  get size() { return this.items.length; }
  peek() { return this.items[0] ?? null; }
  push(value) {
    this.items.push(value);
    this.bubbleUp(this.items.length - 1);
  }
  pop() {
    if (!this.items.length) return null;
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length) {
      this.items[0] = last;
      this.sinkDown(0);
    }
    return first;
  }
  bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.items[index], this.items[parent]) >= 0) break;
      [this.items[index], this.items[parent]] = [this.items[parent], this.items[index]];
      index = parent;
    }
  }
  sinkDown(index) {
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let best = index;
      if (left < this.items.length && this.compare(this.items[left], this.items[best]) < 0) best = left;
      if (right < this.items.length && this.compare(this.items[right], this.items[best]) < 0) best = right;
      if (best === index) break;
      [this.items[index], this.items[best]] = [this.items[best], this.items[index]];
      index = best;
    }
  }
}

class AvlNode {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.left = null;
    this.right = null;
    this.height = 1;
  }
}

class PnrAvlTree {
  constructor() {
    this.root = null;
    this.size = 0;
  }
  get height() { return this.root?.height ?? 0; }
  getHeight(node) { return node?.height ?? 0; }
  getBalance(node) { return node ? this.getHeight(node.left) - this.getHeight(node.right) : 0; }
  updateHeight(node) {
    node.height = 1 + Math.max(this.getHeight(node.left), this.getHeight(node.right));
  }
  rotateRight(root) {
    const pivot = root.left;
    root.left = pivot.right;
    pivot.right = root;
    this.updateHeight(root);
    this.updateHeight(pivot);
    return pivot;
  }
  rotateLeft(root) {
    const pivot = root.right;
    root.right = pivot.left;
    pivot.left = root;
    this.updateHeight(root);
    this.updateHeight(pivot);
    return pivot;
  }
  rebalance(node, insertedKey) {
    this.updateHeight(node);
    const balance = this.getBalance(node);
    if (balance > 1) {
      if (insertedKey > node.left.key) node.left = this.rotateLeft(node.left);
      return this.rotateRight(node);
    }
    if (balance < -1) {
      if (insertedKey < node.right.key) node.right = this.rotateRight(node.right);
      return this.rotateLeft(node);
    }
    return node;
  }
  insert(key, value) {
    let inserted = false;
    const add = (node) => {
      if (!node) {
        inserted = true;
        return new AvlNode(key, value);
      }
      if (key < node.key) node.left = add(node.left);
      else if (key > node.key) node.right = add(node.right);
      else {
        node.value = value;
        return node;
      }
      return this.rebalance(node, key);
    };
    this.root = add(this.root);
    if (inserted) this.size += 1;
  }
  search(key) {
    let node = this.root;
    while (node) {
      if (key === node.key) return node.value;
      node = key < node.key ? node.left : node.right;
    }
    return null;
  }
  inOrder(node = this.root, entries = []) {
    if (!node) return entries;
    this.inOrder(node.left, entries);
    entries.push(node);
    this.inOrder(node.right, entries);
    return entries;
  }
}

const pnrIndex = new PnrAvlTree();
tickets.forEach((ticket) => pnrIndex.insert(ticket.pnr, ticket));

const priorityWeight = (priority) => priority;
function buildIncidentHeap() {
  const heap = new BinaryHeap((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority) || a.createdAt - b.createdAt);
  incidents.forEach((incident) => heap.push(incident));
  return heap;
}
function getSortedIncidents() {
  const heap = buildIncidentHeap();
  const ordered = [];
  while (heap.size) ordered.push(heap.pop());
  return ordered;
}
function formatTimeAgo(timestamp) {
  const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
  return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
}
function priorityName(priority) {
  return priority === 3 ? 'Critical' : priority === 2 ? 'High' : 'Routine';
}
function priorityClass(priority) {
  return priority === 3 ? '' : priority === 2 ? 'high' : 'routine';
}
function statusClass(status) {
  return status === 'Delayed' ? 'delayed' : status === 'Boarding' ? 'boarding' : '';
}
function renderIncidentRow(incident, dispatch = false, index = 0) {
  const wrapper = dispatch ? 'dispatch-item' : 'incident-row';
  return `<div class="${wrapper}">${dispatch ? `<span class="queue-rank">${String(index + 1).padStart(2, '0')}</span>` : ''}<i class="priority-dot ${priorityClass(incident.priority)}"></i><div class="incident-copy"><div class="incident-title">${escapeHtml(incident.title)}</div><div class="incident-meta">${escapeHtml(incident.location)} · ${escapeHtml(incident.team)} · ${formatTimeAgo(incident.createdAt)}</div></div><span class="priority-label ${priorityClass(incident.priority)}">${priorityName(incident.priority)}</span></div>`;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function renderTrains(targetId, list, compact = false) {
  const target = document.getElementById(targetId);
  if (!list.length) {
    target.innerHTML = `<tr><td colspan="${compact ? 4 : 7}" class="empty-table">No services match your search.</td></tr>`;
    return;
  }
  target.innerHTML = list.map((train) => compact
    ? `<tr><td class="train-id">${train.id}</td><td><span class="route-code">${train.route}</span></td><td><span class="status-pill ${statusClass(train.status)}">${train.status}</span></td><td>${train.eta}</td></tr>`
    : `<tr><td class="train-id">${escapeHtml(train.id)}</td><td><span class="route-code">${escapeHtml(train.route)}</span></td><td class="destination">${escapeHtml(train.destination)}</td><td>${escapeHtml(train.departure)}</td><td><span class="status-pill ${statusClass(train.status)}">${escapeHtml(train.status)}</span></td><td class="${train.delay ? 'delay-late' : 'delay-good'}">${train.delay ? `+${train.delay} min` : 'On time'}</td><td class="train-actions"><button class="row-action" data-train-status="${escapeHtml(train.id)}">${train.status === 'Delayed' ? 'Clear delay' : 'Mark delayed'}</button><button class="row-action remove-train" data-train-remove="${escapeHtml(train.id)}">Remove</button></td></tr>`).join('');
}
function renderMaintenance() {
  const list = document.getElementById('maintenanceList');
  if (!maintenance.length) {
    list.innerHTML = '<div class="empty-list">No requests waiting. Add a task to the queue.</div>';
    persistData();
    return;
  }
  list.innerHTML = maintenance.map((job, index) => `<div class="maintenance-item"><span class="maintenance-index">${String(index + 1).padStart(2, '0')}</span><span class="maintenance-text">${escapeHtml(job.description)}</span><span class="maintenance-time">${job.time}</span></div>`).join('');
  persistData();
}
function getTicketFare(trainId, coachClass) {
  const train = trains.find((item) => item.id === trainId);
  if (!train) return 0;
  const route = findShortestRoute(train.origin, train.destination);
  const classMultipliers = { SL: 1, '3A': 2.4, '2A': 3.5, CC: 1.7, '2S': 0.8 };
  const estimatedFare = (route?.minutes ?? 0) * 5 * (classMultipliers[coachClass] ?? 1);
  return Math.ceil(estimatedFare / 10) * 10;
}
function renderTickets() {
  const query = (document.getElementById('ticketSearch')?.value ?? '').trim().toLowerCase();
  const status = document.getElementById('ticketStatusFilter')?.value ?? 'all';
  const exactPnrSearch = /^\d{10}$/.test(query);
  const indexedPnr = exactPnrSearch ? pnrIndex.search(query) : null;
  const candidates = exactPnrSearch ? (indexedPnr ? [indexedPnr] : []) : tickets;
  const filtered = candidates.filter((ticket) => {
    const matchesQuery = `${ticket.pnr} ${ticket.passenger} ${ticket.trainId} ${ticket.trainName}`.toLowerCase().includes(query);
    return matchesQuery && (status === 'all' || ticket.status === status);
  });
  document.getElementById('ticketTotalCount').textContent = tickets.length;
  document.getElementById('ticketConfirmedCount').textContent = tickets.filter((ticket) => ticket.status === 'Confirmed').length;
  document.getElementById('ticketCancelledCount').textContent = tickets.filter((ticket) => ticket.status === 'Cancelled').length;
  document.getElementById('navTicketCount').textContent = tickets.filter((ticket) => ticket.status === 'Confirmed').length;
  document.getElementById('ticketResultCount').textContent = `${filtered.length} booking${filtered.length === 1 ? '' : 's'}`;
  const target = document.getElementById('ticketTableBody');
  if (!filtered.length) {
    target.innerHTML = `<tr><td colspan="9" class="empty-table">${tickets.length ? 'No bookings match your search.' : 'No bookings yet. Create a demo booking to get started.'}</td></tr>`;
    persistData();
    return;
  }
  target.innerHTML = filtered.map((ticket) => {
    const travelDate = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(`${ticket.travelDate}T00:00:00`));
    return `<tr><td class="ticket-pnr">${escapeHtml(ticket.pnr)}</td><td class="ticket-person"><strong>${escapeHtml(ticket.passenger)}</strong><small>${escapeHtml(String(ticket.age))} yrs · ${escapeHtml(ticket.gender)}</small></td><td class="ticket-service">${escapeHtml(ticket.trainId)} · ${escapeHtml(ticket.trainName)}</td><td class="ticket-route">${escapeHtml(ticket.origin)} → ${escapeHtml(ticket.destination)}</td><td>${travelDate}</td><td>${escapeHtml(ticket.coachClass)}</td><td class="ticket-fare">${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(ticket.fare)}</td><td><span class="ticket-status ${ticket.status === 'Cancelled' ? 'cancelled' : ''}">${escapeHtml(ticket.status)}</span></td><td>${ticket.status === 'Confirmed' ? `<button class="ticket-cancel" data-cancel-ticket="${escapeHtml(ticket.pnr)}">Cancel booking</button>` : '—'}</td></tr>`;
  }).join('');
  persistData();
}
function populateTicketTrains() {
  const select = document.getElementById('ticketTrain');
  const previous = select.value;
  select.innerHTML = trains.map((train) => `<option value="${escapeHtml(train.id)}">${escapeHtml(train.id)} · ${escapeHtml(train.route)}</option>`).join('');
  if (trains.some((train) => train.id === previous)) select.value = previous;
  updateTicketPreview();
}
function updateTicketPreview() {
  const train = trains.find((item) => item.id === document.getElementById('ticketTrain').value);
  const coachClass = document.getElementById('ticketClass').value;
  document.getElementById('ticketRoutePreview').textContent = train ? `${train.origin} → ${train.destination} · ${train.departure} departure` : 'No train services available';
  document.getElementById('ticketFareEstimate').textContent = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(getTicketFare(train?.id, coachClass));
}
function localDateValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function generatePnr() {
  let pnr;
  do {
    pnr = String(Math.floor(1000000000 + Math.random() * 9000000000));
  } while (tickets.some((ticket) => ticket.pnr === pnr));
  return pnr;
}
function renderPnrIndex() {
  document.getElementById('pnrIndexRecords').textContent = `${pnrIndex.size} PNR${pnrIndex.size === 1 ? '' : 's'} indexed`;
  document.getElementById('pnrIndexHeight').textContent = `HEIGHT ${pnrIndex.height}`;
  const svg = document.getElementById('pnrAvlTree');
  const empty = document.getElementById('pnrTreeEmpty');
  empty.hidden = pnrIndex.size > 0;
  svg.hidden = pnrIndex.size === 0;
  if (!pnrIndex.size) return;

  const visibleNodes = [];
  const visit = (node, depth, position, parent) => {
    if (!node || depth > 4) return;
    visibleNodes.push({ node, depth, position, parent });
    visit(node.left, depth + 1, position * 2, node);
    visit(node.right, depth + 1, position * 2 + 1, node);
  };
  visit(pnrIndex.root, 0, 0, null);
  const visibleDepth = Math.max(...visibleNodes.map((entry) => entry.depth));
  const svgHeight = (visibleDepth + 1) * 58 + 18;
  const positions = new Map(visibleNodes.map(({ node, depth, position }) => [node.key, {
    x: 720 * (position + 1) / (2 ** depth + 1),
    y: 25 + depth * 58
  }]));
  const links = visibleNodes.filter((entry) => entry.parent && positions.has(entry.parent.key)).map(({ node, parent }) => {
    const from = positions.get(parent.key);
    const to = positions.get(node.key);
    return `<line class="avl-link" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>`;
  }).join('');
  const nodes = visibleNodes.map(({ node }) => {
    const point = positions.get(node.key);
    return `<g class="avl-node" transform="translate(${point.x} ${point.y})"><title>PNR ${node.key}</title><circle r="16"/><text y="3">${node.key.slice(-4)}</text></g>`;
  }).join('');
  svg.setAttribute('viewBox', `0 0 720 ${svgHeight}`);
  svg.setAttribute('aria-label', `PNR AVL tree with ${pnrIndex.size} records and height ${pnrIndex.height}`);
  svg.innerHTML = `${links}${nodes}`;
  document.getElementById('pnrTreeLimitNote').hidden = pnrIndex.size <= visibleNodes.length;
}
function render() {
  persistData();
  renderRailMap();
  const ordered = getSortedIncidents();
  document.getElementById('metricTrains').textContent = trains.length;
  document.getElementById('metricIncidents').textContent = incidents.length;
  document.getElementById('navIncidentCount').textContent = incidents.length;
  document.getElementById('dispatchOpenCount').textContent = incidents.length;
  document.getElementById('fleetActiveCount').textContent = trains.filter((train) => train.status !== 'Delayed').length;
  document.getElementById('fleetOnTimeCount').textContent = trains.filter((train) => train.delay <= 3).length;
  document.getElementById('fleetAttentionCount').textContent = trains.filter((train) => train.status === 'Delayed').length;
  document.getElementById('overviewIncidentList').innerHTML = ordered.length ? ordered.slice(0, 3).map((incident) => renderIncidentRow(incident)).join('') : '<div class="empty-list">No open incidents. Network is clear.</div>';
  document.getElementById('dispatchIncidentList').innerHTML = ordered.length ? ordered.map((incident, index) => renderIncidentRow(incident, true, index)).join('') : '<div class="empty-list">All clear. No incidents in the queue.</div>';
  renderTrains('overviewFleetTable', trains.slice(0, 4), true);
  renderTrains('fleetTableBody', getFilteredTrains());
  document.getElementById('fleetTableCount').textContent = `${getFilteredTrains().length} service${getFilteredTrains().length === 1 ? '' : 's'}`;
  document.getElementById('fleetResultLabel').textContent = `${getFilteredTrains().length} of ${trains.length} services`;
  populateTicketTrains();
  renderTickets();
  renderPnrIndex();
  renderMaintenance();
}
function getFilteredTrains() {
  const query = (document.getElementById('fleetSearch')?.value ?? '').trim().toLowerCase();
  return trains.filter((train) => `${train.id} ${train.route} ${train.origin} ${train.destination} ${train.status}`.toLowerCase().includes(query));
}
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2700);
}
function showView(name) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${name}`));
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === name));
  const labels = { overview: 'Overview', fleet: 'Train fleet', routes: 'Route planner', tickets: 'Ticket management', dispatch: 'Dispatch queue' };
  document.getElementById('breadcrumbCurrent').textContent = labels[name];
  window.location.hash = name === 'overview' ? 'overview' : name;
}
function buildGraph() {
  const graph = Object.fromEntries(stations.map((station) => [station, []]));
  connections.forEach(([from, to, minutes]) => {
    graph[from].push({ station: to, minutes });
    graph[to].push({ station: from, minutes });
  });
  return graph;
}
function findShortestRoute(start, destination) {
  const graph = buildGraph();
  const distances = Object.fromEntries(stations.map((station) => [station, Infinity]));
  const previous = {};
  const queue = new BinaryHeap((a, b) => a.distance - b.distance);
  distances[start] = 0;
  queue.push({ station: start, distance: 0 });
  while (queue.size) {
    const current = queue.pop();
    if (current.distance !== distances[current.station]) continue;
    if (current.station === destination) break;
    graph[current.station].forEach(({ station, minutes }) => {
      const nextDistance = current.distance + minutes;
      if (nextDistance < distances[station]) {
        distances[station] = nextDistance;
        previous[station] = current.station;
        queue.push({ station, distance: nextDistance });
      }
    });
  }
  if (!Number.isFinite(distances[destination])) return null;
  const path = [destination];
  while (path[0] !== start) path.unshift(previous[path[0]]);
  return { path, minutes: distances[destination] };
}
function renderConnections() {
  document.getElementById('connectionGrid').innerHTML = connections.map(([from, to, minutes]) => `<div class="connection-item"><span><b>${from}</b> ↔ ${to}</span><span>${minutes} min</span></div>`).join('');
  document.querySelector('.node-count').textContent = `${stations.length} STATIONS · ${connections.length} CONNECTIONS`;
}
function renderRailMap() {
  const svg = document.querySelector('.network-map');
  const namespace = 'http://www.w3.org/2000/svg';
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', `Schematic Indian railway network with ${stations.length} stations`);
  svg.querySelectorAll('.track, .station, .train-marker').forEach((element) => element.remove());
  const appendTrack = (from, to, className) => {
    const path = document.createElementNS(namespace, 'path');
    const [fromX, fromY] = stationCoordinates[from];
    const [toX, toY] = stationCoordinates[to];
    path.setAttribute('class', `track ${className}`);
    path.setAttribute('d', `M${fromX} ${fromY} L${toX} ${toY}`);
    svg.insertBefore(path, svg.querySelector('.map-label'));
  };
  connections.forEach(([from, to]) => appendTrack(from, to, 'track-muted'));
  connections.slice(0, 3).forEach(([from, to]) => appendTrack(from, to, 'track-main'));
  connections.slice(3).forEach(([from, to]) => appendTrack(from, to, 'track-branch'));
  stations.forEach((station, index) => {
    const group = document.createElementNS(namespace, 'g');
    const [x, y] = stationCoordinates[station];
    group.setAttribute('class', `station${index > 3 ? ' station-branch' : ''}`);
    group.setAttribute('transform', `translate(${x} ${y})`);
    const circle = document.createElementNS(namespace, 'circle');
    circle.setAttribute('r', '7');
    const label = document.createElementNS(namespace, 'text');
    label.setAttribute('x', '0');
    label.setAttribute('y', index === 0 || index === 2 || index >= 4 ? '22' : '-14');
    label.setAttribute('text-anchor', 'middle');
    label.textContent = stationMapLabels[station];
    group.append(circle, label);
    svg.insertBefore(group, svg.querySelector('.map-label'));
  });
  trains.forEach((train, index) => {
    if (!findShortestRoute(train.origin, train.destination)) return;
    const group = document.createElementNS(namespace, 'g');
    group.setAttribute('class', `train-marker${index % 2 ? ' marker-two' : ''}${train.status === 'Delayed' ? ' marker-delayed' : ''}${train.status === 'Boarding' ? ' marker-boarding' : ''}`);
    group.setAttribute('data-train-id', train.id);
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '0');
    const circle = document.createElementNS(namespace, 'circle');
    circle.setAttribute('r', '10');
    const marker = document.createElementNS(namespace, 'text');
    marker.setAttribute('y', '4');
    marker.setAttribute('text-anchor', 'middle');
    marker.textContent = '↗';
    const trainLabel = document.createElementNS(namespace, 'text');
    trainLabel.setAttribute('class', 'map-train-id');
    trainLabel.setAttribute('x', '0');
    trainLabel.setAttribute('y', '-14');
    trainLabel.setAttribute('text-anchor', 'middle');
    trainLabel.textContent = train.id;
    const title = document.createElementNS(namespace, 'title');
    title.textContent = `Simulated position for sample train ${train.id}`;
    group.append(circle, marker, trainLabel, title);
    svg.insertBefore(group, svg.querySelector('.map-label'));
  });
  updateTrainMap(Date.now());
}
function getConnectionMinutes(from, to) {
  return connections.find(([a, b]) => (a === from && b === to) || (a === to && b === from))?.[2] ?? 1;
}
function locateTrainOnRoute(train, index, now) {
  const route = findShortestRoute(train.origin, train.destination);
  if (!route || route.path.length < 2) return null;
  const speed = train.status === 'Delayed' ? 0.65 : 1;
  let remaining = (((now - mapSimulationStartedAt) / 1000) * speed + index * route.minutes / Math.max(trains.length, 1)) % route.minutes;
  let segmentIndex = 0;
  let segmentMinutes = 0;
  while (segmentIndex < route.path.length - 1) {
    const from = route.path[segmentIndex];
    const to = route.path[segmentIndex + 1];
    segmentMinutes = getConnectionMinutes(from, to);
    if (remaining < segmentMinutes || segmentIndex === route.path.length - 2) break;
    remaining -= segmentMinutes;
    segmentIndex += 1;
  }
  const from = route.path[segmentIndex];
  const to = route.path[segmentIndex + 1];
  const fraction = Math.min(1, remaining / segmentMinutes);
  const [fromX, fromY] = stationCoordinates[from];
  const [toX, toY] = stationCoordinates[to];
  const minutesBeforeSegment = route.path.slice(0, segmentIndex).reduce((total, station, pathIndex) => total + getConnectionMinutes(station, route.path[pathIndex + 1]), 0);
  const minutesElapsed = minutesBeforeSegment + remaining;
  return {
    x: fromX + (toX - fromX) * fraction,
    y: fromY + (toY - fromY) * fraction,
    from,
    to,
    progress: fraction * 100,
    remainingMinutes: Math.max(0, Math.ceil(route.minutes - minutesElapsed))
  };
}
function updateTrainMap(now = Date.now()) {
  const svg = document.querySelector('.network-map');
  const markerById = new Map([...svg.querySelectorAll('.train-marker')].map((marker) => [marker.dataset.trainId, marker]));
  const positions = new Map();
  trains.forEach((train, index) => {
    const position = locateTrainOnRoute(train, index, now);
    if (!position) return;
    positions.set(train.id, position);
    const marker = markerById.get(train.id);
    if (!marker) return;
    marker.setAttribute('transform', `translate(${position.x} ${position.y})`);
    marker.setAttribute('aria-label', `Simulated train ${train.id}, ${train.route}, ${train.status}, ${position.from} to ${position.to}. Select for details.`);
    marker.setAttribute('aria-pressed', String(train.id === selectedTrainId));
    marker.classList.toggle('selected', train.id === selectedTrainId);
  });
  const selectedTrain = trains.find((train) => train.id === selectedTrainId) ?? trains[0];
  if (selectedTrain && !trains.some((train) => train.id === selectedTrainId)) selectedTrainId = selectedTrain.id;
  const position = selectedTrain ? positions.get(selectedTrain.id) : null;
  const details = document.getElementById('mapTrainDetails');
  if (!selectedTrain || !position) {
    details.innerHTML = '<div class="empty-list">No trains currently added to the map.</div>';
  } else {
    details.innerHTML = `<div class="map-detail-heading"><div><strong>${escapeHtml(selectedTrain.id)}</strong><span>${escapeHtml(selectedTrain.route)}</span></div><span class="status-pill ${statusClass(selectedTrain.status)}">${escapeHtml(selectedTrain.status)}</span></div><div class="map-detail-grid"><div><span>SIMULATED SECTION</span><strong>${escapeHtml(position.from)} → ${escapeHtml(position.to)}</strong></div><div><span>NEXT STATION</span><strong>${escapeHtml(position.to)}</strong></div><div><span>DEMO ETA TO DESTINATION</span><strong>~${position.remainingMinutes} network min</strong></div><div><span>SAMPLE DESTINATION</span><strong>${escapeHtml(selectedTrain.destination)}</strong></div></div><div class="map-progress"><i style="width:${position.progress}%"></i></div>`;
  }
  const updated = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(now));
  document.getElementById('mapUpdated').textContent = `Updated ${updated} IST`;
}
function configureIndianSampleCopy() {
  document.querySelector('.live-status').innerHTML = '<i></i> SAMPLE DATA';
  document.querySelector('.signal-card strong').textContent = 'Example network loaded';
  document.querySelector('.signal-card small').textContent = 'Illustrative dataset';
  document.querySelector('.banner-tag').innerHTML = '<i></i> INDIAN RAILWAY SAMPLE';
  document.querySelector('.banner-copy h2').innerHTML = 'Mumbai to Pune,<br>and beyond.';
  document.querySelector('.banner-copy > p').textContent = 'A sample Central Railway network. Times are illustrative, not live timetable data.';
  document.querySelector('.banner-meta span b').textContent = '98.6%';
  document.querySelector('.banner-meta span:first-child').lastChild.textContent = ' sample punctuality';
  document.querySelector('.banner-meta span:last-child b').textContent = 'SAMPLE';
  document.querySelector('.banner-meta span:last-child').lastChild.textContent = ' illustrative data';
  document.querySelector('.banner-number strong').textContent = '02';
  document.querySelector('.banner-number span').innerHTML = 'ACTIVE<br>ROUTES';
  document.querySelector('.section-heading p').textContent = 'Illustrative sample for Mumbai and Pune routes';
  document.querySelector('.updated-label').innerHTML = '<i></i> SAMPLE DATA';
  document.querySelector('#view-overview .metric-card:nth-child(2) .metric-top span').textContent = 'Sample punctuality';
  document.querySelector('#view-overview .metric-card:nth-child(2) .metric-foot').textContent = 'Illustrative, not live operational data';
  document.querySelector('#view-overview .metric-card:nth-child(4) .metric-value').textContent = stations.length;
  document.querySelector('#view-overview .metric-card:nth-child(4) .metric-foot').textContent = 'Stations in this sample graph';
  document.querySelector('#view-overview .metric-card:nth-child(3) .metric-foot').textContent = 'Across the sample network';
  document.querySelector('.network-panel .panel-heading h3').textContent = 'Indian railway network map';
  document.querySelector('.network-panel .panel-heading p').textContent = 'Sample routes · marker positions are simulated, not live GPS';
  document.querySelector('.corridor-panel .panel-heading p').textContent = 'Illustrative sample punctuality by corridor';
  const corridorNames = ['Mumbai suburban', 'Kasara route', 'Pune intercity'];
  document.querySelectorAll('.corridor-name').forEach((item, index) => { item.textContent = corridorNames[index]; });
  document.querySelector('.corridor-note').innerHTML = '<span>↗</span> Sample change <b id="performanceChange">1.2%</b> · illustrative only';
  document.querySelector('#view-fleet .page-subtitle').textContent = 'Indian Railways service examples with illustrative schedule times.';
  document.querySelector('.table-bottom span:last-child').lastChild.textContent = ' Sample data';
  document.querySelector('#view-routes .page-subtitle').textContent = 'Plan across the Mumbai, Kasara and Pune sample network.';
  document.querySelector('#view-routes .algorithm-note p').innerHTML = 'Route time uses <strong>Dijkstra’s algorithm</strong>. Segment times are illustrative estimates, not an official timetable.';
  document.querySelector('#incidentTitle').placeholder = 'e.g. Signal issue near Thane';
  document.querySelector('#trainIdInput').placeholder = 'e.g. 12123';
  document.querySelector('.app-footer span:last-child').textContent = 'INDIAN RAILWAYS · ILLUSTRATIVE SAMPLE';
}
function renderRouteResult(route, start, destination) {
  const result = document.getElementById('routeResult');
  if (!route) {
    result.innerHTML = '<div class="empty-route"><div class="route-empty-icon">!</div><h3>No connection found</h3><p>These stations are not connected in the current network graph.</p></div>';
    return;
  }
  const stops = route.path.map((station, index) => `<li class="route-stop"><span>${station}</span><small>${index === 0 ? 'Origin' : index === route.path.length - 1 ? 'Destination' : `Stop ${index}`}</small></li>`).join('');
  result.innerHTML = `<div class="result-header"><h3>Fastest available route</h3><span class="result-label">OPTIMAL PATH</span></div><div class="result-summary"><div><span>Estimated travel</span><strong>${route.minutes} min</strong></div><div><span>Stations</span><strong>${route.path.length}</strong></div><div><span>Connections</span><strong>${route.path.length - 1}</strong></div></div><ol class="route-stops">${stops}</ol>`;
  result.setAttribute('aria-label', `Fastest route from ${start} to ${destination}: ${route.path.join(', ')}, ${route.minutes} minutes`);
}
function openIncidentDialog() {
  document.getElementById('incidentDialog').showModal();
  document.getElementById('incidentTitle').focus();
}
function closeIncidentDialog() {
  document.getElementById('incidentDialog').close();
}
function setSignedInUser(email) {
  const localName = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
  const name = localName.replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Operator';
  document.getElementById('welcomeName').textContent = name.split(' ')[0];
  document.getElementById('operatorName').textContent = name;
  document.getElementById('operatorEmail').textContent = email;
  document.getElementById('operatorAvatar').textContent = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  document.getElementById('menuOperatorName').textContent = name;
  document.getElementById('menuOperatorEmail').textContent = email;
  document.getElementById('authScreen').hidden = true;
  document.getElementById('appShell').hidden = false;
}
function signOut() {
  try { sessionStorage.removeItem('trackline.operator'); } catch {}
  document.getElementById('operatorMenu').hidden = true;
  document.getElementById('operatorMenuToggle').setAttribute('aria-expanded', 'false');
  document.getElementById('appShell').hidden = true;
  document.getElementById('authScreen').hidden = false;
  document.getElementById('signInPassword').value = '';
  document.getElementById('signInEmail').focus();
}
function updatePerformance(period) {
  const values = {
    today: { central: 98, coastal: 91, airport: 96, change: '1.2%' },
    week: { central: 97, coastal: 93, airport: 97, change: '0.8%' },
    month: { central: 96, coastal: 92, airport: 98, change: '1.6%' }
  }[period];
  Object.entries(values).forEach(([key, value]) => {
    if (key === 'change') return;
    document.querySelector(`[data-performance="${key}"]`).style.width = `${value}%`;
    document.querySelector(`[data-performance-value="${key}"]`).textContent = `${value}%`;
  });
  document.getElementById('performanceChange').textContent = values.change;
}
function estimateArrival(departure, origin, destination) {
  const route = findShortestRoute(origin, destination);
  const [hours, minutes] = departure.split(':').map(Number);
  const arrivalMinutes = (hours * 60 + minutes + (route?.minutes ?? 0)) % (24 * 60);
  return `${String(Math.floor(arrivalMinutes / 60)).padStart(2, '0')}:${String(arrivalMinutes % 60).padStart(2, '0')}`;
}
function updateClockAndGreeting() {
  const now = new Date();
  const dateOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Kolkata'
  };
  const timeOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Kolkata'
  };
  document.getElementById('currentDate').textContent =
    new Intl.DateTimeFormat('en', dateOptions).format(now);
  document.getElementById('currentTime').textContent =
    `${new Intl.DateTimeFormat('en-IN', timeOptions).format(now)} IST`;

  const hour = Number(new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Kolkata'
  }).format(now));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('greetingPeriod').textContent = greeting;
}
function init() {
  updateClockAndGreeting();
  window.setInterval(updateClockAndGreeting, 1000);
  const routeFrom = document.getElementById('routeFrom');
  const routeTo = document.getElementById('routeTo');
  [routeFrom, routeTo, document.getElementById('incidentLocation'), document.getElementById('trainOrigin'), document.getElementById('trainDestination')].forEach((select) => {
    select.innerHTML = stations.map((station) => `<option value="${station}">${station}</option>`).join('');
  });
  routeFrom.value = 'Mumbai CSMT';
  routeTo.value = 'Pune Jn';
  document.getElementById('trainOrigin').value = 'Mumbai CSMT';
  document.getElementById('trainDestination').value = 'Pune Jn';
  document.getElementById('incidentLocation').value = 'Mumbai CSMT';
  document.getElementById('trainDeparture').value = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  document.getElementById('ticketTravelDate').min = localDateValue();
  document.getElementById('ticketTravelDate').value = localDateValue();
  populateTicketTrains();
  configureIndianSampleCopy();
  renderConnections();
  updatePerformance('today');
  render();

  const networkMap = document.querySelector('.network-map');
  const selectMapTrain = (event) => {
    const marker = event.target.closest('.train-marker');
    if (!marker) return;
    selectedTrainId = marker.dataset.trainId;
    updateTrainMap(Date.now());
  };
  networkMap.addEventListener('click', selectMapTrain);
  networkMap.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!event.target.closest('.train-marker')) return;
    event.preventDefault();
    selectMapTrain(event);
  });
  window.setInterval(() => updateTrainMap(Date.now()), 1000);
  document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => showView(item.dataset.view)));
  document.querySelectorAll('[data-navigate]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.navigate)));
  document.querySelectorAll('[data-open-incident]').forEach((button) => button.addEventListener('click', openIncidentDialog));
  document.getElementById('addIncidentTop').addEventListener('click', openIncidentDialog);
  document.getElementById('closeDialog').addEventListener('click', closeIncidentDialog);
  document.getElementById('cancelDialog').addEventListener('click', closeIncidentDialog);
  document.getElementById('incidentForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const title = document.getElementById('incidentTitle').value.trim();
    if (!title) return;
    incidents.push({ id: nextIncidentId++, title, location: document.getElementById('incidentLocation').value, priority: Number(document.getElementById('incidentPriority').value), team: document.getElementById('incidentTeam').value, createdAt: Date.now() });
    event.currentTarget.reset();
    document.getElementById('incidentLocation').value = 'Mumbai CSMT';
    render();
    closeIncidentDialog();
    showView('dispatch');
    showToast('Incident added to the priority queue.');
  });
  document.getElementById('signInForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const email = document.getElementById('signInEmail').value.trim().toLowerCase();
    const password = document.getElementById('signInPassword').value;
    if (!email || password.length < 6) {
      document.getElementById('authError').textContent = 'Enter a valid email and a password with at least 6 characters.';
      document.getElementById('authError').hidden = false;
      return;
    }
    try { sessionStorage.setItem('trackline.operator', email); } catch {}
    document.getElementById('authError').hidden = true;
    setSignedInUser(email);
    showToast(`Signed in as ${email}`);
  });
  document.getElementById('operatorMenuToggle').addEventListener('click', () => {
    const menu = document.getElementById('operatorMenu');
    menu.hidden = !menu.hidden;
    document.getElementById('operatorMenuToggle').setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.getElementById('signOutButton').addEventListener('click', signOut);
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.operator')) {
      document.getElementById('operatorMenu').hidden = true;
      document.getElementById('operatorMenuToggle').setAttribute('aria-expanded', 'false');
    }
  });
  document.getElementById('performancePeriod').addEventListener('change', (event) => updatePerformance(event.target.value));
  document.getElementById('newTicketButton').addEventListener('click', () => {
    const form = document.getElementById('ticketForm');
    form.reset();
    document.getElementById('ticketTravelDate').value = localDateValue();
    populateTicketTrains();
    document.getElementById('ticketDialog').showModal();
    document.getElementById('ticketPassenger').focus();
  });
  document.getElementById('closeTicketDialog').addEventListener('click', () => document.getElementById('ticketDialog').close());
  document.getElementById('cancelTicketDialog').addEventListener('click', () => document.getElementById('ticketDialog').close());
  document.getElementById('ticketTrain').addEventListener('change', updateTicketPreview);
  document.getElementById('ticketClass').addEventListener('change', updateTicketPreview);
  document.getElementById('ticketForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const train = trains.find((item) => item.id === document.getElementById('ticketTrain').value);
    if (!train) return showToast('No train service is available for booking.');
    const pnr = generatePnr();
    const booking = {
      pnr,
      passenger: document.getElementById('ticketPassenger').value.trim(),
      age: Number(document.getElementById('ticketAge').value),
      gender: document.getElementById('ticketGender').value,
      trainId: train.id,
      trainName: train.route,
      origin: train.origin,
      destination: train.destination,
      travelDate: document.getElementById('ticketTravelDate').value,
      coachClass: document.getElementById('ticketClass').value,
      fare: getTicketFare(train.id, document.getElementById('ticketClass').value),
      status: 'Confirmed',
      bookedAt: Date.now()
    };
    tickets.unshift(booking);
    pnrIndex.insert(pnr, booking);
    document.getElementById('ticketDialog').close();
    document.getElementById('ticketSearch').value = pnr;
    document.getElementById('ticketStatusFilter').value = 'all';
    render();
    showToast(`Demo booking created. PNR ${pnr}`);
  });
  document.getElementById('ticketSearch').addEventListener('input', renderTickets);
  document.getElementById('ticketStatusFilter').addEventListener('change', renderTickets);
  document.getElementById('ticketTableBody').addEventListener('click', (event) => {
    const cancelButton = event.target.closest('[data-cancel-ticket]');
    if (!cancelButton) return;
    const ticket = tickets.find((item) => item.pnr === cancelButton.dataset.cancelTicket);
    if (!ticket || ticket.status !== 'Confirmed') return;
    ticket.status = 'Cancelled';
    ticket.cancelledAt = Date.now();
    render();
    showToast(`Booking ${ticket.pnr} cancelled in the demo register.`);
  });
  document.getElementById('dispatchNext').addEventListener('click', () => {
    const next = buildIncidentHeap().pop();
    if (!next) return showToast('No incidents waiting to dispatch.');
    incidents = incidents.filter((incident) => incident.id !== next.id);
    render();
    showToast(`Dispatched: ${next.title}`);
  });
  document.getElementById('maintenanceForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('maintenanceInput');
    const description = input.value.trim();
    if (!description) return;
    maintenance.push({ id: nextMaintenanceId++, description, time: new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date()) });
    input.value = '';
    renderMaintenance();
    showToast('Maintenance request added to the end of the queue.');
  });
  document.getElementById('completeMaintenance').addEventListener('click', () => {
    const completed = maintenance.shift();
    if (!completed) return showToast('No maintenance requests waiting.');
    renderMaintenance();
    showToast(`Completed: ${completed.description}`);
  });
  document.getElementById('addTrainButton').addEventListener('click', () => {
    document.getElementById('trainDialog').showModal();
    document.getElementById('trainIdInput').focus();
  });
  document.getElementById('closeTrainDialog').addEventListener('click', () => document.getElementById('trainDialog').close());
  document.getElementById('cancelTrainDialog').addEventListener('click', () => document.getElementById('trainDialog').close());
  document.getElementById('trainForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const idInput = document.getElementById('trainIdInput');
    const id = idInput.value.trim().toUpperCase();
    const origin = document.getElementById('trainOrigin').value;
    const destination = document.getElementById('trainDestination').value;
    if (trains.some((train) => train.id.toLowerCase() === id.toLowerCase())) {
      idInput.setCustomValidity('That train ID is already in the fleet.');
      idInput.reportValidity();
      idInput.addEventListener('input', () => idInput.setCustomValidity(''), { once: true });
      return;
    }
    if (origin === destination) {
      showToast('Choose different origin and destination stations.');
      return;
    }
    const departure = document.getElementById('trainDeparture').value;
    const route = document.getElementById('trainRouteInput').value.trim().toUpperCase();
    trains.push({ id, route, origin, destination, departure, eta: estimateArrival(departure, origin, destination), status: 'On time', delay: 0 });
    event.currentTarget.reset();
    document.getElementById('trainDeparture').value = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    document.getElementById('trainDialog').close();
    render();
    showToast(`${id} added to the fleet.`);
  });
  document.getElementById('fleetTableBody').addEventListener('click', (event) => {
    const statusButton = event.target.closest('[data-train-status]');
    const removeButton = event.target.closest('[data-train-remove]');
    if (statusButton) {
      const train = trains.find((item) => item.id === statusButton.dataset.trainStatus);
      if (!train) return;
      train.status = train.status === 'Delayed' ? 'On time' : 'Delayed';
      train.delay = train.status === 'Delayed' ? 5 : 0;
      render();
      showToast(`${train.id}: ${train.status.toLowerCase()}.`);
    } else if (removeButton) {
      const removeIndex = trains.findIndex((item) => item.id === removeButton.dataset.trainRemove);
      if (removeIndex < 0) return;
      const [removed] = trains.splice(removeIndex, 1);
      render();
      if (removed) showToast(`${removed.id} removed from the fleet.`);
    }
  });
  document.getElementById('routeForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const start = routeFrom.value;
    const destination = routeTo.value;
    if (start === destination) return showToast('Choose two different stations.');
    renderRouteResult(findShortestRoute(start, destination), start, destination);
  });
  document.getElementById('fleetSearch').addEventListener('input', () => {
    renderTrains('fleetTableBody', getFilteredTrains());
    document.getElementById('fleetTableCount').textContent = `${getFilteredTrains().length} service${getFilteredTrains().length === 1 ? '' : 's'}`;
  });
  document.getElementById('exportFleet').addEventListener('click', () => {
    const header = ['Train ID', 'Route', 'Origin', 'Destination', 'Departure', 'ETA', 'Status', 'Delay (minutes)'];
    const rows = trains.map((train) => [train.id, train.route, train.origin, train.destination, train.departure, train.eta, train.status, train.delay]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a');
    const downloadUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.href = downloadUrl;
    link.download = 'trackline-fleet.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    showToast('Fleet roster exported as CSV.');
  });
  const initialView = window.location.hash.slice(1);
  if (['overview', 'fleet', 'routes', 'tickets', 'dispatch'].includes(initialView)) showView(initialView);
  window.addEventListener('hashchange', () => {
    const view = window.location.hash.slice(1);
    if (['overview', 'fleet', 'routes', 'tickets', 'dispatch'].includes(view) && !document.getElementById(`view-${view}`).classList.contains('active')) showView(view);
  });
  let signedInEmail = null;
  try { signedInEmail = sessionStorage.getItem('trackline.operator'); } catch {}
  if (signedInEmail) setSignedInUser(signedInEmail);
}

init();
