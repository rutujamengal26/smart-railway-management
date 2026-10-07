#include "railway.h"

#include <algorithm>
#include <climits>
#include <stdexcept>
#include <utility>
#include <queue>
#include <unordered_map>
#include <vector>

namespace {
void mergeByPrice(std::vector<Train>& trains, std::vector<Train>& buffer,
                  std::size_t begin, std::size_t end) {
    if (end - begin < 2) {
        return;
    }

    const std::size_t middle = begin + (end - begin) / 2;
    mergeByPrice(trains, buffer, begin, middle);
    mergeByPrice(trains, buffer, middle, end);

    std::size_t left = begin;
    std::size_t right = middle;
    std::size_t output = begin;
    while (left < middle && right < end) {
        if (trains[left].ticketPrice <= trains[right].ticketPrice) {
            buffer[output++] = trains[left++];
        } else {
            buffer[output++] = trains[right++];
        }
    }
    while (left < middle) {
        buffer[output++] = trains[left++];
    }
    while (right < end) {
        buffer[output++] = trains[right++];
    }
    for (std::size_t i = begin; i < end; ++i) {
        trains[i] = buffer[i];
    }
}

void quickSortByTime(std::vector<Train>& trains, int low, int high) {
    int left = low;
    int right = high;
    const std::string pivot = trains[low + (high - low) / 2].departureTime;
    while (left <= right) {
        while (trains[left].departureTime < pivot) {
            ++left;
        }
        while (trains[right].departureTime > pivot) {
            --right;
        }
        if (left <= right) {
            std::swap(trains[left], trains[right]);
            ++left;
            --right;
        }
    }
    if (low < right) {
        quickSortByTime(trains, low, right);
    }
    if (left < high) {
        quickSortByTime(trains, left, high);
    }
}

void siftDownForLeaderboard(std::vector<TrainBookingCount>& leaderboard,
                            std::size_t root, std::size_t heapSize) {
    while (root < heapSize / 2) {
        std::size_t child = root * 2 + 1;
        if (child + 1 < heapSize &&
            leaderboard[child + 1].bookings < leaderboard[child].bookings) {
            ++child;
        }
        if (leaderboard[root].bookings <= leaderboard[child].bookings) {
            return;
        }
        std::swap(leaderboard[root], leaderboard[child]);
        root = child;
    }
}

class DisjointSet {
public:
    explicit DisjointSet(std::size_t size) : parent_(size), rank_(size, 0) {
        for (std::size_t i = 0; i < size; ++i) {
            parent_[i] = i;
        }
    }

    std::size_t find(std::size_t value) {
        if (parent_[value] != value) {
            parent_[value] = find(parent_[value]);
        }
        return parent_[value];
    }

    bool unite(std::size_t left, std::size_t right) {
        left = find(left);
        right = find(right);
        if (left == right) {
            return false;
        }
        if (rank_[left] < rank_[right]) {
            std::swap(left, right);
        }
        parent_[right] = left;
        if (rank_[left] == rank_[right]) {
            ++rank_[left];
        }
        return true;
    }

private:
    std::vector<std::size_t> parent_;
    std::vector<unsigned int> rank_;
};
}

void RailwayGraph::addStation(const std::string& station) {
    graph_.insert(std::make_pair(station, std::vector<Edge>()));
}

void RailwayGraph::addConnection(const std::string& from, const std::string& to, int minutes) {
    addConnection(from, to, minutes, static_cast<double>(minutes));
}

void RailwayGraph::addConnection(const std::string& from, const std::string& to, int minutes,
                                 double constructionCost) {
    if (minutes < 0 || constructionCost < 0.0) {
        throw std::invalid_argument("Track time and construction cost must be non-negative");
    }
    addStation(from);
    addStation(to);
    graph_[from].push_back({to, minutes});
    graph_[to].push_back({from, minutes});
    trackCandidates_.push_back({from, to, constructionCost});
}

void TrainTicketLookup::addTrain(const Train& train) {
    trainsById_[train.id] = train;
}

const Train* TrainTicketLookup::findTrain(const std::string& trainId) const {
    const auto found = trainsById_.find(trainId);
    return found == trainsById_.end() ? nullptr : &found->second;
}

void TrainTicketLookup::addTicket(const Ticket& ticket) {
    ticketsByPnr_[ticket.pnr] = ticket;
}

const Ticket* TrainTicketLookup::findTicket(const std::string& pnr) const {
    const auto found = ticketsByPnr_.find(pnr);
    return found == ticketsByPnr_.end() ? nullptr : &found->second;
}

