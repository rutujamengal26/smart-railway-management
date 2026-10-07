#ifndef RAILWAY_H
#define RAILWAY_H

#include <string>
#include <unordered_map>
#include <queue>
#include <vector>

struct Edge {
    std::string to;
    int minutes;
};

struct RouteResult {
    std::vector<std::string> path;
    int minutes = -1;
};

struct ConnectionRouteResult {
    std::vector<std::string> path;
    int connections = -1;
};

struct TrackSegment {
    std::string from;
    std::string to;
    double constructionCost;
};

struct SpanningTreeResult {
    std::vector<TrackSegment> tracks;
    double totalConstructionCost = 0.0;
    bool spansAllStations = false;
};

class RailwayGraph {
public:
    void addStation(const std::string& station);
    void addConnection(const std::string& from, const std::string& to, int minutes);
    void addConnection(const std::string& from, const std::string& to, int minutes,
                       double constructionCost);
    RouteResult dijkstra(const std::string& start, const std::string& destination) const;
    ConnectionRouteResult fewestConnectionsBfs(const std::string& start,
                                               const std::string& destination) const;
    SpanningTreeResult minimumTrackSpanningTree() const;

private:
    std::unordered_map<std::string, std::vector<Edge>> graph_;
    std::vector<TrackSegment> trackCandidates_;
};

struct Train {
    std::string id;
    std::string origin;
    std::string destination;
    std::string departureTime;
    double ticketPrice;
};

struct WaitlistPassenger {
    std::string pnr;
    std::string passengerName;
    long long bookingTimestamp;
};

class WaitlistMinHeap {
public:
    void push(const WaitlistPassenger& passenger);
    bool empty() const noexcept;
    WaitlistPassenger popEarliest();

private:
    static bool bookedBefore(const WaitlistPassenger& left,
                             const WaitlistPassenger& right);
    std::vector<WaitlistPassenger> passengers_;
};

bool promoteAfterCancellation(WaitlistMinHeap& waitlist,
                             WaitlistPassenger& promotedPassenger);

struct TrainBookingCount {
    std::string trainId;
    int bookings;
};

void heapSortByBookings(std::vector<TrainBookingCount>& leaderboard);

struct Ticket {
    std::string pnr;
    std::string trainId;
    std::string passengerName;
    std::string status;
};

class TrainTicketLookup {
public:
    void addTrain(const Train& train);
    const Train* findTrain(const std::string& trainId) const;
    void addTicket(const Ticket& ticket);
    const Ticket* findTicket(const std::string& pnr) const;

private:
    std::unordered_map<std::string, Train> trainsById_;
    std::unordered_map<std::string, Ticket> ticketsByPnr_;
};

class DepartureTimeTree {
public:
    DepartureTimeTree() = default;
    ~DepartureTimeTree();
    DepartureTimeTree(const DepartureTimeTree&) = delete;
    DepartureTimeTree& operator=(const DepartureTimeTree&) = delete;

    void insert(const Train& train);
    std::vector<Train> inOrderRecursive() const;
    std::vector<Train> inOrderIterative() const;
    std::vector<Train> findDeparturesAfter(const std::string& time) const;

private:
    struct Node {
        explicit Node(const Train& scheduledTrain)
            : departureTime(scheduledTrain.departureTime),
              trains(1, scheduledTrain), left(nullptr), right(nullptr), height(1) {}

        std::string departureTime;
        std::vector<Train> trains;
        Node* left;
        Node* right;
        int height;
    };

    static void destroy(Node* node);
    static void appendInOrderRecursive(Node* node, std::vector<Train>& result);
    static void appendAfter(Node* node, const std::string& time, std::vector<Train>& result);
    static int nodeHeight(Node* node);
    static void updateHeight(Node* node);
    static int balanceFactor(Node* node);
    static Node* rotateLeft(Node* node);
    static Node* rotateRight(Node* node);
    static Node* insertNode(Node* node, const Train& train);

    Node* root_ = nullptr;
};

class JourneyRoute {
public:
    JourneyRoute() = default;
    ~JourneyRoute();
    JourneyRoute(const JourneyRoute&) = delete;
    JourneyRoute& operator=(const JourneyRoute&) = delete;

    void append(const std::string& station);
    std::vector<std::string> forward() const;
    std::vector<std::string> backward() const;

private:
    struct Node {
        explicit Node(const std::string& stationName)
            : station(stationName), previous(nullptr), next(nullptr) {}

        std::string station;
        Node* previous;
        Node* next;
    };

    Node* head_ = nullptr;
    Node* tail_ = nullptr;
};

std::vector<Train> searchTrains(const std::vector<Train>& trains,
                                const std::string& origin,
                                const std::string& destination);
void mergeSortByPrice(std::vector<Train>& trains);
void quickSortByDepartureTime(std::vector<Train>& trains);

class CoachSeating {
public:
    CoachSeating(int rows, int columns);
    bool isBooked(int row, int column) const;
    bool bookSeat(int row, int column);
    bool cancelBooking(int row, int column);
    bool undoLastChange();

private:
    struct SeatChange {
        int row;
        int column;
        bool previousState;
    };

    void validateSeat(int row, int column) const;
    std::vector<std::vector<bool>> seats_;
    std::vector<SeatChange> undoStack_;
};

struct BookingRequest {
    std::string pnr;
    std::string passengerName;
    std::string trainId;
};

class BookingRequestQueue {
public:
    void enqueue(const BookingRequest& request);
    bool empty() const noexcept;
    BookingRequest dequeue();

private:
    std::queue<BookingRequest> requests_;
};

struct PriorityTicketRequest {
    std::string pnr;
    std::string passengerName;
    int priority;
    std::string reason;
};

class PriorityTicketQueue {
public:
    void enqueue(const PriorityTicketRequest& request);
    bool empty() const noexcept;
    PriorityTicketRequest dequeue();

private:
    struct LowerPriorityFirst {
        bool operator()(const PriorityTicketRequest& left,
                        const PriorityTicketRequest& right) const;
    };

    std::priority_queue<PriorityTicketRequest,
                        std::vector<PriorityTicketRequest>,
                        LowerPriorityFirst> requests_;
};

struct Incident {
    int id;
    std::string title;
    std::string location;
    int priority;
    long long createdAt;
};

class BinaryHeap {
public:
    void push(const Incident& incident);
    bool empty() const noexcept;
    Incident pop();

private:
    static bool comparePriority(const Incident& a, const Incident& b);
    std::vector<Incident> items_;
};

struct AvlNode {
    int key;
    std::string value;
    AvlNode* left;
    AvlNode* right;
    int height;

    AvlNode(int nodeKey, const std::string& nodeValue)
        : key(nodeKey), value(nodeValue), left(nullptr), right(nullptr), height(1) {}
};

class PnrAvlTree {
public:
    void insert(int key, const std::string& value);
    std::string search(int key) const;

private:
    AvlNode* root_ = nullptr;
    int height(AvlNode* node) const;
    int getBalance(AvlNode* node) const;
    void updateHeight(AvlNode* node);
    AvlNode* rotateRight(AvlNode* node);
    AvlNode* rotateLeft(AvlNode* node);
    AvlNode* rebalance(AvlNode* node, int insertedKey);
    AvlNode* insertNode(AvlNode* node, int key, const std::string& value, bool& inserted);
};

#endif
