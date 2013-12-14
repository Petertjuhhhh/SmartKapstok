//NodeJS Modules
var http = require('http'); //HTTP module om GET / POST Requests te doen
var qs = require('querystring'); //This module provides utilities for dealing with query strings.
var fs = require("fs"); //File System module om bestanden te lezen
var sqlite3 = require("sqlite3").verbose(); //SQLite3 Module om verbinding te maken met de database
var os = require('os'); //Om operating station gegevens te krijgen om het locale ipadres te bekijken
var express = require("express");
var geolib = require("geolib");

//Variables
var app = express();
var post = "";
var file = "\SmartKapstok";
var exists = fs.existsSync(file); //Een check om te kijken of file bestaat
var db = new sqlite3.Database(file); //Verbinding maken met de database
var listenport = '8123';
var clientip = '10.0.0.197'; //Raspberry Pi
//var clientip = '127.0.0.1'; //Local cliënt
var clientport = '8124';
var Username = "";
var Password = "";
var reservedCoatrack = 0;
var selectAllCustomers = false; //Selects all customers in stead of the currents users city


// add this to your app.configure
//Functions
function printLocalIp() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
        var alias = 0;
        ifaces[dev].forEach(function(details) {
            if (details.family == 'IPv4') {
                console.log("[SERVER] Server gestart op: " + details.address + ":" + listenport);
                ++alias;
            }
        });
    }
}

function unlockKapstok(req, res, ipadres, port, dataw) {
    var options = {
        hostname: ipadres,
        port: port,
        path: '/',
        method: 'POST'
    };
    var req = http.request(options);
    req.on('error', function(e) {
        console.log('problem with request: ' + e.message);
    });
    // write data to request body
    req.end(dataw);
}

function lockKapstok(req, res, ipadres, port, dataw) {
    var options = {
        hostname: ipadres,
        port: port,
        path: '/',
        method: 'POST'
    };
    var req = http.request(options);
    req.on('error', function(e) {
        console.log('problem with request: ' + e.message);
    });
    // write data to request body
    req.end(dataw);
}

//Check if a user is logged in
function checkAuth(req, res, next) {
    console.log("check if user is logged in");
    if (!req.session.name) {
        console.log("not autorized");
        res.end("3");
    } else {
        next();
    }
}


//Application configuration
app.configure(function() {
    app.use(express.cookieParser());
    app.use(express.session({secret: 'SECRETSECRET'}));
    app.use(app.router);
});

//Prepare database
db.serialize(function() {
    if (!exists) {
        console.log("[SERVER] Database bestand niet gevonden.")
//        db.run("CREATE TABLE Stuff (thing TEXT)");
//        var stmt = db.prepare("INSERT INTO Stuff VALUES (?)");
//
//        var kroegen = ["Het Vliegende Paard", "De Doctor", "Timeless", "De Joffer", "De Twee Heren", "De Toog", "Het Vliegende Paard", "De Doctor", "Timeless", "De Joffer", "De Twee Heren", "De Toog"];
//
//        for (var i = 0; i < kroegen.length; i++) {
//            stmt.run(kroegen[i]);
//        }
//        stmt.finalize();
    } else {
        console.log("[SERVER] Database bestand gevonden.")
    }
});



//Create header for every HTTP response
app.all("*", function(req, res, next) {
    res.writeHead(200, {'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': 'http://localhost:8383', 'Access-Control-Allow-Credentials': true});
    next();
});


//APP.STATIC VOOR HTML PAGINAS

//Methods for Mobile Application
//getCoatRacksNearLocation
app.post("/MobileApplication/getCoatRacksNearLocation", checkAuth, function(req, res) {
    var Longitude = req.param('Longitude');
    var Latitude = req.param('Latitude');
    var City = req.param('City');
    var Customers = [];
    var selectQuery = "";

    console.log("Longitude:" + Longitude + ", Latitude:" + Latitude + ", City: " + City);

    //Get all data of the customers in the users current city
    if (selectAllCustomers === true) {
        selectQuery = "SELECT CustomerName, CustomerID, Longitude, Latitude, City FROM customers";
    } else {
        selectQuery = "SELECT CustomerName, CustomerID, Longitude, Latitude, City FROM customers WHERE City = '" + City + "'";
    }

    db.each(selectQuery, function(err, row) {
        Customers.push({
            CustomerName: row.CustomerName,
            CustomerID: row.CustomerID,
            Longitude: row.Longitude,
            Latitude: row.Latitude,
            DistanceFromLocation: 0
        });
    }, function(err, row) {

        //Calculatie the distance relative to the users current position
        for (var i = 0; i < Customers.length; i++) {
            Customers[i].DistanceFromLocation = geolib.getDistance({latitude: Latitude, longitude: Longitude}, {latitude: Customers[i].Latitude, longitude: Customers[i].Longitude});
        }

        //Sort the array 
        Customers.sort(function(a, b) {
            return a.DistanceFromLocation - b.DistanceFromLocation;
        });

        //Send the array to the mobile application
        res.end(JSON.stringify(Customers));
    });

});

