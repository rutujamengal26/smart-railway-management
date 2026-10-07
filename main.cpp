#include "railway.h"

#include <iostream>
#include <string>
#include <vector>

int main() {
    std::vector<Train> trains = {
        {"12123", "Mumbai CSMT", "Pune Jn", "17:10", 420.00},
        {"11007", "Mumbai CSMT", "Pune Jn", "07:00", 360.00},
        {"11009", "Mumbai CSMT", "Pune Jn", "06:00", 300.00},
        {"99901", "Dadar", "Pune Jn", "08:15", 250.00}
    };

    std::vector<Train> matchingTrains =
        searchTrains(trains, "Mumbai CSMT", "Pune Jn");

    std::vector<Train> byPrice = matchingTrains;
    mergeSortByPrice(byPrice);
    std::cout << "Trains from Mumbai CSMT to Pune Jn, sorted by ticket price (Merge Sort):\n";
    for (const Train& train : byPrice) {
        std::cout << train.id << " | " << train.departureTime
                  << " | Rs " << train.ticketPrice << '\n';
    }

    std::vector<Train> byDeparture = matchingTrains;
    quickSortByDepartureTime(byDeparture);
    std::cout << "\nSame trains, sorted by departure time (Quick Sort):\n";
    for (const Train& train : byDeparture) {
        std::cout << train.id << " | " << train.departureTime
                  << " | Rs " << train.ticketPrice << '\n';
    }

    DepartureTimeTree timetable;
    for (const Train& train : trains) {
        timetable.insert(train);
    }
    std::cout << "\nDaily timetable (recursive BST in-order traversal):\n";
    for (const Train& train : timetable.inOrderRecursive()) {
        std::cout << train.departureTime << " | " << train.id << " | "
                  << train.origin << " to " << train.destination << '\n';
    }
    std::cout << "Timetable using non-recursive in-order traversal:\n";
    for (const Train& train : timetable.inOrderIterative()) {
        std::cout << train.departureTime << " | " << train.id << '\n';
    }
    std::cout << "Trains departing after 07:00:\n";
    for (const Train& train : timetable.findDeparturesAfter("07:00")) {
        std::cout << train.departureTime << " | " << train.id << '\n';
    }

    WaitlistMinHeap standardWaitlist;
    standardWaitlist.push({"WL1003", "Aarav", 300});
    standardWaitlist.push({"WL1001", "Isha", 100});
    standardWaitlist.push({"WL1002", "Kabir", 200});
    std::cout << "\nCanceled confirmed ticket; promote earliest waitlist booking:\n";
    WaitlistPassenger promotedPassenger;
    if (promoteAfterCancellation(standardWaitlist, promotedPassenger)) {
        std::cout << promotedPassenger.pnr << " | " << promotedPassenger.passengerName
                  << " | booking timestamp " << promotedPassenger.bookingTimestamp
                  << " (seat assigned)\n";
    } else {
        std::cout << "No waitlisted passengers; seat is available\n";
    }

    std::vector<TrainBookingCount> leaderboard = {
        {"12123", 84}, {"11007", 132}, {"11009", 97}, {"99901", 51}
    };
    heapSortByBookings(leaderboard);
    std::cout << "\nLive train booking leaderboard (Heapsort, highest bookings first):\n";
    for (const TrainBookingCount& entry : leaderboard) {
        std::cout << entry.trainId << " | " << entry.bookings << " bookings\n";
    }

    CoachSeating coach(3, 4);
    coach.bookSeat(1, 2);
    std::cout << "\nCoach seating (X = booked, O = available):\n";
    for (int row = 0; row < 3; ++row) {
        for (int column = 0; column < 4; ++column) {
            std::cout << (coach.isBooked(row, column) ? 'X' : 'O') << ' ';
        }
        std::cout << '\n';
    }
    std::cout << "Seat [1][2] booked? "
              << (coach.isBooked(1, 2) ? "Yes" : "No") << '\n';
    coach.bookSeat(0, 1);
    const bool undoSucceeded = coach.undoLastChange();
    const bool seatAvailableAfterUndo = !coach.isBooked(0, 1);
    std::cout << "Booked seat [0][1], then undo: "
              << (undoSucceeded ? "undone" : "nothing to undo")
              << "; seat now " << (seatAvailableAfterUndo ? "available" : "booked") << '\n';

    BookingRequestQueue bookingQueue;
    bookingQueue.enqueue({"PNR20001", "Meera", "12123"});
    bookingQueue.enqueue({"PNR20002", "Arjun", "11007"});
    bookingQueue.enqueue({"PNR20003", "Sara", "11009"});
    std::cout << "\nBooking requests processed FIFO:\n";
    while (!bookingQueue.empty()) {
        const BookingRequest request = bookingQueue.dequeue();
        std::cout << request.pnr << " | " << request.passengerName
                  << " | Train " << request.trainId << '\n';
    }

    PriorityTicketQueue priorityRequests;
    priorityRequests.enqueue({"PNR30001", "Nisha", 1, "Standard waitlist"});
    priorityRequests.enqueue({"PNR30002", "Dev", 10, "Medical emergency"});
    priorityRequests.enqueue({"PNR30003", "Rohan", 5, "VIP quota"});
    std::cout << "\nSpecial ticket requests by priority (higher number first):\n";
    while (!priorityRequests.empty()) {
        const PriorityTicketRequest request = priorityRequests.dequeue();
        std::cout << request.pnr << " | " << request.passengerName
                  << " | priority " << request.priority
                  << " | " << request.reason << '\n';
    }

    JourneyRoute journey;
    journey.append("Pune Jn");
    journey.append("Lonavala");
    journey.append("Karjat");
    journey.append("Kalyan Jn");
    journey.append("Dadar");
    journey.append("Mumbai CSMT");
    std::cout << "\nJourney using a doubly linked list:\nForward: ";
    for (const std::string& station : journey.forward()) {
        std::cout << station << " ";
    }
    std::cout << "\nBackward: ";
    for (const std::string& station : journey.backward()) {
        std::cout << station << " ";
    }
    std::cout << '\n';

    TrainTicketLookup lookup;
    for (const Train& train : trains) {
        lookup.addTrain(train);
    }
    lookup.addTicket({"PNR10001", "12123", "Asha Patil", "Confirmed"});
    lookup.addTicket({"PNR10002", "11007", "Ravi Shah", "Waiting list"});

    std::cout << "\nHash table lookups (unordered_map; average O(1)):\n";
    const Train* foundTrain = lookup.findTrain("12123");
    if (foundTrain) {
        std::cout << "Train ID 12123 -> " << foundTrain->origin << " to "
                  << foundTrain->destination << " at " << foundTrain->departureTime << '\n';
    } else {
        std::cout << "Train ID 12123 not found\n";
    }
    const Ticket* foundTicket = lookup.findTicket("PNR10001");
    if (foundTicket) {
        std::cout << "PNR " << foundTicket->pnr << " -> " << foundTicket->status
                  << ", passenger: " << foundTicket->passengerName
                  << ", train: " << foundTicket->trainId << '\n';
    } else {
        std::cout << "PNR PNR10001 not found\n";
    }

    RailwayGraph graph;
    graph.addConnection("Mumbai CSMT", "Dadar", 10, 120.0);
    graph.addConnection("Dadar", "Thane", 22, 95.0);
    graph.addConnection("Thane", "Kalyan Jn", 20, 80.0);
    graph.addConnection("Kalyan Jn", "Kasara", 95, 210.0);
    graph.addConnection("Kasara", "Igatpuri", 35, 70.0);
    graph.addConnection("Kalyan Jn", "Karjat", 55, 135.0);
    graph.addConnection("Karjat", "Lonavala", 40, 110.0);
    graph.addConnection("Lonavala", "Pune Jn", 60, 145.0);

    RouteResult route = graph.dijkstra("Mumbai CSMT", "Pune Jn");
    if (route.minutes != -1) {
        std::cout << "Fastest route: ";
        for (const std::string& stop : route.path) {
            std::cout << stop << " ";
        }
        std::cout << "\nTotal travel time: " << route.minutes << " minutes\n";
    } else {
        std::cout << "No route found.\n";
    }

    ConnectionRouteResult fewestConnections =
        graph.fewestConnectionsBfs("Mumbai CSMT", "Pune Jn");
    if (fewestConnections.connections >= 0) {
        std::cout << "Route with fewest track connections (BFS): ";
        for (const std::string& station : fewestConnections.path) {
            std::cout << station << " ";
        }
        std::cout << "\nConnections: " << fewestConnections.connections << '\n';
    } else {
        std::cout << "No connected route found by BFS.\n";
    }

    const SpanningTreeResult trackPlan = graph.minimumTrackSpanningTree();
    std::cout << "\nAdmin track plan (Kruskal minimum spanning tree):\n";
    if (trackPlan.spansAllStations) {
        for (const TrackSegment& track : trackPlan.tracks) {
            std::cout << track.from << " -- " << track.to
                      << " | construction cost " << track.constructionCost << '\n';
        }
        std::cout << "Total illustrative construction cost: "
                  << trackPlan.totalConstructionCost << " units\n";
    } else {
        std::cout << "The station network is disconnected; minimum spanning forest cost: "
                  << trackPlan.totalConstructionCost << " units across "
                  << trackPlan.tracks.size() << " tracks\n";
    }

    BinaryHeap incidents;
    incidents.push({1, "Signal check near Thane", "Thane", 3, 600000});
    incidents.push({2, "Track inspection at Kasara", "Kasara", 2, 1200000});
    incidents.push({3, "Platform service at Dadar", "Dadar", 1, 2100000});

    std::cout << "\nHighest priority incidents:\n";
    while (!incidents.empty()) {
        Incident incident = incidents.pop();
        std::cout << "ID: " << incident.id << " | Priority: " << incident.priority
                  << " | Title: " << incident.title << " | Location: " << incident.location << '\n';
    }

    PnrAvlTree pnrTree;
    pnrTree.insert(12123, "DECCAN QUEEN");
    pnrTree.insert(12124, "DECCAN QUEEN");
    pnrTree.insert(11007, "DECCAN EXPRESS");
    pnrTree.insert(11008, "DECCAN EXPRESS");

    std::cout << "\nPNR lookup:\n";
    std::cout << "12123 -> " << pnrTree.search(12123) << '\n';
    std::cout << "11007 -> " << pnrTree.search(11007) << '\n';
    std::cout << "99999 -> " << pnrTree.search(99999) << '\n';

    return 0;
}