ConnectionRouteResult RailwayGraph::fewestConnectionsBfs(
    const std::string& start, const std::string& destination) const {
    ConnectionRouteResult result;
    if (graph_.find(start) == graph_.end() || graph_.find(destination) == graph_.end()) {
        return result;
    }

    std::queue<std::string> pending;
    std::unordered_map<std::string, std::string> parent;
    std::unordered_map<std::string, int> changes;
    pending.push(start);
    changes[start] = 0;

    while (!pending.empty()) {
        const std::string station = pending.front();
        pending.pop();
        if (station == destination) {
            break;
        }

        const auto adjacent = graph_.find(station);
        for (const Edge& edge : adjacent->second) {
            if (changes.find(edge.to) != changes.end()) {
                continue;
            }
            changes[edge.to] = changes[station] + 1;
            parent[edge.to] = station;
            pending.push(edge.to);
        }
    }

    const auto destinationChanges = changes.find(destination);
    if (destinationChanges == changes.end()) {
        return result;
    }

    std::string station = destination;
    while (station != start) {
        result.path.push_back(station);
        station = parent[station];
    }
    result.path.push_back(start);
    std::reverse(result.path.begin(), result.path.end());
    result.connections = destinationChanges->second;
    return result;
}

SpanningTreeResult RailwayGraph::minimumTrackSpanningTree() const {
    SpanningTreeResult result;
    if (graph_.empty()) {
        return result;
    }

    std::vector<std::string> stations;
    stations.reserve(graph_.size());
    for (const auto& station : graph_) {
        stations.push_back(station.first);
    }
    std::sort(stations.begin(), stations.end());

    if (stations.size() == 1) {
        result.spansAllStations = true;
        return result;
    }

    std::unordered_map<std::string, std::size_t> stationIndex;
    for (std::size_t i = 0; i < stations.size(); ++i) {
        stationIndex[stations[i]] = i;
    }

    std::vector<TrackSegment> sortedTracks = trackCandidates_;
    std::sort(sortedTracks.begin(), sortedTracks.end(),
              [](const TrackSegment& left, const TrackSegment& right) {
                  if (left.constructionCost != right.constructionCost) {
                      return left.constructionCost < right.constructionCost;
                  }
                  if (left.from != right.from) {
                      return left.from < right.from;
                  }
                  return left.to < right.to;
              });

    DisjointSet components(stations.size());
    for (const TrackSegment& track : sortedTracks) {
        const std::size_t from = stationIndex.find(track.from)->second;
        const std::size_t to = stationIndex.find(track.to)->second;
        if (components.unite(from, to)) {
            result.tracks.push_back(track);
            result.totalConstructionCost += track.constructionCost;
            if (result.tracks.size() + 1 == stations.size()) {
                break;
            }
        }
    }

    result.spansAllStations = result.tracks.size() + 1 == stations.size();
    return result;
}

bool WaitlistMinHeap::bookedBefore(const WaitlistPassenger& left,
                                   const WaitlistPassenger& right) {
    if (left.bookingTimestamp != right.bookingTimestamp) {
        return left.bookingTimestamp < right.bookingTimestamp;
    }
    return left.pnr < right.pnr;
}

void WaitlistMinHeap::push(const WaitlistPassenger& passenger) {
    passengers_.push_back(passenger);
    std::size_t index = passengers_.size() - 1;
    while (index > 0) {
        const std::size_t parent = (index - 1) / 2;
        if (!bookedBefore(passengers_[index], passengers_[parent])) {
            break;
        }
        std::swap(passengers_[index], passengers_[parent]);
        index = parent;
    }
}

bool WaitlistMinHeap::empty() const noexcept {
    return passengers_.empty();
}

WaitlistPassenger WaitlistMinHeap::popEarliest() {
    if (passengers_.empty()) {
        throw std::runtime_error("WaitlistMinHeap is empty");
    }

    const WaitlistPassenger earliest = passengers_.front();
    passengers_.front() = passengers_.back();
    passengers_.pop_back();

    if (!passengers_.empty()) {
        std::size_t index = 0;
        while (index < passengers_.size() / 2) {
            std::size_t child = index * 2 + 1;
            if (child + 1 < passengers_.size() &&
                bookedBefore(passengers_[child + 1], passengers_[child])) {
                ++child;
            }
            if (!bookedBefore(passengers_[child], passengers_[index])) {
                break;
            }
            std::swap(passengers_[index], passengers_[child]);
            index = child;
        }
    }
    return earliest;
}