//checkReservation
app.post("/MobileApplication/checkReservation", checkAuth, function(req, res) {
    console.log("[SERVER] checkReservation");

    var result = [];

    //Check if the user already has a reservation
    db.each("SELECT CustomerID FROM coatracks WHERE Username = '" + req.session.name + "'", function(err, row) {
        result.push({CustomerID: row.CustomerID});
    }, function(err, row) {
        if (result.length !== 1) {
            //The user doesn't have a reservation
            console.log("getCustomer - There are more customers with the same ID");
            console.log(result[0].CustomerID);
            res.end("1");
        } else {
            //The user has a reservation
            res.end("2");
        }
    });
});

//Lock coatrack
app.post("/MobileApplication/lockCoatRack", checkAuth, function(req, res) {
    console.log("[SERVER] lockCoatRack");
    lockKapstok(req, res, clientip, clientport, "Event=lock&Kapstok=Het Vliegende Paard&Kapstoknummer=10");
    res.end("[SERVER] lockCoatRack - Succes!");
});

//Unlock coatrack
app.post("/MobileApplication/unlockCoatRack", checkAuth, function(req, res) {
    console.log("[SERVER] unlockCoatRack");
    unlockKapstok(req, res, clientip, clientport, "Event=unlock&Kapstok=Het Vliegende Paard&Kapstoknummer=10");
    res.end("[SERVER] unlockCoatRack - Succes!");
});

//Select coatrack
app.post("/MobileApplication/getReservation", checkAuth, function(req, res) {
    var result = [];
    
    db.each("SELECT * FROM coatracks a, customers b ON a.CustomerID = b.CustomerID WHERE Username = '" + req.session.name + "'", function(err, row) {
        result.push({CustomerID: row.CustomerID,
                CustomerName: row.CustomerName,
                StreetName: row.StreetName,
                StreetNumber: row.StreetNumber,
                PostalCode: row.PostalCode,
                Manager: row.Manager,
                Longitude: row.Longitude,
                Latitude: row.Latitude,
                Kapstokaantal: row.Kapstokaantal,
                City: row.City,
                PhoneNumber: row.PhoneNumber,
                CoatrackNumber: row.CoatrackNumber
            });
    }, function(err, row){
        if(result.length === 1){
            res.end(JSON.stringify(result[0]));
        } else {
            res.end("0");
        }
    });
});

//Select coatrack
app.post("/MobileApplication/selectCustomer", checkAuth, function(req, res) {
    req.session.selectedCustomerID = req.param('CustomerID');
    console.log("[SERVER] selectCustomer - " + req.session.selectedCustomerID);
    res.end("[SERVER] selectCustomer - Succes!");
});

//Create Account
app.post("/MobileApplication/createAccount", function(req, res) {
    var Username = req.param('Username');
    var Password = req.param('Password');
    var result = [];

    db.each("SELECT * FROM users WHERE Username = '" + Username + "'", function(err, row) {
        result.push(row);
    }, function(err, row) {
        console.log(result.length);
        if (result.length > 0) {
            console.log("createAccount - Username already taken");
            res.end("1");
        } else {
            db.run("INSERT INTO users (Username, Password)VALUES ('" + Username + "', '" + Password + "')");
            console.log("createAccount - User created!");
            res.end("0");
        }
    });
});

//Login
app.post("/MobileApplication/login", function(req, res) {
    console.log("login");

    var loginUsername;
    var loginPassword;

    var body = '';

    req.on('data', function(datum) {
        body += datum;
    });

    req.on('end', function() {
        postData = qs.parse(body);
        //read postData
        loginUsername = postData.Username;
        console.log(loginUsername);
        loginPassword = postData.Password;

        var result = [];

        db.each("SELECT Username, Password FROM users WHERE Username = '" + loginUsername + "'", function(err, row) {
            result.push({Username: row.Username, Password: row.Password});
        }, function(err, row) {
            if (result.length > 0) {
                if (loginUsername === result[0]["Username"] && loginPassword === result[0]["Password"]) {
                    req.session.name = loginUsername;
                    console.log("login - Correct login");
//                    req.session.save(); // This saves the modifications
                    console.log(req.session.name);
                    
                    result = [];
                    db.each("SELECT CustomerID FROM coatracks WHERE Username = '" + req.session.name + "'", function(err, row) {
                        result.push({CustomerID: row.CustomerID});
                    }, function(err,row){
                        if(result.length === 1){
                            res.end("3");
                        } else {
                            res.end("0");
                        }
                    });               

                } else {
                    console.log("login - User exists but the password doesn't seem right");
                    res.end("2");
                }
            } else {
                console.log("login - User doensn't exist");
                res.end("1");
            }
        });
    });
});