bool promoteAfterCancellation(WaitlistMinHeap& waitlist,
                             WaitlistPassenger& promotedPassenger) {
    if (waitlist.empty()) {
        return false;
    }
    promotedPassenger = waitlist.popEarliest();
    return true;
}

void heapSortByBookings(std::vector<TrainBookingCount>& leaderboard) {
    for (std::size_t start = leaderboard.size() / 2; start > 0; --start) {
        siftDownForLeaderboard(leaderboard, start - 1, leaderboard.size());
    }
    for (std::size_t end = leaderboard.size(); end > 1; --end) {
        std::swap(leaderboard[0], leaderboard[end - 1]);
        siftDownForLeaderboard(leaderboard, 0, end - 1);
    }
}

DepartureTimeTree::~DepartureTimeTree() {
    destroy(root_);
}

void DepartureTimeTree::destroy(Node* node) {
    if (!node) {
        return;
    }
    destroy(node->left);
    destroy(node->right);
    delete node;
}

int DepartureTimeTree::nodeHeight(Node* node) {
    return node ? node->height : 0;
}

void DepartureTimeTree::updateHeight(Node* node) {
    node->height = 1 + std::max(nodeHeight(node->left), nodeHeight(node->right));
}

int DepartureTimeTree::balanceFactor(Node* node) {
    return node ? nodeHeight(node->left) - nodeHeight(node->right) : 0;
}

DepartureTimeTree::Node* DepartureTimeTree::rotateRight(Node* node) {
    Node* pivot = node->left;
    node->left = pivot->right;
    pivot->right = node;
    updateHeight(node);
    updateHeight(pivot);
    return pivot;
}

DepartureTimeTree::Node* DepartureTimeTree::rotateLeft(Node* node) {
    Node* pivot = node->right;
    node->right = pivot->left;
    pivot->left = node;
    updateHeight(node);
    updateHeight(pivot);
    return pivot;
}

DepartureTimeTree::Node* DepartureTimeTree::insertNode(Node* node, const Train& train) {
    if (!node) {
        return new Node(train);
    }
    if (train.departureTime < node->departureTime) {
        node->left = insertNode(node->left, train);
    } else if (train.departureTime > node->departureTime) {
        node->right = insertNode(node->right, train);
    } else {
        node->trains.push_back(train);
        return node;
    }

    updateHeight(node);
    const int balance = balanceFactor(node);
    if (balance > 1) {
        if (train.departureTime > node->left->departureTime) {
            node->left = rotateLeft(node->left);
        }
        return rotateRight(node);
    }
    if (balance < -1) {
        if (train.departureTime < node->right->departureTime) {
            node->right = rotateRight(node->right);
        }
        return rotateLeft(node);
    }
    return node;
}

void DepartureTimeTree::insert(const Train& train) {
    root_ = insertNode(root_, train);
}

void DepartureTimeTree::appendInOrderRecursive(Node* node, std::vector<Train>& result) {
    if (!node) {
        return;
    }
    appendInOrderRecursive(node->left, result);
    result.insert(result.end(), node->trains.begin(), node->trains.end());
    appendInOrderRecursive(node->right, result);
}

std::vector<Train> DepartureTimeTree::inOrderRecursive() const {
    std::vector<Train> result;
    appendInOrderRecursive(root_, result);
    return result;
}

std::vector<Train> DepartureTimeTree::inOrderIterative() const {
    std::vector<Train> result;
    std::vector<Node*> stack;
    Node* current = root_;
    while (current || !stack.empty()) {
        while (current) {
            stack.push_back(current);
            current = current->left;
        }
        current = stack.back();
        stack.pop_back();
        result.insert(result.end(), current->trains.begin(), current->trains.end());
        current = current->right;
    }
    return result;
}

void DepartureTimeTree::appendAfter(Node* node, const std::string& time,
                                    std::vector<Train>& result) {
    if (!node) {
        return;
    }
    if (node->departureTime > time) {
        appendAfter(node->left, time, result);
        result.insert(result.end(), node->trains.begin(), node->trains.end());
        appendInOrderRecursive(node->right, result);
    } else {
        appendAfter(node->right, time, result);
    }
}

std::vector<Train> DepartureTimeTree::findDeparturesAfter(const std::string& time) const {
    std::vector<Train> result;
    appendAfter(root_, time, result);
    return result;
}

JourneyRoute::~JourneyRoute() {
    Node* current = head_;
    while (current) {
        Node* next = current->next;
        delete current;
        current = next;
    }
}

void JourneyRoute::append(const std::string& station) {
    Node* node = new Node(station);
    node->previous = tail_;
    if (tail_) {
        tail_->next = node;
    } else {
        head_ = node;
    }
    tail_ = node;
}

std::vector<std::string> JourneyRoute::forward() const {
    std::vector<std::string> stations;
    for (Node* current = head_; current; current = current->next) {
        stations.push_back(current->station);
    }
    return stations;
}

std::vector<std::string> JourneyRoute::backward() const {
    std::vector<std::string> stations;
    for (Node* current = tail_; current; current = current->previous) {
        stations.push_back(current->station);
    }
    return stations;
}

std::vector<Train> searchTrains(const std::vector<Train>& trains,
                                const std::string& origin,
                                const std::string& destination) {
    std::vector<Train> matches;
    for (const Train& train : trains) {
        if (train.origin == origin && train.destination == destination) {
            matches.push_back(train);
        }
    }
    return matches;
}

void mergeSortByPrice(std::vector<Train>& trains) {
    std::vector<Train> buffer(trains.size());
    mergeByPrice(trains, buffer, 0, trains.size());
}

void quickSortByDepartureTime(std::vector<Train>& trains) {
    if (trains.size() > 1) {
        quickSortByTime(trains, 0, static_cast<int>(trains.size()) - 1);
    }
}

CoachSeating::CoachSeating(int rows, int columns) {
    if (rows <= 0 || columns <= 0) {
        throw std::invalid_argument("Coach dimensions must be positive");
    }
    seats_ = std::vector<std::vector<bool>>(
        static_cast<std::size_t>(rows),
        std::vector<bool>(static_cast<std::size_t>(columns), false));
}

void CoachSeating::validateSeat(int row, int column) const {
    if (row < 0 || row >= static_cast<int>(seats_.size()) ||
        column < 0 || column >= static_cast<int>(seats_[0].size())) {
        throw std::out_of_range("Seat row or column is outside the coach");
    }
}

bool CoachSeating::isBooked(int row, int column) const {
    validateSeat(row, column);
    return seats_[row][column];
}

bool CoachSeating::bookSeat(int row, int column) {
    validateSeat(row, column);
    if (seats_[row][column]) {
        return false;
    }
    undoStack_.push_back({row, column, seats_[row][column]});
    seats_[row][column] = true;
    return true;
}

bool CoachSeating::cancelBooking(int row, int column) {
    validateSeat(row, column);
    if (!seats_[row][column]) {
        return false;
    }
    undoStack_.push_back({row, column, seats_[row][column]});
    seats_[row][column] = false;
    return true;
}

bool CoachSeating::undoLastChange() {
    if (undoStack_.empty()) {
        return false;
    }
    const SeatChange change = undoStack_.back();
    undoStack_.pop_back();
    seats_[change.row][change.column] = change.previousState;
    return true;
}

void BookingRequestQueue::enqueue(const BookingRequest& request) {
    requests_.push(request);
}

bool BookingRequestQueue::empty() const noexcept {
    return requests_.empty();
}

BookingRequest BookingRequestQueue::dequeue() {
    if (requests_.empty()) {
        throw std::runtime_error("BookingRequestQueue is empty");
    }
    BookingRequest request = requests_.front();
    requests_.pop();
    return request;
}

bool PriorityTicketQueue::LowerPriorityFirst::operator()(
    const PriorityTicketRequest& left, const PriorityTicketRequest& right) const {
    return left.priority < right.priority;
}

void PriorityTicketQueue::enqueue(const PriorityTicketRequest& request) {
    requests_.push(request);
}

bool PriorityTicketQueue::empty() const noexcept {
    return requests_.empty();
}

PriorityTicketRequest PriorityTicketQueue::dequeue() {
    if (requests_.empty()) {
        throw std::runtime_error("PriorityTicketQueue is empty");
    }
    PriorityTicketRequest request = requests_.top();
    requests_.pop();
    return request;
}