//Login
app.post("/MobileApplication/logout", function(req, res) {
    console.log("logout");

    delete req.session.name;
    res.end();
});

//Reserve
app.post("/MobileApplication/getCustomer", checkAuth, function(req, res) {
    //Response 0 = correct
    //Response 1 = user doesn't exists
    //Response 2 = wrong password

    var result = [];

        db.each("SELECT * FROM customers WHERE CustomerID = '" + req.session.selectedCustomerID + "'", function(err, row) {
            result.push({CustomerID: row.CustomerID,
                CustomerName: row.CustomerName,
                StreetName: row.StreetName,
                StreetNumber: row.StreetNumber,
                PostalCode: row.PostalCode,
                Manager: row.Manager,
                Longitude: row.Longitude,
                Latitude: row.Latitude,
                Kapstokaantal: row.Kapstokaantal,
                City: row.City,
                PhoneNumber: row.PhoneNumber});
        }, function(err, row) {
            console.log(result.length);
            if (result.length !== 1) {
                console.log("getCustomer - There are more customers with the same ID");
                res.end("1");
            } else {
                res.end(JSON.stringify(result));
            }
        });
});

//Reservation
app.post("/MobileApplication/reserveCoatrack", checkAuth, function(req, res) {
    var resultUserReservations = [];
    var resultCustomerCoatracks = [];
    var name = req.session.name;
    var reservedCoatrack;
    console.log(name + "Want's to reserve at " + req.session.selectedCustomerID);


    //Get all coatracks with the users reservations
    db.each("SELECT * FROM coatracks WHERE Username = '" + req.session.name + "';", function(err, row) {
        resultUserReservations.push({
            CustomerID: row.CustomerID,
            CustomerName: row.CustomerName,
            CoatrackNumber: row.CoatrackNumber,
            Username: row.Username
        });
    }, function(err, row) {
        //Check if there's already a reservation
        if (resultUserReservations.length !== 0) {
            console.log("reserveCoatrack - You already have a coat hanging at " + resultUserReservations[0].CustomerName + ".");
            reservedCoatrack = {Error: "You already have a coat hanging at " + resultUserReservations[0].CustomerName + "."};
            res.end(JSON.stringify(reservedCoatrack));
        } else {
            //Get all coatracks from the selected customer
            db.each("SELECT * FROM coatracks WHERE CustomerID = '" + req.session.selectedCustomerID + "'", function(err, row) {
                resultCustomerCoatracks.push({
                    CustomerID: row.CustomerID,
                    CustomerName: row.CustomerName,
                    CoatrackNumber: row.CoatrackNumber,
                    Username: row.Username
                });
            }, function(err, row) {
                if (resultCustomerCoatracks.length !== 0) {
                    //Look for a free coatrack
                    for (var i = 0; i < resultCustomerCoatracks.length; i++) {
                        if (resultCustomerCoatracks[i].Username === "" || resultCustomerCoatracks[i].Username === null) {
                            //Create reservation
                            db.run("UPDATE coatracks SET Username ='" + req.session.name + "' WHERE CustomerID = '" + req.session.selectedCustomerID + "' AND CoatrackNumber = '" + resultCustomerCoatracks[i].CoatrackNumber + "';");
                            reservedCoatrack = {Error: null, CustomerID: resultCustomerCoatracks[i].CustomerID, CoatrackNumber: resultCustomerCoatracks[i].CoatrackNumber};
                            req.session.reservedCoatrack = reservedCoatrack;
                            res.end(JSON.stringify(reservedCoatrack));
                            break;
                        } else if ((resultCustomerCoatracks[i].Username !== "" || resultCustomerCoatracks[i].Username !== null) && ((i + 1) === resultCustomerCoatracks.length)) {
                            console.log("reserveCoatrack - This coatrack is full");
                            reservedCoatrack = {Error: "This coatrack is full.", CustomerID: resultCustomerCoatracks[i].CustomerID, CoatrackNumber: resultCustomerCoatracks[i].CoatrackNumber};
                            res.end(JSON.stringify(reservedCoatrack));
                        }
                    }
                } else {
                    //The customer has not created any coatracks yet.
                    console.log("reserveCoatrack - The customer has not created any coatracks yet.");
                    reservedCoatrack = {Error: "This location has not created any coatracks yet.", CustomerID: "", CoatrackNumber: ""};
                    res.end(JSON.stringify(reservedCoatrack));
                }
            });
        }
    });
});

//If the url isn't valid respond with 404
app.all("*", function(request, response) {
    response.end("404!");
});

//Listen on listenport
http.createServer(app).listen(listenport);

//Print localip on the screen
printLocalIp();