RouteResult RailwayGraph::dijkstra(const std::string& start, const std::string& destination) const {
    std::unordered_map<std::string, int> dist;
    std::unordered_map<std::string, std::string> parent;
    for (const auto& entry : graph_) {
        dist[entry.first] = INT_MAX;
    }

    dist[start] = 0;
    std::priority_queue<std::pair<int, std::string>, std::vector<std::pair<int, std::string>>, std::greater<std::pair<int, std::string>>> pq;
    pq.push({0, start});

    while (!pq.empty()) {
        auto topItem = pq.top();
        pq.pop();

        int currentDist = topItem.first;
        std::string station = topItem.second;

        if (currentDist != dist[station]) {
            continue;
        }

        if (station == destination) {
            break;
        }

        const auto found = graph_.find(station);
        if (found == graph_.end()) {
            continue;
        }

        for (const Edge& edge : found->second) {
            int newDist = currentDist + edge.minutes;
            if (newDist < dist[edge.to]) {
                dist[edge.to] = newDist;
                parent[edge.to] = station;
                pq.push({newDist, edge.to});
            }
        }
    }

    RouteResult result;
    if (dist.find(destination) == dist.end() || dist[destination] == INT_MAX) {
        result.minutes = -1;
        return result;
    }

    std::vector<std::string> path;
    std::string current = destination;
    while (true) {
        path.push_back(current);
        if (current == start) {
            break;
        }
        const auto iter = parent.find(current);
        if (iter == parent.end()) {
            path.clear();
            result.minutes = -1;
            return result;
        }
        current = iter->second;
    }

    std::reverse(path.begin(), path.end());
    result.path = std::move(path);
    result.minutes = dist[destination];
    return result;
}

bool BinaryHeap::comparePriority(const Incident& a, const Incident& b) {
    if (a.priority != b.priority) {
        return a.priority > b.priority;
    }
    return a.createdAt < b.createdAt;
}

void BinaryHeap::push(const Incident& incident) {
    items_.push_back(incident);
    int index = static_cast<int>(items_.size()) - 1;
    while (index > 0) {
        int parent = (index - 1) / 2;
        if (!comparePriority(items_[index], items_[parent])) {
            break;
        }
        std::swap(items_[index], items_[parent]);
        index = parent;
    }
}

bool BinaryHeap::empty() const noexcept {
    return items_.empty();
}

Incident BinaryHeap::pop() {
    if (items_.empty()) {
        throw std::runtime_error("BinaryHeap is empty");
    }

    Incident top = items_[0];
    Incident last = items_.back();
    items_.pop_back();

    if (!items_.empty()) {
        items_[0] = last;
        int index = 0;
        while (true) {
            int left = 2 * index + 1;
            int right = 2 * index + 2;
            int best = index;

            if (left < static_cast<int>(items_.size()) && comparePriority(items_[left], items_[best])) {
                best = left;
            }
            if (right < static_cast<int>(items_.size()) && comparePriority(items_[right], items_[best])) {
                best = right;
            }
            if (best == index) {
                break;
            }
            std::swap(items_[index], items_[best]);
            index = best;
        }
    }

    return top;
}

int PnrAvlTree::height(AvlNode* node) const {
    return node ? node->height : 0;
}

int PnrAvlTree::getBalance(AvlNode* node) const {
    return node ? height(node->left) - height(node->right) : 0;
}

void PnrAvlTree::updateHeight(AvlNode* node) {
    if (node) {
        node->height = 1 + std::max(height(node->left), height(node->right));
    }
}

AvlNode* PnrAvlTree::rotateRight(AvlNode* node) {
    AvlNode* pivot = node->left;
    node->left = pivot->right;
    pivot->right = node;
    updateHeight(node);
    updateHeight(pivot);
    return pivot;
}

AvlNode* PnrAvlTree::rotateLeft(AvlNode* node) {
    AvlNode* pivot = node->right;
    node->right = pivot->left;
    pivot->left = node;
    updateHeight(node);
    updateHeight(pivot);
    return pivot;
}

AvlNode* PnrAvlTree::rebalance(AvlNode* node, int insertedKey) {
    updateHeight(node);
    int balance = getBalance(node);

    if (balance > 1) {
        if (insertedKey > node->left->key) {
            node->left = rotateLeft(node->left);
        }
        return rotateRight(node);
    }

    if (balance < -1) {
        if (insertedKey < node->right->key) {
            node->right = rotateRight(node->right);
        }
        return rotateLeft(node);
    }

    return node;
}

AvlNode* PnrAvlTree::insertNode(AvlNode* node, int key, const std::string& value, bool& inserted) {
    if (!node) {
        inserted = true;
        return new AvlNode(key, value);
    }

    if (key < node->key) {
        node->left = insertNode(node->left, key, value, inserted);
    } else if (key > node->key) {
        node->right = insertNode(node->right, key, value, inserted);
    } else {
        node->value = value;
        return node;
    }

    return rebalance(node, key);
}

void PnrAvlTree::insert(int key, const std::string& value) {
    bool inserted = false;
    root_ = insertNode(root_, key, value, inserted);
}

std::string PnrAvlTree::search(int key) const {
    AvlNode* node = root_;
    while (node) {
        if (key == node->key) {
            return node->value;
        }
        node = (key < node->key) ? node->left : node->right;
    }
    return "";
}
